import logging
import threading
import time

import httpx
from django.conf import settings
from django.db import connection
from django.db.models import Q
from django.utils import timezone

from accounts.models import User
from chat.models import Broadcast, BroadcastRecipient, Conversation, Message

logger = logging.getLogger(__name__)

# Telegram tolerates ~30 msgs/sec to different users; stay a little under.
SEND_DELAY = 0.05
PROGRESS_EVERY = 25
MAX_RETRY_AFTER = 30

# To restrict delivery (e.g. for testing), put usernames here; empty = everyone.
TEST_USERNAMES: list[str] = []


def recipient_queryset():
    """Users a broadcast will be delivered to (all users, unless restricted)."""
    if TEST_USERNAMES:
        q = Q()
        for name in TEST_USERNAMES:
            q |= Q(username__iexact=name)
        return User.objects.filter(q)
    return User.objects.all()


def _display_name(first: str, last: str, username: str, tid: int) -> str:
    return f"{first or ''} {last or ''}".strip() or username or str(tid)


def _flush_chat_history(text: str, when, batch: dict[int, bool]) -> None:
    """Store a batch of broadcast deliveries as admin messages in each recipient's
    support thread, so they show up in chat history (flagged if delivery failed).
    Called incrementally during the run so the inbox updates in near real time."""
    tids = list(batch)
    existing = set(Conversation.objects.filter(user_id__in=tids).values_list("user_id", flat=True))
    new_convs = [Conversation(user_id=t, updated_at=when) for t in tids if t not in existing]
    if new_convs:
        Conversation.objects.bulk_create(new_convs, ignore_conflicts=True, batch_size=500)

    conv_map = dict(Conversation.objects.filter(user_id__in=tids).values_list("user_id", "id"))
    msgs = [
        Message(
            conversation_id=conv_map[t],
            sender=Message.ADMIN,
            author=None,
            text=text,
            delivery_failed=not batch[t],
        )
        for t in tids if t in conv_map
    ]
    created = Message.objects.bulk_create(msgs, batch_size=500)
    if created:
        # created_at is auto_now_add; a direct UPDATE stamps the real send time
        Message.objects.filter(id__in=[m.id for m in created]).update(created_at=when)
    Conversation.objects.filter(user_id__in=tids).update(updated_at=when)


def _send_one(client: httpx.Client, url: str, chat_id: int, text: str) -> bool:
    """Send one message, honouring a single 429 back-off. Returns delivered?"""
    for _ in range(2):
        try:
            resp = client.post(url, json={"chat_id": chat_id, "text": text})
        except httpx.HTTPError:
            return False
        if resp.status_code == 429:
            try:
                retry = resp.json().get("parameters", {}).get("retry_after", 1)
            except ValueError:
                retry = 1
            time.sleep(min(retry, MAX_RETRY_AFTER))
            continue
        try:
            return bool(resp.json().get("ok"))
        except ValueError:
            return False
    return False


def _run(broadcast_id: int) -> None:
    token = settings.BOT_TOKEN
    recipients = list(
        recipient_queryset().values("telegram_id", "first_name", "last_name", "username")
    )

    # fresh start: clear any prior per-user rows for this broadcast
    BroadcastRecipient.objects.filter(broadcast_id=broadcast_id).delete()
    Broadcast.objects.filter(id=broadcast_id).update(
        total=len(recipients), status=Broadcast.RUNNING,
    )

    bc = Broadcast.objects.get(id=broadcast_id)
    url = f"https://api.telegram.org/bot{token}/sendMessage" if token else None

    sent = failed = 0
    pending: list[BroadcastRecipient] = []
    hist_batch: dict[int, bool] = {}

    def flush():
        if pending:
            BroadcastRecipient.objects.bulk_create(pending)
            pending.clear()
        if hist_batch:
            # record this batch into chat history (inbox sees it within seconds)
            _flush_chat_history(bc.text, bc.created_at, hist_batch)
            hist_batch.clear()

    try:
        with httpx.Client(timeout=15.0) as client:
            for i, u in enumerate(recipients, 1):
                tid = u["telegram_id"]
                ok = bool(url) and _send_one(client, url, tid, bc.text)
                if ok:
                    sent += 1
                else:
                    failed += 1
                pending.append(BroadcastRecipient(
                    broadcast_id=broadcast_id,
                    telegram_id=tid,
                    name=_display_name(u["first_name"], u["last_name"], u["username"], tid),
                    username=u["username"] or "",
                    status=BroadcastRecipient.SENT if ok else BroadcastRecipient.FAILED,
                ))
                hist_batch[tid] = ok
                if i % PROGRESS_EVERY == 0:
                    flush()
                    Broadcast.objects.filter(id=broadcast_id).update(sent=sent, failed=failed)
                if url:
                    time.sleep(SEND_DELAY)
    except Exception:  # noqa: BLE001 — never let the worker die silently
        logger.exception("broadcast %s crashed", broadcast_id)
    finally:
        flush()
        Broadcast.objects.filter(id=broadcast_id).update(
            sent=sent, failed=failed, status=Broadcast.DONE, finished_at=timezone.now(),
        )
        connection.close()


def start_broadcast(broadcast_id: int) -> None:
    """Kick off delivery on a background thread; returns immediately."""
    threading.Thread(target=_run, args=(broadcast_id,), daemon=True).start()

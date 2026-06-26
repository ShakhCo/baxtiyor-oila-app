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


def _flush_chat_history(text: str, when, batch: dict[int, bool], image_name: str | None = None) -> None:
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
            image=image_name or None,  # first broadcast photo, so the thread shows it
            delivery_failed=not batch[t],
        )
        for t in tids if t in conv_map
    ]
    created = Message.objects.bulk_create(msgs, batch_size=500)
    if created:
        # created_at is auto_now_add; a direct UPDATE stamps the real send time
        Message.objects.filter(id__in=[m.id for m in created]).update(created_at=when)
    Conversation.objects.filter(user_id__in=tids).update(updated_at=when)


def _post(client: httpx.Client, url: str, payload: dict) -> bool:
    """POST a Telegram call, honouring a single 429 back-off. Returns ok?"""
    for _ in range(2):
        try:
            resp = client.post(url, json=payload)
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


def _acquire_file_ids(client: httpx.Client, token: str, images) -> list[str]:
    """Upload each broadcast photo to the admin group once to obtain a reusable
    Telegram file_id (then delete the temporary message), so per-user delivery
    sends the file_id instead of re-uploading the bytes 700+ times."""
    chat_id = settings.TELEGRAM_ADMIN_GROUP_ID
    if not chat_id:
        return []
    send_url = f"https://api.telegram.org/bot{token}/sendPhoto"
    del_url = f"https://api.telegram.org/bot{token}/deleteMessage"
    file_ids: list[str] = []
    for img in images:
        try:
            with img.image.open("rb") as fh:
                resp = client.post(
                    send_url,
                    data={"chat_id": chat_id, "disable_notification": "true"},
                    files={"photo": fh},
                )
            data = resp.json()
            if not data.get("ok"):
                continue
            result = data["result"]
            photos = result.get("photo") or []
            if not photos:
                continue
            file_ids.append(photos[-1]["file_id"])
            mid = result.get("message_id")
            if mid:
                client.post(del_url, json={"chat_id": chat_id, "message_id": mid})
        except (httpx.HTTPError, ValueError, KeyError, OSError):
            continue
    return file_ids


def _deliver(client: httpx.Client, token: str, chat_id: int, text: str, file_ids: list[str]) -> bool:
    """Deliver to one user: a media group / single photo (with the text as caption,
    capped at Telegram's 1024) when there are photos, otherwise a plain message."""
    if file_ids:
        if len(file_ids) == 1:
            payload = {"chat_id": chat_id, "photo": file_ids[0]}
            if text:
                payload["caption"] = text[:1024]
            return _post(client, f"https://api.telegram.org/bot{token}/sendPhoto", payload)
        media = []
        for idx, fid in enumerate(file_ids):
            item = {"type": "photo", "media": fid}
            if idx == 0 and text:
                item["caption"] = text[:1024]
            media.append(item)
        return _post(client, f"https://api.telegram.org/bot{token}/sendMediaGroup",
                     {"chat_id": chat_id, "media": media})
    return _post(client, f"https://api.telegram.org/bot{token}/sendMessage",
                 {"chat_id": chat_id, "text": text})


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
    images = list(bc.images.all())
    first_image_name = images[0].image.name if images else None

    sent = failed = 0
    pending: list[BroadcastRecipient] = []
    hist_batch: dict[int, bool] = {}

    def flush():
        if pending:
            BroadcastRecipient.objects.bulk_create(pending)
            pending.clear()
        if hist_batch:
            # record this batch into chat history (inbox sees it within seconds)
            _flush_chat_history(bc.text, bc.created_at, hist_batch, first_image_name)
            hist_batch.clear()

    try:
        with httpx.Client(timeout=30.0) as client:
            # prepare reusable file_ids once; fall back to text-only if it fails
            file_ids = _acquire_file_ids(client, token, images) if (token and images) else []
            # photo-only broadcast whose media couldn't be prepared can't be sent
            sendable = bool(token) and bool(file_ids or bc.text)
            # a media group counts as N messages against the rate limit
            step = SEND_DELAY * max(1, len(file_ids))

            for i, u in enumerate(recipients, 1):
                tid = u["telegram_id"]
                ok = _deliver(client, token, tid, bc.text, file_ids) if sendable else False
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
                if sendable:
                    time.sleep(step)
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

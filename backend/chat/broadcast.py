import logging
import threading
import time

import httpx
from django.conf import settings
from django.db import connection
from django.utils import timezone

from accounts.models import User
from chat.models import Broadcast

logger = logging.getLogger(__name__)

# Telegram tolerates ~30 msgs/sec to different users; stay a little under.
SEND_DELAY = 0.05
PROGRESS_EVERY = 25
MAX_RETRY_AFTER = 30


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
    user_ids = list(User.objects.values_list("telegram_id", flat=True))

    Broadcast.objects.filter(id=broadcast_id).update(
        total=len(user_ids), status=Broadcast.RUNNING,
    )

    bc = Broadcast.objects.get(id=broadcast_id)
    if not token:
        # nothing we can send with — mark everyone failed and finish
        Broadcast.objects.filter(id=broadcast_id).update(
            failed=len(user_ids), status=Broadcast.DONE, finished_at=timezone.now(),
        )
        connection.close()
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    sent = failed = 0
    try:
        with httpx.Client(timeout=15.0) as client:
            for i, tid in enumerate(user_ids, 1):
                if _send_one(client, url, tid, bc.text):
                    sent += 1
                else:
                    failed += 1
                if i % PROGRESS_EVERY == 0:
                    Broadcast.objects.filter(id=broadcast_id).update(sent=sent, failed=failed)
                time.sleep(SEND_DELAY)
    except Exception:  # noqa: BLE001 — never let the worker die silently
        logger.exception("broadcast %s crashed", broadcast_id)
    finally:
        Broadcast.objects.filter(id=broadcast_id).update(
            sent=sent, failed=failed, status=Broadcast.DONE, finished_at=timezone.now(),
        )
        connection.close()


def start_broadcast(broadcast_id: int) -> None:
    """Kick off delivery on a background thread; returns immediately."""
    threading.Thread(target=_run, args=(broadcast_id,), daemon=True).start()

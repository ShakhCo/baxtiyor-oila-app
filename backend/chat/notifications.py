import html
import logging
import threading

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

PREVIEW_LEN = 600


def _display_name(user) -> str:
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username or str(user.telegram_id)


def _send(telegram_id: int, name: str, handle: str, text: str) -> None:
    bot_token = settings.BOT_TOKEN
    chat_id = settings.TELEGRAM_ADMIN_GROUP_ID
    if not bot_token or not chat_id:
        return

    preview = text if len(text) <= PREVIEW_LEN else text[:PREVIEW_LEN] + "…"
    body = (
        f"💬 <b>{html.escape(name)}</b> · {html.escape(handle)}\n\n"
        f"{html.escape(preview)}"
    )
    payload = {
        "chat_id": chat_id,
        "text": body,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    # Deep link straight into this user's thread inside the Mini App. `startapp`
    # only allows [A-Za-z0-9_-], so chat_<id> is safe.
    if settings.MINIAPP_URL:
        link = f"{settings.MINIAPP_URL}?startapp=chat_{telegram_id}"
        payload["reply_markup"] = {
            "inline_keyboard": [[{"text": "💬 Suhbatni ochish", "url": link}]]
        }

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        resp = httpx.post(url, json=payload, timeout=5.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("admin group notify failed for %s: %s", telegram_id, exc)


def notify_admin_group_new_message(user, text: str) -> None:
    """Post a user's incoming support message to the admin group, with a button
    that opens the Mini App on that user's chat thread.

    Fire-and-forget: runs on a background thread so it never adds latency to —
    or fails — the user's send request.
    """
    threading.Thread(
        target=_send,
        args=(
            user.telegram_id,
            _display_name(user),
            f"@{user.username}" if user.username else f"ID {user.telegram_id}",
            text,
        ),
        daemon=True,
    ).start()

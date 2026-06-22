import logging

import httpx
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

ADMIN_STATUSES = {"creator", "administrator", "member"}


def is_admin(telegram_id: int) -> bool:
    """Return True if the user is a member of TELEGRAM_ADMIN_GROUP_ID.

    Cached for ADMIN_CACHE_TTL_SECONDS. Returns False if the group ID
    or bot token is not configured, or if the Telegram API call fails.
    """
    bot_token = settings.BOT_TOKEN
    chat_id = settings.TELEGRAM_ADMIN_GROUP_ID
    if not bot_token or not chat_id:
        return False

    cache_key = f"admin:{telegram_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    url = f"https://api.telegram.org/bot{bot_token}/getChatMember"
    params = {"chat_id": chat_id, "user_id": telegram_id}
    try:
        response = httpx.get(url, params=params, timeout=5.0)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("getChatMember failed for %s: %s", telegram_id, exc)
        return False

    if not payload.get("ok"):
        # User not in chat returns ok=false with description "user not found" etc.
        is_admin = False
    else:
        status = payload.get("result", {}).get("status")
        is_admin = status in ADMIN_STATUSES

    cache.set(cache_key, is_admin, settings.ADMIN_CACHE_TTL_SECONDS)
    return is_admin

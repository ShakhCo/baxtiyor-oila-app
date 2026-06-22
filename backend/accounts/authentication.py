import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from django.conf import settings
from rest_framework import authentication, exceptions

from accounts.models import User


def _verify_init_data(init_data: str, bot_token: str) -> dict:
    """Validate Telegram initData HMAC and return parsed fields.

    Raises AuthenticationFailed on any failure. Returns the parsed dict
    (with `user` already JSON-decoded) on success.
    """
    if not init_data:
        raise exceptions.AuthenticationFailed("Empty initData")
    if not bot_token:
        raise exceptions.AuthenticationFailed("Server BOT_TOKEN not configured")

    # parse_qsl preserves order; keep_blank_values just in case
    pairs = parse_qsl(init_data, keep_blank_values=True)
    data = dict(pairs)

    received_hash = data.pop("hash", None)
    if not received_hash:
        raise exceptions.AuthenticationFailed("Missing hash in initData")

    data_check_string = "\n".join(
        f"{k}={data[k]}" for k in sorted(data.keys())
    )

    secret_key = hmac.new(
        b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256
    ).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise exceptions.AuthenticationFailed("Invalid initData signature")

    auth_date = int(data.get("auth_date", "0"))
    if auth_date == 0:
        raise exceptions.AuthenticationFailed("Missing auth_date")
    if (time.time() - auth_date) > settings.INIT_DATA_MAX_AGE_SECONDS:
        raise exceptions.AuthenticationFailed("initData expired")

    user_json = data.get("user")
    if not user_json:
        raise exceptions.AuthenticationFailed("Missing user in initData")
    try:
        data["user"] = json.loads(user_json)
    except json.JSONDecodeError as exc:
        raise exceptions.AuthenticationFailed("Malformed user JSON") from exc

    return data


class TelegramInitDataAuthentication(authentication.BaseAuthentication):
    """DRF auth class. Expects `Authorization: tma <initData>`."""

    keyword = "tma"

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header:
            return None

        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != self.keyword:
            return None

        init_data = parts[1]
        parsed = _verify_init_data(init_data, settings.BOT_TOKEN)
        tg_user = parsed["user"]

        user, _ = User.objects.update_or_create(
            telegram_id=tg_user["id"],
            defaults={
                "first_name": tg_user.get("first_name", "") or "",
                "last_name": tg_user.get("last_name", "") or "",
                "username": tg_user.get("username", "") or "",
                "language_code": tg_user.get("language_code", "") or "",
            },
        )
        return (user, None)

    def authenticate_header(self, request):
        return self.keyword

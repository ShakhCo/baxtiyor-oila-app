from django.conf import settings
from rest_framework import status as http_status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import User
from accounts.telegram import is_admin


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(_request):
    return Response({"status": "ok"})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register_user(request):
    """Server-to-server: create a user when they /start the bot. Idempotent —
    get_or_create on the telegram_id primary key never makes a duplicate.
    Authorised with the shared X-Bot-Secret header."""
    secret = settings.BOT_INTERNAL_SECRET
    if not secret or request.headers.get("X-Bot-Secret") != secret:
        return Response({"detail": "forbidden"}, status=http_status.HTTP_403_FORBIDDEN)

    try:
        telegram_id = int(request.data.get("telegram_id"))
    except (TypeError, ValueError):
        return Response({"detail": "telegram_id required"}, status=http_status.HTTP_400_BAD_REQUEST)

    _, created = User.objects.get_or_create(
        telegram_id=telegram_id,
        defaults={
            "first_name": (request.data.get("first_name") or "")[:128],
            "last_name": (request.data.get("last_name") or "")[:128],
            "username": (request.data.get("username") or "")[:64],
            "language_code": (request.data.get("language_code") or "")[:8],
        },
    )
    return Response(
        {"created": created, "total_users": User.objects.count()},
        status=http_status.HTTP_201_CREATED if created else http_status.HTTP_200_OK,
    )


@api_view(["GET"])
def me(request):
    user = request.user
    return Response({
        "telegram_id": user.telegram_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "language_code": user.language_code,
        "is_admin": is_admin(user.telegram_id),
    })

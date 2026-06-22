from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.telegram import is_admin


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(_request):
    return Response({"status": "ok"})


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

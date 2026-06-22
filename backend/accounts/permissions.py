from rest_framework.permissions import BasePermission

from accounts.telegram import is_admin


class IsAdmin(BasePermission):
    """Permission: request.user must be a Telegram admin (group member or forced)."""

    message = "Admin access required."

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if user is None:
            return False
        tid = getattr(user, "telegram_id", None)
        if tid is None:
            return False
        return is_admin(tid)

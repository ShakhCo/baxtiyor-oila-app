from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from profiles.models import Profile
from profiles.serializers import ProfileSerializer


def _summary(p: Profile) -> dict:
    return {
        "telegram_id":       p.user_id,
        "full_name":         p.full_name,
        "age":               p.age,
        "birthplace_region": p.birthplace_region,
        "current_residence_germany": p.current_residence_germany,
        "tariff":            p.tariff,
        "status":            p.status,
        "created_at":        p.created_at.isoformat(),
        "updated_at":        p.updated_at.isoformat(),
    }


@api_view(["GET"])
@permission_classes([IsAdmin])
def list_anketas(request):
    """List anketas, default filter: status=pending."""
    qs = Profile.objects.select_related("user").order_by("-created_at")
    requested_status = request.query_params.get("status", "pending")
    if requested_status != "all":
        qs = qs.filter(status=requested_status)
    counts = {
        "pending":  Profile.objects.filter(status="pending").count(),
        "approved": Profile.objects.filter(status="approved").count(),
        "rejected": Profile.objects.filter(status="rejected").count(),
    }
    return Response({
        "items": [_summary(p) for p in qs],
        "counts": counts,
        "filter": requested_status,
    })


@api_view(["GET"])
@permission_classes([IsAdmin])
def get_anketa(_request, telegram_id: int):
    profile = get_object_or_404(Profile, user_id=telegram_id)
    user = profile.user
    return Response({
        "telegram_id":   user.telegram_id,
        "first_name":    user.first_name,
        "last_name":     user.last_name,
        "username":      user.username,
        "language_code": user.language_code,
        **ProfileSerializer(profile).data,
    })


@api_view(["POST"])
@permission_classes([IsAdmin])
def approve_anketa(_request, telegram_id: int):
    profile = get_object_or_404(Profile, user_id=telegram_id)
    profile.status = "approved"
    profile.rejection_reason = ""
    profile.save(update_fields=["status", "rejection_reason", "updated_at"])
    return Response({"telegram_id": profile.user_id, "status": profile.status})


@api_view(["POST"])
@permission_classes([IsAdmin])
def reject_anketa(request, telegram_id: int):
    profile = get_object_or_404(Profile, user_id=telegram_id)
    reason = (request.data.get("reason") or "").strip()
    if not reason:
        return Response(
            {"detail": "Rejection reason is required."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    profile.status = "rejected"
    profile.rejection_reason = reason
    profile.save(update_fields=["status", "rejection_reason", "updated_at"])
    return Response({
        "telegram_id":      profile.user_id,
        "status":           profile.status,
        "rejection_reason": profile.rejection_reason,
    })

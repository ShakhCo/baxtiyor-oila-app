from django.shortcuts import get_object_or_404
from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAdmin
from chat.models import Conversation, Label
from profiles.models import Profile
from profiles.serializers import ProfileSerializer

# Chat label applied to the user's support thread based on the anketa status, so
# admins can filter the inbox by it. Mutually exclusive (pending = no label).
STATUS_LABELS = {"approved": "Tasdiqlangan", "rejected": "Rad etilgan"}
_ALL_STATUS_LABELS = set(STATUS_LABELS.values())


def _assign_status_label(user, status):
    """Replace any previous status label with the one matching `status`
    (pending clears it). Other labels — e.g. tariff — are preserved."""
    conv, _ = Conversation.objects.get_or_create(user=user)
    labels = [l for l in (conv.labels or []) if l not in _ALL_STATUS_LABELS]
    new = STATUS_LABELS.get(status)
    if new:
        Label.objects.get_or_create(name=new)  # keep it in the global filter set
        labels = [new] + labels  # prepend so it survives the cap
    conv.labels = labels[:8]
    conv.save(update_fields=["labels"])


def _apply_status(profile, new_status, reason=""):
    profile.status = new_status
    profile.rejection_reason = reason if new_status == "rejected" else ""
    profile.save(update_fields=["status", "rejection_reason", "updated_at"])
    _assign_status_label(profile.user, new_status)


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
        "photos":        [{"id": p.id, "url": p.image.url} for p in user.photos.all()],
        **ProfileSerializer(profile).data,
    })


def _match_summary(p: Profile) -> dict:
    return {
        "telegram_id":       p.user_id,
        "full_name":         p.full_name,
        "age":               p.age,
        "birthplace_region": p.birthplace_region,
        "status":            p.status,
        "tariff":            p.tariff,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def anketa_matches(request, telegram_id: int):
    """List / add the candidates assigned to this anketa. Adding is symmetric —
    the candidate gets this user in their matches too."""
    profile = get_object_or_404(Profile, user_id=telegram_id)

    if request.method == "POST":
        cand_id = request.data.get("candidate_id")
        try:
            cand_id = int(cand_id)
        except (TypeError, ValueError):
            return Response({"detail": "candidate_id required"}, status=http_status.HTTP_400_BAD_REQUEST)
        if cand_id == profile.user_id:
            return Response({"detail": "cannot match self"}, status=http_status.HTTP_400_BAD_REQUEST)
        candidate = get_object_or_404(Profile, user_id=cand_id)
        profile.matches.add(candidate)

    matches = profile.matches.all().order_by("full_name")
    return Response({"matches": [_match_summary(p) for p in matches]})


@api_view(["DELETE"])
@permission_classes([IsAdmin])
def anketa_match_remove(request, telegram_id: int, candidate_id: int):
    profile = get_object_or_404(Profile, user_id=telegram_id)
    try:
        candidate = profile.matches.get(user_id=candidate_id)
    except Profile.DoesNotExist:
        return Response(status=http_status.HTTP_404_NOT_FOUND)
    profile.matches.remove(candidate)
    return Response(status=http_status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAdmin])
def approve_anketa(_request, telegram_id: int):
    profile = get_object_or_404(Profile, user_id=telegram_id)
    _apply_status(profile, "approved")
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
    _apply_status(profile, "rejected", reason)
    return Response({
        "telegram_id":      profile.user_id,
        "status":           profile.status,
        "rejection_reason": profile.rejection_reason,
    })


_STATUSES = {"pending", "approved", "rejected"}


@api_view(["POST"])
@permission_classes([IsAdmin])
def set_anketa_status(request, telegram_id: int):
    """Move an anketa to any status, regardless of its current one.

    Rejecting requires a reason; pending/approved clear any prior reason."""
    profile = get_object_or_404(Profile, user_id=telegram_id)
    new_status = (request.data.get("status") or "").strip()
    if new_status not in _STATUSES:
        return Response(
            {"detail": "Invalid status."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    reason = ""
    if new_status == "rejected":
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response(
                {"detail": "Rejection reason is required."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
    _apply_status(profile, new_status, reason)
    return Response({
        "telegram_id":      profile.user_id,
        "status":           profile.status,
        "rejection_reason": profile.rejection_reason,
    })

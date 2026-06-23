from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from chat.models import Conversation, Label
from profiles.models import Profile
from profiles.serializers import MatchSerializer, ProfileSerializer

# Chat label applied to a user based on the tariff they picked in the anketa.
TARIFF_LABELS = {"basic": "20 €", "standart": "50 €"}

def _norm(value):
    return (value or "").strip().casefold()


def _match_score(me, other):
    """Heuristic similarity between two approved anketas. Higher = closer.

    Same birthplace region is the strongest signal (shared roots matter in this
    community), then age proximity, then living in the same German city."""
    score = 0
    if me.birthplace_region and me.birthplace_region == other.birthplace_region:
        score += 50
    score += max(0, 30 - abs((me.age or 0) - (other.age or 0)) * 3)
    if _norm(me.current_residence_germany) and \
            _norm(me.current_residence_germany) == _norm(other.current_residence_germany):
        score += 25
    return score


def _assign_tariff_label(user, tariff):
    """Tag the user's support thread with their tariff price (20 € / 50 €),
    replacing any previous tariff label, so admins can filter by it."""
    label = TARIFF_LABELS.get(tariff)
    if not label:
        return
    conv, _ = Conversation.objects.get_or_create(user=user)
    tariff_labels = set(TARIFF_LABELS.values())
    labels = [l for l in (conv.labels or []) if l not in tariff_labels]
    labels.append(label)
    conv.labels = labels[:8]
    conv.save(update_fields=["labels"])
    Label.objects.get_or_create(name=label)  # keep it in the global filter set


def _contact_from(user):
    """Derive the contact string from the Telegram init data (no longer asked
    in the form). Prefer @username; fall back to the numeric Telegram id."""
    username = (getattr(user, "username", "") or "").strip()
    if username:
        return f"@{username}"
    name = (getattr(user, "first_name", "") or "").strip()
    return f"{name} (ID: {user.telegram_id})" if name else f"ID: {user.telegram_id}"


@api_view(["GET", "POST", "PUT"])
def my_anketa(request):
    """Get / create / update the authenticated user's anketa.

    GET  — returns {"submitted": false} or {"submitted": true, ...}
    POST — creates (errors if already exists)
    PUT  — updates an existing profile (errors if not exists)
    """
    user = request.user
    try:
        profile = Profile.objects.get(user=user)
    except Profile.DoesNotExist:
        profile = None

    if request.method == "GET":
        if profile is None:
            return Response({"submitted": False})
        return Response({"submitted": True, **ProfileSerializer(profile).data})

    if request.method == "POST":
        if profile is not None:
            return Response(
                {"detail": "Anketa already exists. Use PUT to update."},
                status=http_status.HTTP_409_CONFLICT,
            )
        serializer = ProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=user, contact_info=_contact_from(user))
        _assign_tariff_label(user, serializer.instance.tariff)
        return Response(
            {"submitted": True, **serializer.data},
            status=http_status.HTTP_201_CREATED,
        )

    # PUT
    if profile is None:
        return Response(
            {"detail": "No anketa to update. POST first."},
            status=http_status.HTTP_404_NOT_FOUND,
        )
    serializer = ProfileSerializer(profile, data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(contact_info=_contact_from(user))
    _assign_tariff_label(user, serializer.instance.tariff)
    return Response({"submitted": True, **serializer.data})


@api_view(["GET"])
def my_matches(request):
    """Opposite-gender approved anketas, ranked by similarity to the caller's.

    Available only once the caller's own anketa is approved and has a gender.
    `available` tells the client whether the feed applies (vs. a gentle hint)."""
    try:
        me = Profile.objects.get(user=request.user)
    except Profile.DoesNotExist:
        return Response({"available": False, "matches": []})

    if me.status != "approved":
        return Response({"available": False, "reason": "not_approved", "matches": []})
    if not me.gender:
        return Response({"available": False, "reason": "no_gender", "matches": []})

    opposite = "female" if me.gender == "male" else "male"
    # every opposite-gender approved candidate, best match first (low scores still shown)
    candidates = (
        Profile.objects
        .filter(status="approved", gender=opposite)
        .exclude(user=request.user)
        .select_related("user")
        .prefetch_related("user__photos")
    )
    ranked = sorted(candidates, key=lambda p: _match_score(me, p), reverse=True)
    return Response({"available": True, "matches": MatchSerializer(ranked, many=True).data})

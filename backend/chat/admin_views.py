from django.db.models import F, Max
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsAdmin
from chat.broadcast import start_broadcast
from chat.models import Broadcast, Conversation, Label, Message
from chat.views import MAX_LEN, _messages_after, serialize_message


def serialize_broadcast(b: Broadcast) -> dict:
    return {
        "id": b.id,
        "text": b.text,
        "status": b.status,
        "total": b.total,
        "sent": b.sent,
        "failed": b.failed,
        "created_at": b.created_at.isoformat(),
        "finished_at": b.finished_at.isoformat() if b.finished_at else None,
    }


def _all_label_names() -> list[str]:
    return list(Label.objects.values_list("name", flat=True))


def _display_name(u: User) -> str:
    return f"{u.first_name} {u.last_name}".strip() or u.username or str(u.telegram_id)


@api_view(["GET"])
@permission_classes([IsAdmin])
def list_conversations(request):
    """Inbox of all users — ordered by most recent chat activity, then join date.
    Users who have never chatted still appear (sorted by join date)."""
    # Sort by the last *message* time (not conversation creation), so just opening
    # a chat — which creates an empty conversation — never reorders the list.
    users = (
        User.objects
        .select_related("conversation")
        .annotate(last_msg=Max("conversation__messages__created_at"))
        .annotate(sort_key=Coalesce(F("last_msg"), F("created_at")))
        .order_by("-sort_key")
    )

    items = []
    for u in users:
        conv = getattr(u, "conversation", None)
        last = conv.messages.last() if conv else None
        unread = 0
        if conv:
            uq = conv.messages.filter(sender=Message.USER)
            if conv.admin_last_read_at:
                uq = uq.filter(created_at__gt=conv.admin_last_read_at)
            unread = uq.count()
        when = u.last_msg or u.created_at
        items.append({
            "telegram_id":  u.telegram_id,
            "name":         _display_name(u),
            "username":     u.username,
            "last_message": last.text if last else "",
            "last_sender":  last.sender if last else None,
            "updated_at":   when.isoformat() if when else None,
            "unread":       unread,
            "labels":       conv.labels if conv else [],
        })
    return Response({
        "items": items,
        "total": len(items),
        "total_unread": sum(i["unread"] for i in items),
        "all_labels": _all_label_names(),
    })


@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def broadcasts(request):
    """List recent broadcasts (with live counts), or start a new one (POST {text})."""
    if request.method == "POST":
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Xabar bo‘sh."}, status=http_status.HTTP_400_BAD_REQUEST)
        bc = Broadcast.objects.create(
            text=text[:MAX_LEN],
            created_by=getattr(request.user, "telegram_id", None),
        )
        start_broadcast(bc.id)
        return Response(serialize_broadcast(bc), status=http_status.HTTP_201_CREATED)

    items = [serialize_broadcast(b) for b in Broadcast.objects.all()[:20]]
    return Response({"items": items, "user_count": User.objects.count()})


@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def labels(request):
    """List the global labels, or create a new one (POST {name})."""
    if request.method == "POST":
        name = str(request.data.get("name") or "").strip()[:40]
        if name:
            Label.objects.get_or_create(name=name)
    return Response({"labels": _all_label_names()})


def _clean_labels(raw) -> list[str]:
    """Normalise an incoming labels payload: trimmed, deduped, capped."""
    out: list[str] = []
    for label in raw if isinstance(raw, list) else []:
        s = str(label).strip()[:40]
        if s and s not in out:
            out.append(s)
        if len(out) >= 8:
            break
    return out


@api_view(["POST"])
@permission_classes([IsAdmin])
def set_labels(request, telegram_id: int):
    """Replace the labels on a user's conversation."""
    user = get_object_or_404(User, telegram_id=telegram_id)
    conv, _ = Conversation.objects.get_or_create(user=user)
    conv.labels = _clean_labels(request.data.get("labels"))
    conv.save(update_fields=["labels"])
    # keep the global label set in sync so assigned labels appear in filters
    for name in conv.labels:
        Label.objects.get_or_create(name=name)
    return Response({"labels": conv.labels})


@api_view(["GET", "POST"])
@permission_classes([IsAdmin])
def admin_chat(request, telegram_id: int):
    """A single user's thread from the admin side.

    GET  ?after=<id>  — messages; marks the thread read for admins.
    POST {text}       — reply as the admin team (recorded with the actual admin).
    """
    user = get_object_or_404(User, telegram_id=telegram_id)
    conv, _ = Conversation.objects.get_or_create(user=user)

    if request.method == "POST":
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Empty message."}, status=http_status.HTTP_400_BAD_REQUEST)
        msg = Message.objects.create(
            conversation=conv,
            sender=Message.ADMIN,
            author=request.user,
            text=text[:MAX_LEN],
        )
        conv.touch()
        return Response(serialize_message(msg), status=http_status.HTTP_201_CREATED)

    messages = _messages_after(conv, request.query_params.get("after"))
    conv.admin_last_read_at = timezone.now()
    conv.save(update_fields=["admin_last_read_at"])
    return Response({
        "messages": [serialize_message(m) for m in messages],
        "user": {
            "telegram_id": user.telegram_id,
            "name":        _display_name(user),
            "username":    user.username,
        },
        "labels": conv.labels,
    })

from datetime import timedelta

from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from chat.models import Conversation, Message
from chat.notifications import notify_admin_group_new_message
from profiles.photo_views import _to_avif

MAX_LEN = 4000


def serialize_message(m: Message, conv: "Conversation | None" = None) -> dict:
    # A message is "read" once the *other* party's last-read time has caught up to
    # it: a user message is read when admins last read at/after it was sent, and an
    # admin message is read when the user last read at/after it was sent. Drives the
    # ✓/✓✓ receipt the sender sees on their own bubbles.
    read = False
    if conv is not None:
        recipient_last_read = (
            conv.admin_last_read_at if m.sender == Message.USER else conv.user_last_read_at
        )
        read = recipient_last_read is not None and recipient_last_read >= m.created_at
    return {
        "id": m.id,
        "sender": m.sender,
        "text": m.text,
        "image": m.image.url if m.image else None,
        "created_at": m.created_at.isoformat(),
        "delivery_failed": m.delivery_failed,
        "read": read,
    }


def _messages_after(conv: Conversation, after: str | None) -> list[Message]:
    qs = conv.messages.all()
    if after and after.isdigit():
        qs = qs.filter(id__gt=int(after))
    return list(qs)


@api_view(["GET", "POST"])
def my_chat(request):
    """The authenticated user's support thread.

    GET  ?after=<id>  — messages (optionally only newer than <id>); marks read.
    POST {text}       — send a message from the user.
    """
    conv, _ = Conversation.objects.get_or_create(user=request.user)

    if request.method == "POST":
        text = (request.data.get("text") or "").strip()
        upload = request.FILES.get("image")
        if not text and upload is None:
            return Response({"detail": "Xabar bo‘sh."}, status=http_status.HTTP_400_BAD_REQUEST)
        image = None
        if upload is not None:
            try:
                image = _to_avif(upload)
            except Exception:
                return Response({"detail": "Rasmni o‘qib bo‘lmadi."}, status=http_status.HTTP_400_BAD_REQUEST)
        # Only ping the admin group when the user hasn't messaged in the last 12h,
        # so a burst of messages raises a single alert rather than one per message.
        window_start = timezone.now() - timedelta(hours=12)
        recently_messaged = conv.messages.filter(
            sender=Message.USER, created_at__gte=window_start
        ).exists()
        msg = Message.objects.create(
            conversation=conv,
            sender=Message.USER,
            author=request.user,
            text=text[:MAX_LEN],
            image=image,
        )
        conv.touch()
        if not recently_messaged:
            notify_admin_group_new_message(request.user, msg.text or "📷 Rasm")
        return Response(serialize_message(msg, conv), status=http_status.HTTP_201_CREATED)

    messages = _messages_after(conv, request.query_params.get("after"))
    # Opening / polling the thread marks everything the user can see as read.
    conv.user_last_read_at = timezone.now()
    conv.save(update_fields=["user_last_read_at"])
    return Response({"messages": [serialize_message(m, conv) for m in messages]})

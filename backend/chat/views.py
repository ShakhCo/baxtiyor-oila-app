from django.utils import timezone
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from chat.models import Conversation, Message
from chat.notifications import notify_admin_group_new_message

MAX_LEN = 4000


def serialize_message(m: Message) -> dict:
    return {
        "id": m.id,
        "sender": m.sender,
        "text": m.text,
        "created_at": m.created_at.isoformat(),
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
        if not text:
            return Response({"detail": "Xabar bo‘sh."}, status=http_status.HTTP_400_BAD_REQUEST)
        msg = Message.objects.create(
            conversation=conv,
            sender=Message.USER,
            author=request.user,
            text=text[:MAX_LEN],
        )
        conv.touch()
        notify_admin_group_new_message(request.user, msg.text)
        return Response(serialize_message(msg), status=http_status.HTTP_201_CREATED)

    messages = _messages_after(conv, request.query_params.get("after"))
    conv.user_last_read_at = timezone.now()
    conv.save(update_fields=["user_last_read_at"])
    return Response({"messages": [serialize_message(m) for m in messages]})

"""Auto chat label that mirrors the anketa lifecycle, so admins can filter the
support inbox by stage:

    pending  -> Kutilmoqda    (set when the user submits the anketa)
    approved -> Tasdiqlangan  (set when an admin confirms it)

The labels are mutually exclusive among the ones this machine owns; "Yakunlangan"
(completed) is applied manually by admins, so it's left untouched.
"""

from chat.models import Conversation, Label

STATUS_LABELS = {
    "pending": "Kutilmoqda",
    "approved": "Tasdiqlangan",
}
# Labels this machine owns — a transition strips the previous one. "Rad etilgan"
# is kept here only so it gets cleaned off any thread that still carries it.
_MANAGED = {"Kutilmoqda", "Tasdiqlangan", "Rad etilgan"}


def assign_status_label(user, status):
    """Set the thread's lifecycle label to the one matching `status`, replacing
    any previous lifecycle label. Other labels (e.g. Yakunlangan) are preserved."""
    conv, _ = Conversation.objects.get_or_create(user=user)
    labels = [l for l in (conv.labels or []) if l not in _MANAGED]
    new = STATUS_LABELS.get(status)
    if new:
        Label.objects.get_or_create(name=new)  # keep it in the global filter set
        labels = [new] + labels  # prepend so it survives the 8-label cap
    conv.labels = labels[:8]
    conv.save(update_fields=["labels"])

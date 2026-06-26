from django.db import migrations

# The only chat labels we keep. "Hammasi" (All) is the built-in no-filter chip in
# the admin inbox, not a stored Label — so just these three live in the table.
CANONICAL = ["Tasdiqlangan", "Kutilmoqda", "Yakunlangan"]


def set_canonical_labels(apps, schema_editor):
    Label = apps.get_model("chat", "Label")
    Conversation = apps.get_model("chat", "Conversation")

    # Global label set → exactly the canonical three.
    Label.objects.exclude(name__in=CANONICAL).delete()
    for name in CANONICAL:
        Label.objects.get_or_create(name=name)

    # Strip any now-removed label off the conversations that still carry it.
    allowed = set(CANONICAL)
    for conv in Conversation.objects.all():
        labels = conv.labels or []
        cleaned = [l for l in labels if l in allowed]
        if cleaned != labels:
            conv.labels = cleaned
            conv.save(update_fields=["labels"])


def noop(apps, schema_editor):
    # Irreversible cleanup — nothing to restore.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0008_message_image"),
    ]

    operations = [
        migrations.RunPython(set_canonical_labels, noop),
    ]

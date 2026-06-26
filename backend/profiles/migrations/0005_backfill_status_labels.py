from django.db import migrations

# Mirror of profiles/status_labels.py (migrations must not import app code).
STATUS_LABELS = {"pending": "Kutilmoqda", "approved": "Tasdiqlangan"}
_MANAGED = {"Kutilmoqda", "Tasdiqlangan", "Rad etilgan"}


def backfill(apps, schema_editor):
    Profile = apps.get_model("profiles", "Profile")
    Conversation = apps.get_model("chat", "Conversation")
    Label = apps.get_model("chat", "Label")

    for name in STATUS_LABELS.values():
        Label.objects.get_or_create(name=name)

    for p in Profile.objects.all():
        conv, _ = Conversation.objects.get_or_create(user_id=p.user_id)
        labels = [l for l in (conv.labels or []) if l not in _MANAGED]
        new = STATUS_LABELS.get(p.status)
        if new:
            labels = [new] + labels
        conv.labels = labels[:8]
        conv.save(update_fields=["labels"])

    # the legacy rejected label is no longer part of the canonical set
    Label.objects.filter(name="Rad etilgan").delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0004_profile_matches"),
        ("chat", "0009_canonical_labels"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]

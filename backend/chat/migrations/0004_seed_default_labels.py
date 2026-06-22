from django.db import migrations

DEFAULTS = ["Premium", "Muhim", "Kutilyapti", "Yangi", "Yopilgan"]


def seed(apps, schema_editor):
    Label = apps.get_model("chat", "Label")
    for name in DEFAULTS:
        Label.objects.get_or_create(name=name)


def unseed(apps, schema_editor):
    Label = apps.get_model("chat", "Label")
    Label.objects.filter(name__in=DEFAULTS).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0003_label'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]

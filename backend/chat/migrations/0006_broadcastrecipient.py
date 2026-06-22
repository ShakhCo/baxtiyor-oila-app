import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0005_broadcast"),
    ]

    operations = [
        migrations.CreateModel(
            name="BroadcastRecipient",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("telegram_id", models.BigIntegerField()),
                ("name", models.CharField(blank=True, max_length=128)),
                ("username", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(choices=[("sent", "sent"), ("failed", "failed")], max_length=8)),
                (
                    "broadcast",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recipients",
                        to="chat.broadcast",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="broadcastrecipient",
            index=models.Index(fields=["broadcast", "status"], name="bcast_recipient_status_idx"),
        ),
    ]

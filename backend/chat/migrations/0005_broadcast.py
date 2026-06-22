from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0004_seed_default_labels"),
    ]

    operations = [
        migrations.CreateModel(
            name="Broadcast",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("created_by", models.BigIntegerField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "pending"), ("running", "running"), ("done", "done")],
                        default="pending",
                        max_length=12,
                    ),
                ),
                ("total", models.IntegerField(default=0)),
                ("sent", models.IntegerField(default=0)),
                ("failed", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]

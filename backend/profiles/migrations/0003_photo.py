import django.db.models.deletion
from django.db import migrations, models

import profiles.models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("profiles", "0002_profile_gender"),
    ]

    operations = [
        migrations.CreateModel(
            name="Photo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to=profiles.models.photo_upload_to)),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="accounts.user")),
            ],
            options={
                "ordering": ["order", "created_at"],
            },
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0003_photo"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="matches",
            field=models.ManyToManyField(blank=True, to="profiles.profile"),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0006_broadcastrecipient"),
    ]

    operations = [
        migrations.AddField(
            model_name="message",
            name="delivery_failed",
            field=models.BooleanField(default=False),
        ),
    ]

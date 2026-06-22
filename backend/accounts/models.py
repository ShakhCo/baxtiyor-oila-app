from django.db import models


class User(models.Model):
    telegram_id = models.BigIntegerField(primary_key=True)
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128, blank=True, default="")
    username = models.CharField(max_length=64, blank=True, default="")
    language_code = models.CharField(max_length=8, blank=True, default="")
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)  # = Telegram join date

    @property
    def is_authenticated(self) -> bool:
        return True

    def __str__(self) -> str:
        return f"{self.telegram_id} ({self.username or self.first_name})"

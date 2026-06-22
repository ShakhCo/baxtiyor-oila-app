from django.db import models
from django.utils import timezone


class Conversation(models.Model):
    """One support thread per user. Any admin can read/reply to any thread."""

    user = models.OneToOneField(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="conversation",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Last activity (bumped only on a new message), used for ordering the inbox.
    updated_at = models.DateTimeField(default=timezone.now)
    user_last_read_at = models.DateTimeField(null=True, blank=True)
    admin_last_read_at = models.DateTimeField(null=True, blank=True)
    # Admin-assigned labels/tags for organising the inbox (list of strings).
    labels = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-updated_at"]

    def touch(self) -> None:
        self.updated_at = timezone.now()
        self.save(update_fields=["updated_at"])

    def __str__(self) -> str:
        return f"Conversation<{self.user_id}>"


class Label(models.Model):
    """A global label/tag admins can apply to conversations and filter by."""

    name = models.CharField(max_length=40, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Message(models.Model):
    USER = "user"
    ADMIN = "admin"
    SENDER_CHOICES = [(USER, "user"), (ADMIN, "admin")]

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.CharField(max_length=8, choices=SENDER_CHOICES)
    # Who actually sent it (which admin, or the user). Kept for audit.
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["conversation", "id"])]

    def __str__(self) -> str:
        return f"{self.sender}: {self.text[:40]}"

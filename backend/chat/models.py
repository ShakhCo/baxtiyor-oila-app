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


class Broadcast(models.Model):
    """A one-off message sent to every user. Processed in the background; the
    counters are updated as it runs so admins can watch progress and see the
    final tally (delivered vs failed)."""

    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    STATUS_CHOICES = [(PENDING, "pending"), (RUNNING, "running"), (DONE, "done")]

    text = models.TextField()
    created_by = models.BigIntegerField(null=True, blank=True)  # admin telegram_id
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=PENDING)
    total = models.IntegerField(default=0)
    sent = models.IntegerField(default=0)
    failed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Broadcast<{self.id} {self.status} {self.sent}/{self.total}>"


class BroadcastRecipient(models.Model):
    """Per-user delivery outcome for a broadcast (name/username denormalised so
    the report is stable even if the user later changes)."""

    SENT = "sent"
    FAILED = "failed"
    STATUS_CHOICES = [(SENT, "sent"), (FAILED, "failed")]

    broadcast = models.ForeignKey(Broadcast, on_delete=models.CASCADE, related_name="recipients")
    telegram_id = models.BigIntegerField()
    name = models.CharField(max_length=128, blank=True)
    username = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=8, choices=STATUS_CHOICES)

    class Meta:
        indexes = [models.Index(fields=["broadcast", "status"], name="bcast_recipient_status_idx")]

    def __str__(self) -> str:
        return f"{self.status}: {self.name or self.telegram_id}"


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
    # True when this (admin/broadcast) message could not be delivered to the
    # user's Telegram, so the admin sees it didn't go through.
    delivery_failed = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["conversation", "id"])]

    def __str__(self) -> str:
        return f"{self.sender}: {self.text[:40]}"

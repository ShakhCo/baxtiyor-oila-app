from django.db import models

from accounts.models import User


REGION_CHOICES = [
    ("andijon",          "Andijon"),
    ("buxoro",           "Buxoro"),
    ("fargona",          "Farg‘ona"),
    ("jizzax",           "Jizzax"),
    ("namangan",         "Namangan"),
    ("navoiy",           "Navoiy"),
    ("qashqadaryo",      "Qashqadaryo"),
    ("qoraqalpogiston",  "Qoraqalpog‘iston Respublikasi"),
    ("samarqand",        "Samarqand"),
    ("sirdaryo",         "Sirdaryo"),
    ("surxandaryo",      "Surxandaryo"),
    ("toshkent_shahar",  "Toshkent shahar"),
    ("toshkent_viloyat", "Toshkent viloyat"),
    ("xorazm",           "Xorazm"),
]

TARIFF_CHOICES = [
    ("basic",    "Basic"),
    ("standart", "Standart"),
]

GENDER_CHOICES = [
    ("male",   "Erkak"),
    ("female", "Ayol"),
]

STATUS_CHOICES = [
    ("pending",  "Pending"),
    ("approved", "Approved"),
    ("rejected", "Rejected"),
]


class Profile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="profile"
    )

    # Section 1 — about you
    full_name                 = models.CharField(max_length=255)
    # blank for the rows created before gender existed; new submissions require it
    # (enforced by the serializer / form). Drives the opposite-gender match feed.
    gender                    = models.CharField(max_length=8, choices=GENDER_CHOICES, blank=True, default="")
    age                       = models.PositiveSmallIntegerField()
    birthplace_region         = models.CharField(max_length=32, choices=REGION_CHOICES)
    current_residence_germany = models.CharField(max_length=255)
    height_weight             = models.CharField(max_length=128, blank=True, default="")

    # Section 2 — education & profession
    education                 = models.CharField(max_length=512)
    profession_hobbies        = models.TextField()

    # Section 3 — family
    marital_status            = models.TextField()
    family_info               = models.TextField()
    nationality_languages     = models.TextField()
    religion                  = models.TextField(blank=True, default="")

    # Section 4 — life in Germany
    germany_status            = models.TextField(blank=True, default="")

    # Section 5 — personality
    self_description          = models.TextField()
    partner_expectations      = models.TextField()

    # Section 6 — contact & tariff
    contact_info              = models.CharField(max_length=255)
    tariff                    = models.CharField(max_length=16, choices=TARIFF_CHOICES)

    # Admin-assigned candidates this user may see. Symmetric: adding B to A's
    # matches automatically lets B see A too (no auto-matching).
    matches                   = models.ManyToManyField("self", blank=True)

    # Lifecycle
    status                    = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    rejection_reason          = models.TextField(blank=True, default="")
    created_at                = models.DateTimeField(auto_now_add=True)
    updated_at                = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.telegram_id} — {self.full_name}"


def photo_upload_to(instance, filename):
    return f"photos/{instance.user_id}/{filename}"


class Photo(models.Model):
    """An anketa photo, stored as AVIF. Tied to the user (not the Profile) so it
    can be uploaded before the anketa is submitted. Up to 5 per user."""

    MAX_PER_USER = 5

    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name="photos")
    image      = models.ImageField(upload_to=photo_upload_to)
    order      = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"Photo<{self.pk}> of {self.user_id}"

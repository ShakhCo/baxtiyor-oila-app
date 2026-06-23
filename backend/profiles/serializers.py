from rest_framework import serializers

from profiles.models import GENDER_CHOICES, REGION_CHOICES, Profile

_REGION_LABELS = dict(REGION_CHOICES)


class ProfileSerializer(serializers.ModelSerializer):
    # required on submit even though the model allows blank (blank is only for
    # the rows that predate the field) — new/edited anketas must pick a gender
    gender = serializers.ChoiceField(choices=GENDER_CHOICES)

    class Meta:
        model = Profile
        fields = [
            "full_name",
            "gender",
            "age",
            "birthplace_region",
            "current_residence_germany",
            "height_weight",
            "education",
            "profession_hobbies",
            "marital_status",
            "family_info",
            "nationality_languages",
            "religion",
            "germany_status",
            "self_description",
            "partner_expectations",
            "contact_info",
            "tariff",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = (
            # derived from the Telegram init data on the server, not sent by client
            "contact_info",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        )


class MatchSerializer(serializers.ModelSerializer):
    """A matched candidate shown to an approved user. Intentionally omits
    contact_info and tariff so connecting still goes through the admin."""

    region_label = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "full_name",
            "gender",
            "age",
            "birthplace_region",
            "region_label",
            "current_residence_germany",
            "height_weight",
            "education",
            "profession_hobbies",
            "marital_status",
            "family_info",
            "nationality_languages",
            "religion",
            "germany_status",
            "self_description",
            "partner_expectations",
            "photos",
        ]

    def get_region_label(self, obj):
        return _REGION_LABELS.get(obj.birthplace_region, obj.birthplace_region)

    def get_photos(self, obj):
        return [{"id": p.id, "url": p.image.url} for p in obj.user.photos.all()]

from rest_framework import serializers

from profiles.models import GENDER_CHOICES, REGION_CHOICES, Profile

_REGION_LABELS = dict(REGION_CHOICES)


class ProfileSerializer(serializers.ModelSerializer):
    # required on submit even though the model allows blank (blank is only for
    # the rows that predate the field) — new/edited anketas must pick a gender
    gender = serializers.ChoiceField(choices=GENDER_CHOICES)

    # Server-side validation mirroring the mini-app form (web/.../AnketaPage.tsx):
    # the client can be bypassed, so the wrong/empty/over-long values are rejected
    # here too. birthplace_region / tariff already validate against their model
    # choices via ModelSerializer.
    age = serializers.IntegerField(min_value=18, max_value=99)
    full_name = serializers.CharField(max_length=100)
    current_residence_germany = serializers.CharField(min_length=2, max_length=120)
    education = serializers.CharField(min_length=2, max_length=500)
    profession_hobbies = serializers.CharField(min_length=2, max_length=2000)
    marital_status = serializers.CharField(min_length=2, max_length=2000)
    family_info = serializers.CharField(min_length=2, max_length=2000)
    nationality_languages = serializers.CharField(min_length=2, max_length=2000)
    self_description = serializers.CharField(min_length=2, max_length=2000)
    partner_expectations = serializers.CharField(min_length=2, max_length=2000)
    height_weight = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    religion = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    germany_status = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    def validate_full_name(self, value):
        v = value.strip()
        if len(v) < 3:
            raise serializers.ValidationError("Ism-sharif kamida 3 ta harfdan iborat bo‘lsin.")
        if any(ch.isdigit() for ch in v):
            raise serializers.ValidationError("Ism-sharifda raqam bo‘lmasin.")
        if not any(ch.isalpha() for ch in v):
            raise serializers.ValidationError("Ism-sharifda faqat harflar bo‘lsin.")
        return v

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

    id = serializers.IntegerField(source="user_id", read_only=True)
    region_label = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
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

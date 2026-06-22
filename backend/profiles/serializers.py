from rest_framework import serializers

from profiles.models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "full_name",
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

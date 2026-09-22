from organization.utility.organization import get_organizationtag_name
from django.utils.translation import get_language
from rest_framework import serializers

from organization.models import (
    OrganizationTagging,
    OrganizationTags,
)


# TODO: Rename it to Organization types
class OrganizationTaggingSerializer(serializers.ModelSerializer):
    organization_tag = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationTagging
        fields = ("organization_tag",)

    def get_organization_tag(self, obj):
        serializer = OrganizationTagsSerializer(obj.organization_tag)
        return serializer.data


# TODO: rename it to organization types
class OrganizationTagsSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    original_name = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationTags
        fields = (
            "id",
            "name",
            "hide_get_involved",
            "original_name",
            "parent_tag",
            "additional_info",
        )

    def get_name(self, obj):
        return get_organizationtag_name(obj, get_language())

    def get_original_name(self, obj):
        return obj.name

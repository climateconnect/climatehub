from organization.utility.status import (
    get_project_type_name,
    get_project_type_helptext,
)
from django.utils.translation import get_language
from rest_framework import serializers


class ProjectTypesSerializer(serializers.Serializer):
    name = serializers.SerializerMethodField()
    original_name = serializers.SerializerMethodField()
    help_text = serializers.SerializerMethodField()
    icon = serializers.CharField()
    type_id = serializers.CharField()

    def get_name(self, obj):
        return get_project_type_name(obj, get_language())

    def get_original_name(self, obj):
        return obj.name

    def get_type_id(self, obj):
        return obj.type_id

    def get_help_text(self, obj):
        return get_project_type_helptext(obj, get_language())

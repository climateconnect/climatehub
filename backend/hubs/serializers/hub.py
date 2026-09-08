from django.utils.translation import get_language
from rest_framework import serializers

from climateconnect_api.models import UserProfile
from climateconnect_api.serializers.user import UserProfileStubSerializer
from climateconnect_api.utility.translation import get_attribute_in_correct_language
from hubs.models import (
    Hub,
    HubAmbassador,
    HubStat,
    HubSupporter,
    HubTheme,
    HubThemeColor,
)
from hubs.utility.hub import (
    get_hub_attribute,
    get_hub_stat_attribute,
    get_hub_supporter_attribute,
)
from location.serializers import LocationSerializer


class HubSerializer(serializers.ModelSerializer):
    stats = serializers.SerializerMethodField()
    hub_type = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    headline = serializers.SerializerMethodField()
    sub_headline = serializers.SerializerMethodField()
    welcome_message_logged_in = serializers.SerializerMethodField()
    welcome_message_logged_out = serializers.SerializerMethodField()
    segway_text = serializers.SerializerMethodField()
    image_attribution = serializers.SerializerMethodField()
    quick_info = serializers.SerializerMethodField()
    stat_box_title = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    parent_hub = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = Hub
        fields = (
            "name",
            "headline",
            "image",
            "quick_info",
            "stats",
            "sub_headline",
            "welcome_message_logged_in",
            "welcome_message_logged_out",
            "segway_text",
            "stat_box_title",
            "image_attribution",
            "hub_type",
            "location",
            "url_slug",
            "custom_footer_image",
            "landing_page_component",
            "parent_hub",
            "children",
        )

    def get_stats(self, obj):
        return HubStatSerializer(obj.stats, many=True).data

    def get_hub_type(self, obj):
        return Hub.HUB_TYPES[obj.hub_type][1]

    def get_sub_headline(self, obj):
        return get_hub_attribute(obj, "sub_headline", get_language())

    def get_welcome_message_logged_in(self, obj):
        return get_hub_attribute(obj, "welcome_message_logged_in", get_language())

    def get_welcome_message_logged_out(self, obj):
        return get_hub_attribute(obj, "welcome_message_logged_out", get_language())

    def get_segway_text(self, obj):
        return get_hub_attribute(obj, "segway_text", get_language())

    def get_image_attribution(self, obj):
        return get_hub_attribute(obj, "image_attribution", get_language())

    def get_name(self, obj):
        return get_hub_attribute(obj, "name", get_language())

    def get_headline(self, obj):
        return get_hub_attribute(obj, "headline", get_language())

    def get_quick_info(self, obj):
        return get_hub_attribute(obj, "quick_info", get_language())

    def get_stat_box_title(self, obj):
        return get_hub_attribute(obj, "stat_box_title", get_language())

    def get_location(self, obj):
        if obj.location:
            return LocationSerializer(obj.location.all(), many=True).data
        return None

    def get_parent_hub(self, obj):
        if not obj.parent_hub:
            return None
        return HubStubSerializer(obj.parent_hub).data

    def get_children(self, obj):
        return HubStubSerializer(obj.sub_hubs.all(), many=True).data


class HubAmbassadorSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    custom_message = serializers.SerializerMethodField()
    custom_ambassador_box_text = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()

    class Meta:
        model = HubAmbassador
        fields = ("title", "custom_message", "custom_ambassador_box_text", "user")

    def get_title(self, obj):
        return get_attribute_in_correct_language(obj, "title", get_language())

    def get_custom_message(self, obj):
        return get_attribute_in_correct_language(obj, "custom_message", get_language())

    def get_custom_ambassador_box_text(self, obj):
        return get_attribute_in_correct_language(
            obj, "custom_ambassador_box_text", get_language()
        )

    def get_user(self, obj):
        user = UserProfile.objects.filter(user_id=obj.user.id)
        if user.exists():
            return UserProfileStubSerializer(user[0]).data


class HubStubSerializer(serializers.ModelSerializer):
    hub_type = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    quick_info = serializers.SerializerMethodField()

    class Meta:
        model = Hub
        fields = (
            "name",
            "thumbnail_image",
            "quick_info",
            "url_slug",
            "hub_type",
            "icon",
            "icon_background_color",
            "landing_page_component",
        )

    def get_hub_type(self, obj):
        return Hub.HUB_TYPES[obj.hub_type][1]

    def get_name(self, obj):
        return get_hub_attribute(obj, "name", get_language())

    def get_quick_info(self, obj):
        return get_hub_attribute(obj, "quick_info", get_language())


class HubStatSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()
    value_description = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    source_name = serializers.SerializerMethodField()

    class Meta:
        model = HubStat
        fields = (
            "name",
            "value",
            "value_description",
            "description",
            "source_name",
            "source_link",
        )

    def get_name(self, obj):
        return get_hub_stat_attribute(obj, "name", get_language())

    def get_value(self, obj):
        return get_hub_stat_attribute(obj, "value", get_language())

    def get_value_description(self, obj):
        return get_hub_stat_attribute(obj, "value_description", get_language())

    def get_description(self, obj):
        return get_hub_stat_attribute(obj, "description", get_language())

    def get_source_name(self, obj):
        return get_hub_stat_attribute(obj, "source_name", get_language())


class HubSupporterSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    subtitle = serializers.SerializerMethodField()
    organization_url_slug = serializers.SerializerMethodField()

    class Meta:
        model = HubSupporter
        fields = (
            "name",
            "subtitle",
            "logo",
            "importance",
            "organization_url_slug",
            "standalone_image",
        )

    def get_name(self, obj):
        return get_hub_supporter_attribute(obj, "name", get_language())

    def get_subtitle(self, obj):
        return get_hub_supporter_attribute(obj, "subtitle", get_language())

    def get_logo(self, obj):
        return obj.logo

    def get_importance(self, obj):
        return obj.importance

    def get_organization_url_slug(self, obj):
        if obj.organization:
            return obj.organization.url_slug
        return None


class HubThemeColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = HubThemeColor
        fields = ["main", "light", "extraLight", "contrastText"]


class HubThemeSerializer(serializers.ModelSerializer):
    primary = HubThemeColorSerializer()
    secondary = HubThemeColorSerializer()
    background_default = HubThemeColorSerializer()
    header_background = HubThemeColorSerializer()

    class Meta:
        model = HubTheme
        fields = ["primary", "secondary", "background_default", "header_background"]

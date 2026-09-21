from django.contrib import admin

from hubs.models import (
    Hub,
    HubStat,
    HubTranslation,
    HubStatTranslation,
    HubAmbassador,
    HubSupporter,
    HubSupporterTranslation,
    HubTheme,
    HubThemeColor,
)


class HubAdmin(admin.ModelAdmin):
    list_display = ("name", "url_slug", "hub_type", "parent_hub", "importance")
    list_filter = ("hub_type",)
    search_fields = ("name", "url_slug")
    list_select_related = ("parent_hub",)


admin.site.register(Hub, HubAdmin)

admin.site.register(HubStat, admin.ModelAdmin)

admin.site.register(HubTranslation, admin.ModelAdmin)

admin.site.register(HubStatTranslation, admin.ModelAdmin)

admin.site.register(HubAmbassador, admin.ModelAdmin)

admin.site.register(HubSupporter, admin.ModelAdmin)

admin.site.register(HubSupporterTranslation, admin.ModelAdmin)

admin.site.register(HubTheme, admin.ModelAdmin)

admin.site.register(HubThemeColor, admin.ModelAdmin)

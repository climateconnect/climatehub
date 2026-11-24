from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html, format_html_join

from climateconnect_api.models import (
    UserProfile,
    Availability,
    Skill,
    Role,
    UserProfileTranslation,
)
from climateconnect_api.models.common import Feedback
from climateconnect_api.models.faq import FaqSection, FaqQuestion
from climateconnect_api.models.notification import (
    Notification,
    UserNotification,
    EmailNotification,
)
from climateconnect_api.models.donation import Donation, DonationGoal
from climateconnect_api.models.language import Language
from climateconnect_api.models.badge import Badge, DonorBadge, UserBadge
from climateconnect_api.models.content_shares import ContentShares
from climateconnect_api.models.rich_text_image import (
    RichTextImage,
    RichTextImageUsage,
)

pass_through_models = (
    Availability,
    Role,
    FaqSection,
    FaqQuestion,
    Notification,
    UserNotification,
    EmailNotification,
    Donation,
    Badge,
    DonorBadge,
    UserBadge,
    ContentShares,
)

for model in pass_through_models:
    admin.site.register(model, admin.ModelAdmin)


class FeedbackAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user",
        "email",
        "text_preview",
        "path",
        "send_response",
        "created_at",
    ]
    list_filter = ["send_response", "created_at"]
    search_fields = [
        "text",
        "email",
        "path",
        "user__email",
        "user__first_name",
        "user__last_name",
    ]
    readonly_fields = ["user_agent", "path", "created_at", "updated_at"]
    ordering = ["-created_at"]

    def text_preview(self, obj):
        return obj.text[:50] + "..." if len(obj.text) > 50 else obj.text

    text_preview.short_description = "Feedback Text"


admin.site.register(Feedback, FeedbackAdmin)


class DonationGoalAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "hub",
        "start_date",
        "end_date",
        "current_amount",
        "goal_amount",
        "twingle_project_id",
        "twingle_last_delivery_at",
    ]
    # Set by the Twingle webhook only (doc/twingle-donation-webhook.md).
    readonly_fields = ["twingle_last_delivery_at"]


admin.site.register(DonationGoal, DonationGoalAdmin)


class UserProfileAdmin(admin.ModelAdmin):
    search_fields = ("name",)


admin.site.register(UserProfile, UserProfileAdmin)


class SkillAdmin(admin.ModelAdmin):
    search_fields = ("name",)


admin.site.register(Skill, SkillAdmin)


class LanguageAdmin(admin.ModelAdmin):
    search_fields = ("name", "language_code", "native_name")


admin.site.register(Language, LanguageAdmin)


class UserProfileTranslationAdmin(admin.ModelAdmin):
    search_fields = (
        "user_profile__user__first_name",
        "user_profile__user__last_name",
        "user_profile__name",
        "name_translation",
    )


admin.site.register(UserProfileTranslation, UserProfileTranslationAdmin)


class RichTextImageUsageInline(admin.TabularInline):
    model = RichTextImageUsage
    fields = ["project", "field", "created_at"]
    readonly_fields = fields
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class RichTextImageAdmin(admin.ModelAdmin):
    """Images uploaded into rich-text fields (spec 20260708_1302).

    Read-only: images are created by the upload endpoint, and their files and
    sizes are referenced by stored HTML. Deleting is allowed (e.g. misuse) and
    removes the files; descriptions that still use the image then show a
    broken image. The original is never linked, only the WebP variants.
    """

    list_display = [
        "id",
        "preview",
        "owner",
        "format",
        "dimensions",
        "file_size_kb",
        "usage_count",
        "created_at",
    ]
    list_filter = ["format", "created_at"]
    search_fields = [
        "owner__email",
        "owner__first_name",
        "owner__last_name",
        "usages__project__name",
        "usages__project__url_slug",
    ]
    list_select_related = ["owner"]
    ordering = ["-created_at"]
    inlines = [RichTextImageUsageInline]
    fields = [
        "preview",
        "usage_warning",
        "owner",
        "format",
        "dimensions",
        "file_size_kb",
        "variant_links",
        "created_at",
    ]
    readonly_fields = fields

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_usage_count=Count("usages"))

    def has_add_permission(self, request):
        return False

    def _variant_url(self, obj, variant):
        return obj.original.storage.url(variant["name"])

    @admin.display(description="Preview")
    def preview(self, obj):
        if not obj.variants:
            return "-"
        return format_html(
            '<img src="{}" style="max-width:160px;max-height:120px" alt="">',
            self._variant_url(obj, obj.variants[0]),
        )

    @admin.display(description="Size (px)")
    def dimensions(self, obj):
        return f"{obj.width} × {obj.height}"

    @admin.display(description="File size (KB)", ordering="file_size")
    def file_size_kb(self, obj):
        return round(obj.file_size / 1024)

    @admin.display(description="Used in", ordering="_usage_count")
    def usage_count(self, obj):
        return obj._usage_count

    @admin.display(description="Variants")
    def variant_links(self, obj):
        return format_html_join(
            ", ",
            '<a href="{}" target="_blank" rel="noopener noreferrer">{} px</a>',
            ((self._variant_url(obj, v), v["width"]) for v in obj.variants),
        )

    @admin.display(description="Note")
    def usage_warning(self, obj):
        if not obj.usages.exists():
            return "Not used anywhere."
        return format_html(
            "<strong>{}</strong>",
            "Still used (see below). Deleting it leaves a broken image in those"
            " descriptions.",
        )


admin.site.register(RichTextImage, RichTextImageAdmin)

from django.contrib import admin

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

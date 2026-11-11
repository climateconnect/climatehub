import logging

from django.core.cache import cache
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from climateconnect_api.models.common import Availability, Skill
from climateconnect_api.models.language import Language
from location.models import Location

logger = logging.getLogger(__name__)


def profile_image_path(instance, filename):
    return "profile_pictures/{}/{}".format(instance.id, filename)


def background_image_path(instance, filename):
    return "background_images/{}/{}".format(instance.id, filename)


class UserProfile(models.Model):
    user = models.OneToOneField(
        "auth.User",
        help_text="Points to user table",
        on_delete=models.CASCADE,
        verbose_name="User",
        related_name="user_profile",
    )

    name = models.CharField(
        help_text="user.first_name+' '+user.last_name",
        verbose_name="Full name",
        max_length=256,
        null=True,
        blank=True,
    )

    url_slug = models.CharField(
        help_text="slug for user URL",
        verbose_name="URL Slug",
        max_length=512,
        unique=True,
        null=True,
        blank=True,
    )

    # Keeping this column blank. User may not want to upload their profile picture.
    image = models.ImageField(
        help_text="Points to user's profile picture",
        verbose_name="Profile Image",
        upload_to=profile_image_path,
        null=True,
        blank=True,
    )

    thumbnail_image = models.ImageField(
        help_text="The small image that shows on the user preview",
        verbose_name="Thumbnail Image",
        upload_to=profile_image_path,
        null=True,
        blank=True,
    )

    background_image = models.ImageField(
        help_text="Points to user's background image",
        verbose_name="Background Image",
        upload_to=background_image_path,
        null=True,
        blank=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    country = models.CharField(
        help_text="User's country",
        verbose_name="Country",
        max_length=256,
        blank=True,
        null=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    state = models.CharField(
        help_text="User's state",
        verbose_name="State",
        max_length=512,
        null=True,
        blank=True,
    )

    # Field not in use. Keeping temporarily for backwards compatibility
    city = models.CharField(
        help_text="User's city",
        verbose_name="City",
        max_length=512,
        null=True,
        blank=True,
    )

    location = models.ForeignKey(
        Location,
        help_text="Points to the user's location",
        verbose_name="Location",
        related_name="user_profile_loc",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    biography = models.TextField(
        help_text="Points to user's bio", verbose_name="bio", null=True, blank=True
    )

    created_at = models.DateTimeField(
        help_text="Time when object first created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when profile was updated",
        verbose_name="Update at",
        auto_now=True,
    )

    is_profile_verified = models.BooleanField(
        help_text="Checks whether user's profile is verfied or not",
        verbose_name="Is profile verified",
        default=False,
    )

    verification_key = models.UUIDField(
        help_text="On signup create a unique key that will be used for user's profile verification",
        verbose_name="Verification Key",
        null=True,
        blank=True,
        unique=True,
    )

    availability = models.ForeignKey(
        Availability,
        help_text="Points to user's availability for a work",
        verbose_name="Availability",
        null=True,
        blank=True,
        related_name="user_availability",
        on_delete=models.PROTECT,
    )

    skills = models.ManyToManyField(
        Skill,
        help_text="Points to user's skills",
        verbose_name="Skills",
        related_name="user_skills",
        blank=True,
    )

    send_newsletter = models.BooleanField(
        help_text="Check if user wants to receive our newsletter",
        verbose_name="Send newsletter",
        null=True,
        blank=True,
        default=True,
    )

    email_on_private_chat_message = models.BooleanField(
        help_text="Check if user wants to receive emails when they receive a private chat message",
        verbose_name="Email on private chat message",
        null=True,
        blank=True,
        default=True,
    )

    email_on_group_chat_message = models.BooleanField(
        help_text="Check if user wants to receive emails when they receive a group chat message",
        verbose_name="Email on group chat message",
        null=True,
        blank=True,
        default=True,
    )

    email_on_comment_on_your_project = models.BooleanField(
        help_text="Check if user wants to receive emails when they receive a comment on a project they're a member of",
        verbose_name="Email on project comment",
        null=True,
        blank=True,
        default=True,
    )

    email_on_mention = models.BooleanField(
        help_text="Check if user wants to receive emails when they are mentioned in a comment on a project",
        verbose_name="Email on mention",
        null=True,
        blank=True,
        default=True,
    )

    email_on_comment_on_your_idea = models.BooleanField(
        help_text="Check if user wants to receive emails when they receive a comment on an idea they're a member of",
        verbose_name="Email on idea comment",
        null=True,
        blank=True,
        default=True,
    )

    email_on_reply_to_your_comment = models.BooleanField(
        help_text="Check if user wants to receive emails when somebody answers to their comment on a project",
        verbose_name="Email on comment reply",
        null=True,
        blank=True,
        default=True,
    )

    email_on_new_project_follower = models.BooleanField(
        help_text="Check if user wants to receive emails when somebody follows their project",
        verbose_name="Email on new project follower",
        null=True,
        blank=True,
        default=True,
    )

    email_on_new_project_like = models.BooleanField(
        help_text="Check if user wants to receive emails when somebody likes their project",
        verbose_name="Email on new project like",
        null=True,
        blank=True,
        default=True,
    )

    email_on_idea_join = models.BooleanField(
        help_text="Check if user wants to receive emails when somebody joins an idea they are part of",
        verbose_name="Email on new idea join",
        null=True,
        blank=True,
        default=True,
    )

    email_on_join_request = models.BooleanField(
        help_text="Check if user wants to receive emails when somebody asks to join their project or organization",
        verbose_name="Email on join request",
        null=True,
        blank=True,
        default=True,
    )

    email_on_new_organization_follower = models.BooleanField(
        help_text="Check if user wants to receive emails when somebody follows their organization",
        verbose_name="Email on new organization follower",
        default=True,
    )

    email_on_new_project_from_followed_org = models.BooleanField(
        help_text="Check if user wants to receive emails when an org they follow publishes a project",
        verbose_name="Email on new organization project published",
        default=True,
    )

    has_logged_in = models.PositiveSmallIntegerField(
        help_text="Check if the user should be redirected to the edit profile page. Shows the number of logins up to 2",
        verbose_name="Number of logins up to 2",
        default=0,
    )

    pending_new_email = models.EmailField(
        help_text="If the user is in the process of changing their email, this field will show the potential new email",
        verbose_name="Potential new E-Mail address",
        null=True,
        blank=True,
    )

    password_reset_key = models.UUIDField(
        help_text="key for resetting your password",
        verbose_name="Password reset key",
        null=True,
        blank=True,
        unique=True,
    )

    password_reset_timeout = models.DateTimeField(
        help_text="Time when the password reset times out",
        verbose_name="Password reset timeout",
        auto_now_add=True,
    )

    website = models.CharField(
        help_text="Website",
        verbose_name="User's Website",
        max_length=256,
        null=True,
        blank=True,
    )

    # this project is missing an deprecation system
    # maybe we should `pdm install deprecated` or add a decorater manually

    # This field is not used by the frontend anymore as the tutorail has been removed
    # Keeping this field temporarily as it might contain useful information
    # in case of a reboot of the tutorial feature
    "DEPRECATED"
    from_tutorial = models.BooleanField(
        help_text='Check whether the user signed up by clicking the "sign up" link in the tutorial',
        verbose_name="Signed up through tutorial?",
        null=True,
        blank=True,
        default=False,
    )

    # This field is not used by the frontend anymore as the tutorail has been removed
    # Keeping this field temporarily as it might contain useful information
    # in case of a reboot of the tutorial feature
    "DEPRECATED"
    is_activist = models.CharField(
        help_text='Options: ["yes", "soon", "no"]. Soon means they said they\'re interested in becoming active.',
        verbose_name="Is already active in climate action?",
        null=True,
        blank=True,
        max_length=8,
    )

    # This field is not used by the frontend anymore as the tutorail has been removed
    # Keeping this field temporarily as it might contain useful information
    # in case of a reboot of the tutorial feature
    "DEPRECATED"
    last_completed_tutorial_step = models.SmallIntegerField(
        help_text="Last tutorial step the user completed (16=finished)",
        verbose_name="Last completed tutorial step",
        null=True,
        blank=True,
    )

    language = models.ForeignKey(
        Language,
        related_name="profile_language",
        help_text="Points to user's original language",
        verbose_name="Language",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    restricted_profile = models.BooleanField(
        help_text="Restrict user profile to perform certain actions on the platform.",
        verbose_name="Is profile restricted?",
        default=False,
    )

    # can not use:
    #
    # from ... import Hub
    # models.ManyToManyField(Hub)
    #
    # as this would create a circular import due to Hubs importing UserProfile
    # indirectly through the Project model
    related_hubs = models.ManyToManyField(
        "hubs.Hub", related_name="user_related_hubs", blank=True
    )

    class AuthMethod(models.TextChoices):
        PASSWORD = "password", "Password"
        OTP = "otp", "OTP"

    auth_method = models.CharField(
        max_length=8,
        choices=AuthMethod.choices,
        default=AuthMethod.PASSWORD,
        null=False,
        blank=False,
        help_text=(
            "Authentication method preferred by the user. "
            "'password' = password-based login (default for all existing users); "
            "'otp' = passwordless OTP-based login."
        ),
        verbose_name="Auth Method",
    )

    class Meta:
        app_label = "climateconnect_api"
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
        db_table = "climateconnect_user_profile"

    def __str__(self):
        return "%s %s [profile id: %d]" % (
            self.user.first_name,
            self.user.last_name,
            self.id,
        )


@receiver(post_save, sender=UserProfile)
def remove_cache_keys(sender, instance, created, **kwargs):
    if created:
        if hasattr(cache, "keys"):
            member_keys = cache.keys("*LIST_MEMBERS*")
            cache.delete_many(member_keys)
        else:
            logger.debug(
                "Cache backend does not support keys() – skipping member list cache invalidation."
            )


class UserProfileTranslation(models.Model):
    user_profile = models.ForeignKey(
        UserProfile,
        related_name="profile_translation",
        help_text="Points to user profile object",
        verbose_name="User profile",
        on_delete=models.CASCADE,
    )

    language = models.ForeignKey(
        Language,
        related_name="profile_translatiion_lang",
        help_text="Points to language object",
        verbose_name="Language",
        on_delete=models.CASCADE,
    )

    biography_translation = models.TextField(
        help_text="Translation of user bio",
        verbose_name="Biography translation",
        null=True,
        blank=True,
    )

    is_manual_translation = models.BooleanField(
        help_text="Did the user manually translate this or was it automatically translated with DeepL?",
        verbose_name="Is manual translation?",
        default=False,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Time when translation object was created",
        verbose_name="Created at",
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Time when translation object was updated",
        verbose_name="Updated at",
    )

    class Meta:
        verbose_name = "User profile translation"
        verbose_name_plural = "User profile translations"
        unique_together = [["user_profile", "language"]]

    def __str__(self):
        return "{}: {} translation of user {}".format(
            self.id, self.language.name, self.user_profile.name
        )

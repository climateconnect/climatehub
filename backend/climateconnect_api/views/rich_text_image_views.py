import sentry_sdk
from django.core.cache import cache
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from climateconnect_api.utility.rich_text_images import (
    RichTextImageError,
    create_rich_text_image,
    variant_urls,
)

# One Sentry event per user and hour is enough to alert the admins; a script
# hammering the endpoint must not use up the Sentry quota.
THROTTLE_ALERT_TIMEOUT = 60 * 60


class RichTextImageUploadThrottle(UserRateThrottle):
    scope = "rich_text_image_upload"


class RichTextImageUploadView(APIView):
    """Upload one image for a rich-text field.

    The image is not linked to any entity yet; that happens when the entity
    is saved with the image in its HTML.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]
    throttle_classes = [RichTextImageUploadThrottle]

    def post(self, request):
        uploaded_file = request.FILES.get("image")
        if uploaded_file is None:
            return Response(
                {"code": "missing_file", "message": "No image was sent."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            image = create_rich_text_image(uploaded_file, request.user)
        except RichTextImageError as error:
            return Response(
                {"code": error.code, "message": error.message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        variants = variant_urls(image, request)
        largest = variants[-1]
        return Response(
            {
                "id": image.id,
                # The largest variant's size: the most the page may show
                # without enlarging the image.
                "width": largest["width"],
                "height": largest["height"],
                "variants": variants,
            },
            status=status.HTTP_201_CREATED,
        )

    def throttled(self, request, wait):
        user_id = request.user.id
        if cache.add(
            f"rich_text_image_throttle_alert:{user_id}", True, THROTTLE_ALERT_TIMEOUT
        ):
            # The user id goes into a tag and the fingerprint (one Sentry issue
            # per user): _sentry_before_send removes the event's user context.
            with sentry_sdk.new_scope() as scope:
                scope.set_tag("user_id", user_id)
                scope.fingerprint = ["rich-text-image-upload-throttled", str(user_id)]
                sentry_sdk.capture_message(
                    f"Rich-text image upload rate limit hit by user {user_id}",
                    level="warning",
                )
        super().throttled(request, wait)

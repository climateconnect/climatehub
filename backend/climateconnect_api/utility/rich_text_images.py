"""
Upload and processing of images for rich-text fields (spec 20260708_1302).

An upload is validated from the file header (type, pixel count) before any
pixels are decoded, stored with its metadata removed (but otherwise unchanged),
and gets 600 and 1200 px WebP variants. Variants are generated synchronously,
because the editor needs their URLs to write the image into the HTML.
"""

import io
import logging
import uuid
import warnings

from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, UnidentifiedImageError

from climateconnect_api.models import RichTextImage
from climateconnect_main.utility.image_metadata import (
    MetadataStripError,
    read_orientation,
    strip_metadata,
)
from climateconnect_main.utility.images import (
    decode_image_or_raise,
    encode_webp_variant,
)

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 20 * 1024 * 1024
# JPEGs are decoded at a reduced scale (see decode_image_or_raise), so they can
# be much larger than PNG and WebP, which are always decoded at full size.
MAX_PIXELS = {"JPEG": 110_000_000, "PNG": 40_000_000, "WEBP": 40_000_000}
FORMAT_EXTENSIONS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
VARIANT_WIDTHS = (600, 1200)
UPLOAD_DIR = "rich_text_images"

# Orientations that swap width and height (rotated by 90 or 270 degrees).
_TRANSPOSED_ORIENTATIONS = {5, 6, 7, 8}


class RichTextImageError(Exception):
    """An upload was rejected. ``code`` is passed to the frontend."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def inspect_image(source_bytes):
    """Return ``(format, width, height)`` read from the header, without decoding pixels.

    Width and height are the upright size (after applying the orientation).
    """
    try:
        with warnings.catch_warnings():
            # Our own pixel limits apply; Pillow's warning threshold is lower
            # than the JPEG limit.
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(source_bytes)) as image:
                image_format = image.format
                width, height = image.size
    except Image.DecompressionBombError:
        raise RichTextImageError("too_many_pixels", "The image has too many pixels.")
    except (UnidentifiedImageError, OSError, ValueError):
        raise RichTextImageError(
            "unsupported_type", "The file is not a supported image."
        )

    if image_format not in MAX_PIXELS:
        raise RichTextImageError(
            "unsupported_type", "Only JPEG, PNG and WebP images are supported."
        )
    if width * height > MAX_PIXELS[image_format]:
        raise RichTextImageError("too_many_pixels", "The image has too many pixels.")
    if read_orientation(source_bytes) in _TRANSPOSED_ORIENTATIONS:
        width, height = height, width
    return image_format, width, height


def _encode_variants(source_bytes):
    """Return the WebP variants as a list of ``(bytes, width, height)``, smallest first."""
    largest = max(VARIANT_WIDTHS)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)
            image = decode_image_or_raise(source_bytes, draft_size=(largest, largest))
    except Exception:  # noqa: BLE001 – a broken file is a user error, not a bug
        raise RichTextImageError("unreadable_image", "The image could not be read.")

    variants = []
    for target in sorted({min(width, image.width) for width in VARIANT_WIDTHS}):
        data = encode_webp_variant(image, max_width=target)
        if data is None:
            raise RichTextImageError("unreadable_image", "The image could not be read.")
        # Same rounding as encode_webp_variant.
        height = (
            int(image.height * target / image.width)
            if image.width > target
            else image.height
        )
        variants.append((data, target, height))
    return variants


def create_rich_text_image(uploaded_file, owner):
    """Validate, process and store an uploaded file. Returns the new :class:`RichTextImage`.

    Raises :class:`RichTextImageError` for files that are rejected.
    """
    if uploaded_file.size > MAX_FILE_SIZE:
        raise RichTextImageError("file_too_large", "The image is larger than 20 MB.")
    source_bytes = uploaded_file.read()

    image_format, width, height = inspect_image(source_bytes)
    try:
        stripped = strip_metadata(source_bytes, image_format)
    except MetadataStripError:
        raise RichTextImageError("unreadable_image", "The image could not be read.")
    variants = _encode_variants(stripped)

    image = RichTextImage(
        owner=owner,
        width=width,
        height=height,
        file_size=len(stripped),
        format=image_format.lower(),
    )
    storage = image.original.storage
    saved_names = []
    try:
        image.original.save(
            f"{uuid.uuid4().hex}.{FORMAT_EXTENSIONS[image_format]}",
            ContentFile(stripped),
            save=False,
        )
        saved_names.append(image.original.name)
        variant_entries = []
        for data, variant_width, variant_height in variants:
            # Every variant gets its own random name: a name derived from the
            # original's would let anyone find the original from a public URL.
            name = storage.save(
                f"{UPLOAD_DIR}/{uuid.uuid4().hex}.webp", ContentFile(data)
            )
            saved_names.append(name)
            variant_entries.append(
                {"name": name, "width": variant_width, "height": variant_height}
            )
        image.variants = variant_entries
        image.save()
    except Exception:
        _delete_files(storage, saved_names)
        raise
    return image


def _delete_files(storage, names):
    for name in names:
        try:
            storage.delete(name)
        except Exception as exc:  # noqa: BLE001 – log and continue with the rest
            logger.error("rich_text_images: failed to delete %s: %s", name, exc)


def delete_image_files_on_commit(image):
    """Delete the original and all variants of *image* once the transaction commits."""
    storage = image.original.storage
    names = [image.original.name] if image.original.name else []
    names += [variant["name"] for variant in image.variants or []]
    if names:
        transaction.on_commit(lambda: _delete_files(storage, names))


def absolute_url(storage, name, request=None):
    """Public URL of a stored file. Local storage returns a path; make it absolute."""
    url = storage.url(name)
    if url.startswith("/") and request is not None:
        url = request.build_absolute_uri(url)
    return url


def variant_urls(image, request=None):
    """The variants of *image* as ``[{url, width, height}]``, smallest first."""
    storage = image.original.storage
    return [
        {
            "url": absolute_url(storage, variant["name"], request),
            "width": variant["width"],
            "height": variant["height"],
        }
        for variant in image.variants
    ]

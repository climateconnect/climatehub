"""
Utilities for server-side image processing (WebP variant generation).

All functions in this module are **storage-agnostic**: they use
``FieldFile.open()`` / ``ContentFile`` and never access ``FieldFile.path``,
so they work correctly on Azure Blob Storage (where ``.path`` raises
``NotImplementedError``) as well as on the local development filesystem.
"""

import io
import logging

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

# WebP quality (0-100) and method (0-6) per spec D4.
# Quality 80 with method 6 gives a good balance of file size and visual fidelity.
WEBP_QUALITY = 80
WEBP_METHOD = 6


def read_source_bytes(field_file):
    """Read a ``FieldFile``'s bytes through its storage backend.

    Deliberately uses ``storage.open()`` rather than ``field_file.open()``:
    ``FieldFile.open()`` caches the handle on the field and a ``with`` block then
    closes it, so a *second* call reaches ``File.open()`` on a closed handle and
    can only recover by reopening an absolute path. That makes repeated variant
    generation on one field depend on filesystem state it should not care about.
    Going through storage keeps every read independent and storage-agnostic.

    Returns ``None`` (and logs) when the file cannot be read.
    """
    try:
        with field_file.storage.open(field_file.name, "rb") as fh:
            return fh.read()
    except Exception as exc:
        logger.error(
            "read_source_bytes: could not read %s: %s",
            getattr(field_file, "name", "<unknown>"),
            exc,
        )
        return None


def generate_webp_variant(
    field_file,
    max_width=None,
    quality=WEBP_QUALITY,
    method=WEBP_METHOD,
    source_bytes=None,
):
    """Generate a resized WebP variant from an ``ImageField`` value.

    Parameters
    ----------
    field_file : django.db.models.fields.files.FieldFile
        The image field file (e.g. ``instance.image``).  Must support
        ``.open()`` / ``.name``; ``.path`` is never called.
    max_width : int | None
        Target maximum width in CSS pixels.  If ``None`` the image is
        converted to WebP *without* resizing (used for already-capped
        thumbnail images).  If the source image is narrower than
        ``max_width`` it is **not** upscaled.
    quality : int
        WebP quality level (0–100).  Defaults to :data:`WEBP_QUALITY`.
    method : int
        WebP encoding method (0–6, slower = better).  Defaults to
        :data:`WEBP_METHOD`.
    source_bytes : bytes | None
        The original image's bytes, when the caller has already read them.
        Generating several widths for one field would otherwise download the
        original once per width — on Azure that is a real egress cost during a
        backfill.  When ``None`` the bytes are read via :func:`read_source_bytes`.

    Returns
    -------
    ContentFile | None
        A ``ContentFile`` containing the WebP bytes, with a ``.name``
        attribute reflecting the derived storage path.  ``None`` is returned
        when *field_file* is falsy or the image cannot be decoded.
    """
    if not field_file:
        return None

    if source_bytes is None:
        source_bytes = read_source_bytes(field_file)
    if source_bytes is None:
        return None

    try:
        with io.BytesIO(source_bytes) as fh:
            image = Image.open(fh)
            # Respect EXIF orientation so the variant is correctly oriented.
            image = ImageOps.exif_transpose(image)

            # Resize only when the source is wider than the target (no upscaling).
            if max_width is not None and image.width > max_width:
                w_percent = max_width / float(image.width)
                h_size = int(float(image.height) * w_percent)
                image = image.resize(
                    (max_width, h_size), Image.Resampling.LANCZOS
                )

            # WebP needs a flatten-friendly mode.
            # RGBA / LA / P with transparency → keep RGBA (lossless alpha).
            # Everything else → RGB (smaller, no alpha channel).
            if image.mode in ("RGBA", "LA", "P"):
                image = image.convert("RGBA")
            elif image.mode != "RGB":
                image = image.convert("RGB")

            image_io = io.BytesIO()
            image.save(image_io, format="WEBP", quality=quality, method=method)

            # Derive the variant filename from the original storage path.
            original_name = field_file.name
            base = original_name.rsplit(".", 1)[0] if "." in original_name else original_name
            if max_width:
                variant_name = "{}_{}.webp".format(base, max_width)
            else:
                variant_name = "{}_webp.webp".format(base)

            return ContentFile(image_io.getvalue(), name=variant_name)

    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.error(
            "generate_webp_variant: could not process %s: %s",
            getattr(field_file, "name", "<unknown>"),
            exc,
        )
        return None
    except Exception as exc:  # noqa: BLE001 – log and swallow; never break a save
        logger.error(
            "generate_webp_variant: unexpected error for %s: %s",
            getattr(field_file, "name", "<unknown>"),
            exc,
        )
        return None

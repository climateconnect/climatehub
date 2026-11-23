"""
Utilities for server-side image processing (WebP variant generation).

All functions in this module are **storage-agnostic**: they use
``FieldFile.open()`` / ``ContentFile`` and never access ``FieldFile.path``,
so they work correctly on Azure Blob Storage (where ``.path`` raises
``NotImplementedError``) as well as on the local development filesystem.
"""

import io
import logging

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


def decode_image(source_bytes, name="<unknown>"):
    """Decode *source_bytes* once into an upright image ready for encoding.

    Applies the EXIF orientation and normalises the mode WebP can store:
    images with transparency (``RGBA`` / ``LA`` / ``P``) become ``RGBA``,
    everything else ``RGB``. The pixel data is loaded eagerly, so the result
    does not depend on the byte buffer staying open.

    Every width of a field is resized from this one decoded original
    (:func:`encode_webp_variant`), so a field costs one decode instead of one
    per width — and no variant is ever resized from another, already resized
    variant.

    Returns ``None`` (and logs) when the bytes cannot be decoded.
    """
    try:
        with io.BytesIO(source_bytes) as fh:
            image = Image.open(fh)
            # Respect EXIF orientation so the variants are correctly oriented.
            image = ImageOps.exif_transpose(image)
            if image.mode in ("RGBA", "LA", "P"):
                image = image.convert("RGBA")
            elif image.mode != "RGB":
                image = image.convert("RGB")
            image.load()
            return image
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.error("decode_image: could not decode %s: %s", name, exc)
        return None
    except Exception as exc:  # noqa: BLE001 – log and swallow; never break a save
        logger.error("decode_image: unexpected error for %s: %s", name, exc)
        return None


def encode_webp_variant(
    image,
    max_width=None,
    quality=WEBP_QUALITY,
    method=WEBP_METHOD,
):
    """Encode a WebP variant of a decoded image (see :func:`decode_image`).

    Parameters
    ----------
    image : PIL.Image.Image
        The decoded original. It is never modified, so the caller can derive
        several widths from the same image.
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

    Returns
    -------
    bytes | None
        The WebP bytes, or ``None`` (logged) when encoding fails. Naming and
        storing the file is up to the caller
        (:func:`climateconnect_main.utility.image_variants.generate_and_store_variants`).
    """
    try:
        # Resize only when the source is wider than the target (no upscaling).
        if max_width is not None and image.width > max_width:
            w_percent = max_width / float(image.width)
            h_size = int(float(image.height) * w_percent)
            image = image.resize((max_width, h_size), Image.Resampling.LANCZOS)

        image_io = io.BytesIO()
        image.save(image_io, format="WEBP", quality=quality, method=method)
        return image_io.getvalue()
    except Exception as exc:  # noqa: BLE001 – log and swallow; never break a save
        logger.error(
            "encode_webp_variant: could not encode width %s: %s", max_width, exc
        )
        return None

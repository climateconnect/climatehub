"""Tests for rich-text image uploads (spec 20260708_1302_rich_text_image_support.md)."""

import io
import struct
import zlib
from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from climateconnect_api.models import Language, RichTextImage, RichTextImageUsage
from climateconnect_api.utility import rich_text_images
from climateconnect_api.views import rich_text_image_views
from climateconnect_api.views.rich_text_image_views import RichTextImageUploadThrottle
from climateconnect_main.utility.image_metadata import read_orientation, strip_metadata
from organization.models import Project

SECRET_CAMERA = "SecretCamera7731"
SECRET_COMMENT = b"SecretComment7731"
SECRET_XMP = b"<x:xmpmeta>SecretXmp7731</x:xmpmeta>"
TRAILER = b"SecretTrailer7731"


def photo(width, height, mode="RGB"):
    """A photo-like image (not a flat colour, so encoders do real work)."""
    image = Image.effect_mandelbrot((width, height), (-2, -1.5, 1, 1.5), 50)
    return image.convert(mode)


def exif_bytes(orientation=1):
    exif = Image.Exif()
    exif[0x0112] = orientation
    exif[0x010F] = SECRET_CAMERA
    gps = exif.get_ifd(0x8825)
    gps[2] = (52.0, 31.0, 12.0)  # GPSLatitude
    return exif.tobytes()


def encode(image, image_format, orientation=1, **kwargs):
    buffer = io.BytesIO()
    image.save(buffer, image_format, exif=exif_bytes(orientation), **kwargs)
    return buffer.getvalue()


def jpeg_with_everything(image, orientation=1):
    """A progressive JPEG with EXIF (GPS), XMP, a comment and appended data."""
    data = encode(image, "JPEG", orientation, progressive=True, comment=SECRET_COMMENT)
    xmp = b"http://ns.adobe.com/xap/1.0/\x00" + SECRET_XMP
    app1 = b"\xff\xe1" + struct.pack(">H", len(xmp) + 2) + xmp
    return data[:2] + app1 + data[2:] + TRAILER


def assert_no_secrets(test, data):
    for secret in (SECRET_CAMERA.encode(), SECRET_COMMENT, SECRET_XMP, TRAILER):
        test.assertNotIn(secret, data)


class StripMetadataTests(TestCase):
    def assert_same_pixels(self, before, after):
        with Image.open(io.BytesIO(before)) as a, Image.open(io.BytesIO(after)) as b:
            self.assertEqual(a.size, b.size)
            self.assertEqual(a.tobytes(), b.tobytes())

    def test_jpeg_metadata_removed_pixels_unchanged(self):
        original = jpeg_with_everything(photo(400, 300))
        stripped = strip_metadata(original, "JPEG")
        assert_no_secrets(self, stripped)
        self.assert_same_pixels(original, stripped)
        self.assertEqual(read_orientation(stripped), 1)
        with Image.open(io.BytesIO(stripped)) as image:
            self.assertEqual(dict(image.getexif()), {})

    def test_jpeg_orientation_kept(self):
        stripped = strip_metadata(jpeg_with_everything(photo(400, 300), 6), "JPEG")
        assert_no_secrets(self, stripped)
        with Image.open(io.BytesIO(stripped)) as image:
            self.assertEqual(dict(image.getexif()), {0x0112: 6})

    def test_jpeg_icc_profile_kept(self):
        profile = b"\x00" * 128 + b"FakeIccProfile"
        buffer = io.BytesIO()
        photo(200, 100).save(buffer, "JPEG", icc_profile=profile, exif=exif_bytes())
        stripped = strip_metadata(buffer.getvalue(), "JPEG")
        with Image.open(io.BytesIO(stripped)) as image:
            self.assertEqual(image.info.get("icc_profile"), profile)

    def test_png_metadata_removed_pixels_unchanged(self):
        from PIL.PngImagePlugin import PngInfo

        info = PngInfo()
        info.add_text("Comment", SECRET_COMMENT.decode())
        info.add_itxt("XML:com.adobe.xmp", SECRET_XMP.decode())
        buffer = io.BytesIO()
        photo(300, 200, "RGBA").save(buffer, "PNG", pnginfo=info, exif=exif_bytes(8))
        original = buffer.getvalue() + TRAILER
        stripped = strip_metadata(original, "PNG")
        assert_no_secrets(self, stripped)
        self.assert_same_pixels(original, stripped)
        self.assertEqual(read_orientation(stripped), 8)

    def test_webp_metadata_removed_pixels_unchanged(self):
        buffer = io.BytesIO()
        photo(300, 200).save(
            buffer, "WEBP", lossless=True, exif=exif_bytes(3), xmp=SECRET_XMP
        )
        original = buffer.getvalue()
        stripped = strip_metadata(original, "WEBP")
        assert_no_secrets(self, stripped)
        self.assert_same_pixels(original, stripped)
        self.assertEqual(read_orientation(stripped), 3)

    def test_png_unknown_chunks_removed(self):
        # Keep-only list: e.g. content credentials (caBX) or vendor chunks.
        buffer = io.BytesIO()
        photo(300, 200).save(buffer, "PNG")
        original = buffer.getvalue()
        iend = original.rindex(b"IEND") - 4
        extra = b"".join(
            struct.pack(">I", len(SECRET_COMMENT))
            + chunk_type
            + SECRET_COMMENT
            + struct.pack(">I", zlib.crc32(chunk_type + SECRET_COMMENT) & 0xFFFFFFFF)
            for chunk_type in (b"caBX", b"vpAg")
        )
        original = original[:iend] + extra + original[iend:]
        stripped = strip_metadata(original, "PNG")
        self.assertNotIn(SECRET_COMMENT, stripped)
        self.assert_same_pixels(original, stripped)

    def test_webp_unknown_chunks_removed(self):
        buffer = io.BytesIO()
        photo(300, 200).save(buffer, "WEBP", lossless=True, exif=exif_bytes(1))
        clean = buffer.getvalue()
        extra = b"C2PA" + struct.pack("<I", len(SECRET_COMMENT)) + SECRET_COMMENT
        body = clean[8:] + extra
        original = b"RIFF" + struct.pack("<I", len(body)) + body
        stripped = strip_metadata(original, "WEBP")
        self.assertNotIn(SECRET_COMMENT, stripped)
        self.assert_same_pixels(clean, stripped)

    def test_webp_without_orientation_has_no_exif(self):
        buffer = io.BytesIO()
        photo(300, 200).save(buffer, "WEBP", exif=exif_bytes(1), xmp=SECRET_XMP)
        stripped = strip_metadata(buffer.getvalue(), "WEBP")
        self.assertNotIn(b"EXIF", stripped)
        self.assertNotIn(b"XMP ", stripped)
        with Image.open(io.BytesIO(stripped)) as image:
            image.load()


class UploadTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="uploader", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = reverse("rich-text-image-upload-api")

    def upload(self, data, name="photo.jpg", content_type="image/jpeg"):
        return self.client.post(
            self.url,
            {"image": SimpleUploadedFile(name, data, content_type=content_type)},
            format="multipart",
        )


class UploadEndpointTests(UploadTestCase):
    def test_requires_login(self):
        response = APIClient().post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, 401)

    def test_missing_file(self):
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "missing_file")

    def test_upload_creates_image_and_variants(self):
        response = self.upload(jpeg_with_everything(photo(3000, 2000)))
        self.assertEqual(response.status_code, 201, response.data)
        image = RichTextImage.objects.get(id=response.data["id"])

        self.assertEqual(image.owner, self.user)
        self.assertEqual((image.width, image.height), (3000, 2000))
        self.assertEqual(image.format, "jpeg")
        self.assertFalse(image.usages.exists())
        self.assertEqual((response.data["width"], response.data["height"]), (1200, 800))
        self.assertEqual(
            [(v["width"], v["height"]) for v in response.data["variants"]],
            [(600, 400), (1200, 800)],
        )

        stripped = default_storage.open(image.original.name).read()
        assert_no_secrets(self, stripped)
        self.assertEqual(image.file_size, len(stripped))
        for variant in image.variants:
            with Image.open(default_storage.open(variant["name"])) as webp:
                self.assertEqual(webp.format, "WEBP")
                self.assertEqual(webp.size, (variant["width"], variant["height"]))
                self.assertNotIn(0x0112, webp.getexif())

    def test_original_is_never_linked_or_guessable(self):
        response = self.upload(encode(photo(1600, 900), "JPEG"))
        image = RichTextImage.objects.get(id=response.data["id"])
        original_stem = image.original.name.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        self.assertNotIn(original_stem, str(response.data))
        for variant in image.variants:
            self.assertNotIn(original_stem, variant["name"])
        self.assertTrue(image.original.name.startswith("rich_text_images/"))

    def test_urls_are_absolute(self):
        response = self.upload(encode(photo(800, 600), "JPEG"))
        for variant in response.data["variants"]:
            self.assertTrue(variant["url"].startswith("http"), variant["url"])

    def test_small_image_is_not_enlarged(self):
        response = self.upload(encode(photo(400, 300), "JPEG"))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            [(v["width"], v["height"]) for v in response.data["variants"]], [(400, 300)]
        )

    def test_medium_image_gets_its_own_width(self):
        response = self.upload(encode(photo(900, 600), "JPEG"))
        self.assertEqual(
            [(v["width"], v["height"]) for v in response.data["variants"]],
            [(600, 400), (900, 600)],
        )

    def test_rotated_photo_reports_upright_size(self):
        response = self.upload(encode(photo(2000, 1500), "JPEG", orientation=6))
        image = RichTextImage.objects.get(id=response.data["id"])
        self.assertEqual((image.width, image.height), (1500, 2000))
        self.assertEqual(
            (response.data["width"], response.data["height"]), (1200, 1600)
        )

    def test_png_with_transparency(self):
        image = photo(700, 500, "RGBA")
        image.putalpha(photo(700, 500, "L"))
        response = self.upload(encode(image, "PNG"), "a.png", "image/png")
        self.assertEqual(response.status_code, 201, response.data)
        image = RichTextImage.objects.get(id=response.data["id"])
        self.assertEqual(image.format, "png")
        with Image.open(default_storage.open(image.variants[-1]["name"])) as webp:
            self.assertEqual(webp.mode, "RGBA")

    def test_webp_upload(self):
        response = self.upload(encode(photo(700, 500), "WEBP"), "a.webp", "image/webp")
        self.assertEqual(response.status_code, 201, response.data)

    def test_gif_is_rejected(self):
        buffer = io.BytesIO()
        photo(100, 100).save(buffer, "GIF")
        response = self.upload(buffer.getvalue(), "a.gif", "image/gif")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "unsupported_type")

    def test_svg_is_rejected(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        response = self.upload(svg, "a.svg", "image/svg+xml")
        self.assertEqual(response.data["code"], "unsupported_type")

    def test_type_is_detected_from_content_not_name(self):
        response = self.upload(b"not an image at all", "photo.jpg", "image/jpeg")
        self.assertEqual(response.data["code"], "unsupported_type")
        self.assertFalse(RichTextImage.objects.exists())

    def test_file_too_large(self):
        with mock.patch.object(rich_text_images, "MAX_FILE_SIZE", 1000):
            response = self.upload(encode(photo(400, 300), "JPEG"))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "file_too_large")

    def test_too_many_pixels_is_rejected_before_decoding(self):
        limits = {"JPEG": 1000, "PNG": 1000, "WEBP": 1000}
        with (
            mock.patch.object(rich_text_images, "MAX_PIXELS", limits),
            mock.patch.object(rich_text_images, "decode_image_or_raise") as decode,
        ):
            response = self.upload(encode(photo(400, 300), "JPEG"))
        self.assertEqual(response.data["code"], "too_many_pixels")
        decode.assert_not_called()

    def test_large_jpeg_is_decoded_at_reduced_size(self):
        decoded = []
        original = rich_text_images.decode_image_or_raise

        def spy(*args, **kwargs):
            image = original(*args, **kwargs)
            decoded.append(image.size)
            return image

        cases = [
            # (stored size, orientation, upright size after reduced decoding)
            ((5000, 3750), 1, (1250, 938)),
            # A wide panorama: its height alone would keep the full scale.
            ((9600, 1100), 1, (1200, 138)),
            # Rotated: reduced by the upright width (stored height).
            ((5000, 3750), 6, (1875, 2500)),
        ]
        for size, orientation, expected in cases:
            decoded.clear()
            with mock.patch.object(rich_text_images, "decode_image_or_raise", spy):
                response = self.upload(encode(photo(*size), "JPEG", orientation))
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(decoded, [expected], size)
            self.assertEqual(response.data["variants"][-1]["width"], 1200, size)

    def test_jpeg_with_extra_pictures_is_accepted(self):
        # Cameras and HDR exports store extra pictures in an MPF block (MPO).
        buffer = io.BytesIO()
        photo(800, 600).save(
            buffer, "MPO", save_all=True, append_images=[photo(400, 300)]
        )
        with Image.open(io.BytesIO(buffer.getvalue())) as check:
            self.assertEqual(check.format, "MPO")
        response = self.upload(buffer.getvalue())
        self.assertEqual(response.status_code, 201, response.data)
        image = RichTextImage.objects.get(id=response.data["id"])
        self.assertEqual(image.format, "jpeg")
        self.assertTrue(image.original.name.endswith(".jpg"))
        with Image.open(default_storage.open(image.original.name)) as stored:
            self.assertEqual(stored.format, "JPEG")
            self.assertEqual(stored.size, (800, 600))

    def test_corrupt_image_is_a_user_error_not_logged(self):
        data = encode(photo(800, 600), "JPEG")
        truncated = data[: len(data) // 2]
        with self.assertNoLogs("climateconnect_main.utility.images", level="ERROR"):
            response = self.upload(truncated)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "unreadable_image")
        self.assertFalse(RichTextImage.objects.exists())


class UploadThrottleTests(UploadTestCase):
    def test_throttle_and_one_sentry_event_per_user(self):
        rates = {"rich_text_image_upload": "2/hour"}
        data = encode(photo(300, 200), "JPEG")
        with (
            mock.patch.object(RichTextImageUploadThrottle, "THROTTLE_RATES", rates),
            mock.patch.object(
                rich_text_image_views.sentry_sdk, "capture_message"
            ) as capture,
        ):
            statuses = [self.upload(data).status_code for _ in range(4)]

        self.assertEqual(statuses, [201, 201, 429, 429])
        capture.assert_called_once()
        self.assertEqual(capture.call_args.kwargs["level"], "warning")

    def test_production_rate(self):
        self.assertEqual(RichTextImageUploadThrottle().get_rate(), "20/hour")


class DeletionTests(UploadTestCase):
    def setUp(self):
        super().setUp()
        language = Language.objects.get(language_code="en")
        self.project = Project.objects.create(
            name="Project", url_slug="rich-text-images-project", language=language
        )

    def create_image(self):
        response = self.upload(encode(photo(800, 600), "JPEG"))
        return RichTextImage.objects.get(id=response.data["id"])

    def file_names(self, image):
        return [image.original.name] + [v["name"] for v in image.variants]

    def test_deleting_image_removes_files(self):
        image = self.create_image()
        names = self.file_names(image)
        with self.captureOnCommitCallbacks(execute=True):
            image.delete()
        for name in names:
            self.assertFalse(default_storage.exists(name), name)

    def test_deleting_project_unlinks_but_keeps_image(self):
        image = self.create_image()
        RichTextImageUsage.objects.create(
            image=image,
            project=self.project,
            field=RichTextImageUsage.PROJECT_DESCRIPTION,
        )
        self.project.delete()
        self.assertTrue(RichTextImage.objects.filter(id=image.id).exists())
        self.assertFalse(image.usages.exists())

    def test_deleting_user_deletes_unused_and_keeps_used_images(self):
        used = self.create_image()
        unused = self.create_image()
        RichTextImageUsage.objects.create(
            image=used,
            project=self.project,
            field=RichTextImageUsage.PROJECT_DESCRIPTION,
        )
        unused_names = self.file_names(unused)

        with self.captureOnCommitCallbacks(execute=True):
            self.user.delete()

        self.assertFalse(RichTextImage.objects.filter(id=unused.id).exists())
        for name in unused_names:
            self.assertFalse(default_storage.exists(name), name)
        used.refresh_from_db()
        self.assertIsNone(used.owner)
        self.assertTrue(default_storage.exists(used.original.name))


class AdminTests(UploadTestCase):
    def setUp(self):
        super().setUp()
        self.admin = User.objects.create_superuser(username="admin", password="x")
        self.client.force_login(self.admin)

    def test_list_and_detail_pages_never_show_the_original(self):
        response = self.upload(encode(photo(800, 600), "JPEG"))
        image = RichTextImage.objects.get(id=response.data["id"])
        language = Language.objects.get(language_code="en")
        project = Project.objects.create(
            name="Admin project", url_slug="admin-rich-text", language=language
        )
        RichTextImageUsage.objects.create(
            image=image, project=project, field=RichTextImageUsage.PROJECT_DESCRIPTION
        )

        pages = [
            reverse("admin:climateconnect_api_richtextimage_changelist"),
            reverse("admin:climateconnect_api_richtextimage_change", args=[image.id]),
        ]
        for url in pages:
            page = self.client.get(url)
            self.assertEqual(page.status_code, 200, url)
            content = page.content.decode()
            self.assertIn(image.variants[0]["name"], content)
            self.assertNotIn(image.original.name, content)

        detail = self.client.get(pages[1]).content.decode()
        self.assertIn("Admin project", detail)
        self.assertIn("Still used", detail)

    def test_images_cannot_be_added_in_the_admin(self):
        page = self.client.get(reverse("admin:climateconnect_api_richtextimage_add"))
        self.assertEqual(page.status_code, 403)

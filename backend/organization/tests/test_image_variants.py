"""
Tests for WebP image-variant generation, dispatch, and backfill.

Covers acceptance criteria:
  - Variant generation produces WebP variants.
  - Variant generation is storage-agnostic (never accesses ``.path``).
  - Variant generation never fails a save (errors are logged, original intact).
  - Celery tasks fire only on changed image fields.
  - Backfill command is idempotent and re-runnable.
"""

import shutil
import tempfile
from base64 import b64encode
from unittest.mock import patch as mock_patch

from django.test import override_settings

from django.core.files.base import ContentFile
from io import BytesIO
from PIL import Image
from rest_framework.test import APITestCase

from climateconnect_api.models import Language
from organization.models import Organization, Project
from django.core.management import call_command

# ---------------------------------------------------------------------------
# Test media root
# ---------------------------------------------------------------------------


class TempMediaRootMixin:
    """Give each test class its own ``MEDIA_ROOT``.

    These tests write real files through the storage backend, and ``MEDIA_ROOT``
    comes from the environment pointing at the developer's media directory, so
    without an override every run litters it with test images.

    The directory has to be created **per class, in the process that runs it**.
    ``manage.py test --parallel`` (what CI runs) forks workers that inherit
    module-level state, and the cloned test databases hand out colliding primary
    keys — so one shared directory means two workers writing
    ``projects/42/image.jpeg`` at the same time, deleting each other's variants,
    tripping ``storage.save()``'s collision-suffix path, and a module-level
    teardown removing a directory other workers are still using. Django assigns
    a whole TestCase class to one worker, so per-class isolation is enough.
    """

    @classmethod
    def setUpClass(cls):
        cls._media_root = tempfile.mkdtemp(prefix="cc-image-variants-tests-")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._media_override.enable()
        try:
            super().setUpClass()
        except Exception:
            cls._media_override.disable()
            shutil.rmtree(cls._media_root, ignore_errors=True)
            raise

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media_override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_test_image(width=2000, height=1000, mode="RGB", color="red", format="PNG"):
    """Return a ``ContentFile`` containing a test image of the given size."""
    img = Image.new(mode, (width, height), color)
    buf = BytesIO()
    img.save(buf, format=format)
    buf.seek(0)
    return ContentFile(buf.getvalue(), name="test_image.{}".format(format.lower()))


def make_exif_test_image(width=800, height=600, orientation=6):
    """Return a JPEG ``ContentFile`` with an EXIF orientation tag.

    Orientation 6 means the image data is stored rotated 90°, so the
    displayed image should be width=600, height=800 after transposition.
    """
    img = Image.new("RGB", (width, height), "blue")
    exif = img.getexif()
    exif[274] = orientation  # 274 = ExifImageWidth orientation tag
    buf = BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes())
    buf.seek(0)
    return ContentFile(buf.getvalue(), name="exif_test.jpg")


def make_png_with_alpha(width=400, height=300):
    """Return a PNG ``ContentFile`` with an alpha channel (RGBA)."""
    img = Image.new("RGBA", (width, height), (255, 0, 0, 128))
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ContentFile(buf.getvalue(), name="alpha_test.png")


def make_variant(field_file, max_width):
    """Read, decode and encode one variant, as generate_and_store_variants does.

    Returns a ``BytesIO`` with the WebP bytes, or ``None`` when any step fails.
    """
    from climateconnect_main.utility.images import (
        decode_image,
        encode_webp_variant,
        read_source_bytes,
    )

    source = read_source_bytes(field_file)
    if source is None:
        return None
    image = decode_image(source, name=field_file.name)
    if image is None:
        return None
    data = encode_webp_variant(image, max_width=max_width)
    return BytesIO(data) if data is not None else None


def webp_files_of(storage, original_name):
    """Every WebP variant file on *storage* derived from *original_name*."""
    directory, filename = original_name.rsplit("/", 1)
    base = filename.rsplit(".", 1)[0]
    _dirs, files = storage.listdir(directory)
    return sorted(
        "{}/{}".format(directory, name)
        for name in files
        if name.startswith(base + "_") and name.endswith(".webp")
    )


# ---------------------------------------------------------------------------
# decode_image / encode_webp_variant unit tests
# ---------------------------------------------------------------------------


class TestGenerateWebPVariant(TempMediaRootMixin, APITestCase):

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Test Project",
            url_slug="test-project-variants",
            is_active=True,
            language=self.default_language,
        )

    def test_generates_webp_format(self):
        """Variant should be in WebP format."""
        content_file = make_test_image(
            width=2000, height=1000, mode="RGB", color="green"
        )
        self.project.image.save("test.png", content_file, save=True)

        variant = make_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertEqual(image.format, "WEBP")

    def test_no_upscaling(self):
        """An image smaller than max_width should not be upscaled."""
        content_file = make_test_image(width=500, height=400, mode="RGB", color="red")
        self.project.image.save("small.png", content_file, save=True)

        variant = make_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertLessEqual(image.width, 500)

    def test_resizing_large_image(self):
        """A large image should be resized to max_width."""
        content_file = make_test_image(
            width=4000, height=2000, mode="RGB", color="blue"
        )
        self.project.image.save("large.png", content_file, save=True)

        variant = make_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertEqual(image.width, 1200)
        self.assertEqual(image.height, 600)

    def test_exif_orientation(self):
        """EXIF orientation should be applied."""
        content_file = make_exif_test_image(width=800, height=600, orientation=6)
        self.project.image.save("exif_test.jpg", content_file, save=True)

        variant = make_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        # Orientation 6 = rotated 90°. After exif_transpose, width/height swapped.
        self.assertEqual(image.width, 600)
        self.assertEqual(image.height, 800)

    def test_alpha_channel_handling(self):
        """RGBA images should be handled without error."""
        content_file = make_png_with_alpha(width=400, height=300)
        self.project.image.save("alpha.png", content_file, save=True)

        variant = make_variant(self.project.image, max_width=300)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertEqual(image.format, "WEBP")
        self.assertEqual(image.mode, "RGBA")

    def test_storage_agnostic_no_path_access(self):
        """Reading must work when storage raises on .path (AzureStorage)."""
        content_file = make_test_image(
            width=2000, height=1000, mode="RGB", color="yellow"
        )
        self.project.image.save("test.png", content_file, save=True)

        type(self.project.image).path

        def raising_path(self_inner):
            raise NotImplementedError("AzureStorage does not support .path")

        with mock_patch.object(
            type(self.project.image), "path", property(raising_path)
        ):
            variant = make_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)

    def test_undecodable_image_returns_none(self):
        """An undecodable image should log an error and return None."""
        bad_content = ContentFile(b"not an image", name="bad.jpg")
        self.project.image.save("bad.jpg", bad_content, save=True)

        with self.assertLogs("climateconnect_main.utility.images", level="ERROR"):
            variant = make_variant(self.project.image, max_width=1200)

        self.assertIsNone(variant)

    def test_encoding_leaves_the_decoded_original_untouched(self):
        """Several widths are derived from one decoded image, so encoding a
        smaller width must not resize the original in place."""
        from climateconnect_main.utility.images import (
            decode_image,
            encode_webp_variant,
        )

        source = make_test_image(width=2000, height=1000).read()
        image = decode_image(source)

        small = encode_webp_variant(image, max_width=600)

        self.assertEqual(Image.open(BytesIO(small)).width, 600)
        self.assertEqual(image.size, (2000, 1000))

    def test_format_only_conversion_for_thumbnail(self):
        """When max_width is None, image is converted without resizing."""
        content_file = make_test_image(width=300, height=200, mode="RGB", color="red")
        self.project.thumbnail_image.save("thumb.png", content_file, save=True)

        variant = make_variant(self.project.thumbnail_image, max_width=None)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertEqual(image.format, "WEBP")
        self.assertEqual(image.width, 300)
        self.assertEqual(image.height, 200)


# ---------------------------------------------------------------------------
# generate_and_store_variants tests
# ---------------------------------------------------------------------------


class TestGenerateAndStoreVariants(TempMediaRootMixin, APITestCase):

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Test Project",
            url_slug="test-store-variants",
            is_active=True,
            language=self.default_language,
        )

    def test_generates_variants_for_all_fields(self):
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("test.png", content, save=True)
        thumb_content = make_test_image(width=120, height=120, mode="RGB", color="blue")
        self.project.thumbnail_image.save("thumb.png", thumb_content, save=True)

        generate_and_store_variants(self.project)

        self.project.refresh_from_db()
        variants = self.project.image_variants
        self.assertIn("image", variants)
        self.assertIn("1200", variants["image"])
        self.assertIn("600", variants["image"])
        self.assertIn("thumbnail_image", variants)
        self.assertIn("webp", variants["thumbnail_image"])

    def test_idempotent(self):
        """Re-running variant generation should produce the same keys."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        first_run = dict(self.project.image_variants)

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        self.assertEqual(set(first_run.keys()), set(self.project.image_variants.keys()))

    def test_skip_when_no_image(self):
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.assertEqual(self.project.image_variants, {})

    def test_only_specified_fields(self):
        """field_names parameter limits which fields are processed."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        thumb_content = make_test_image(width=120, height=120, mode="RGB", color="blue")
        self.project.thumbnail_image.save("thumb.png", thumb_content, save=True)

        generate_and_store_variants(self.project, field_names=["image"])

        self.project.refresh_from_db()
        variants = self.project.image_variants
        self.assertIn("image", variants)
        self.assertNotIn("thumbnail_image", variants)

    def test_variants_store_storage_paths_not_urls(self):
        """``image_variants`` holds storage-relative paths, never URLs.

        Storing URLs would bake the Azure account/CDN domain into every row,
        so a domain change would invalidate the whole table.
        """
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        storage = self.project.image.storage
        for key, stored in self.project.image_variants["image"].items():
            self.assertFalse(
                stored.startswith(("http://", "https://", "/")),
                "variant {} should be a storage path, got {}".format(key, stored),
            )
            self.assertTrue(
                storage.exists(stored),
                "variant {} points at a missing file: {}".format(key, stored),
            )

    def test_build_variant_urls_resolves_paths_to_urls(self):
        """``build_variant_urls`` maps stored paths through ``storage.url()``."""
        from climateconnect_main.utility.image_variants import (
            build_variant_urls,
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        urls = build_variant_urls(self.project)
        storage = self.project.image.storage

        self.assertEqual(set(urls["image"]), set(self.project.image_variants["image"]))
        for key, url in urls["image"].items():
            self.assertEqual(
                url, storage.url(self.project.image_variants["image"][key])
            )

    def test_build_variant_urls_empty_without_variants(self):
        """Rows with no variants resolve to an empty dict, not an error."""
        from climateconnect_main.utility.image_variants import build_variant_urls

        self.assertEqual(build_variant_urls(self.project), {})

    def test_regeneration_does_not_leak_orphan_files(self):
        """Regenerating writes new names and deletes the previous files once
        the new map is committed, so exactly one set of variants remains."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        storage = self.project.image.storage

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        first = dict(self.project.image_variants["image"])

        with self.captureOnCommitCallbacks(execute=True):
            generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        second = self.project.image_variants["image"]

        self.assertEqual(set(first), set(second))
        self.assertFalse(set(first.values()) & set(second.values()))
        self.assertEqual(
            webp_files_of(storage, self.project.image.name), sorted(second.values())
        )

    def test_regeneration_keeps_recorded_files_until_the_new_map_commits(self):
        """While a regeneration runs, every file the committed map lists stays
        readable; the previous files are only deleted after the commit."""
        from django.core.files.storage import Storage

        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        storage = self.project.image.storage
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        first = dict(self.project.image_variants["image"])

        original_save = Storage.save
        checked = []

        def checking_save(storage_self, name, content, *args, **kwargs):
            recorded = Project.objects.get(pk=self.project.pk).image_variants
            for path in recorded["image"].values():
                self.assertTrue(storage.exists(path), "Recorded file missing: " + path)
            checked.append(name)
            return original_save(storage_self, name, content, *args, **kwargs)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            with mock_patch.object(
                Storage, "save", autospec=True, side_effect=checking_save
            ):
                generate_and_store_variants(self.project)

            # The map points at the new files; the old ones are still there.
            second = Project.objects.get(pk=self.project.pk).image_variants["image"]
            self.assertFalse(set(first.values()) & set(second.values()))
            for path in [*first.values(), *second.values()]:
                self.assertTrue(storage.exists(path), path)

        self.assertEqual(len(checked), 2)
        for callback in callbacks:
            callback()
        for path in first.values():
            self.assertFalse(storage.exists(path), path)
        for path in second.values():
            self.assertTrue(storage.exists(path), path)

    def test_clearing_a_field_drops_its_variant_entry(self):
        """An emptied image field must not leave URLs to deleted files.

        The save itself drops the entry in the database, even with
        ``save(update_fields=["image"])``. The Celery task also reconciles a row
        that still carries an entry for an empty field (e.g. written before
        that), since it re-reads from the database.
        """
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.assertIn("image", self.project.image_variants)
        recorded = dict(self.project.image_variants)

        self.project.image = ""
        self.project.save(update_fields=["image"])

        self.assertNotIn(
            "image", Project.objects.get(pk=self.project.pk).image_variants
        )

        # Put a stale entry back and let the task reconcile it.
        Project.objects.filter(pk=self.project.pk).update(image_variants=recorded)
        stale = Project.objects.get(pk=self.project.pk)
        generate_and_store_variants(stale, field_names=["image"])
        self.project.refresh_from_db()

        self.assertNotIn("image", self.project.image_variants)

    def test_has_all_variants(self):
        """``has_all_variants`` gates the backfill's skip logic."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
            has_all_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        self.assertFalse(has_all_variants(self.project))

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.assertTrue(has_all_variants(self.project))

        # A newly populated field makes the row incomplete again.
        thumb = make_test_image(width=120, height=120, mode="RGB", color="blue")
        self.project.thumbnail_image.save("thumb.png", thumb, save=True)
        self.assertFalse(has_all_variants(self.project))

    def test_failed_store_keeps_the_previous_variant_referenced(self):
        """If storing a regenerated variant fails, the previous file stays in
        place and in the map — nothing was deleted to make room for it."""
        from django.core.files.storage import Storage

        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        storage = self.project.image.storage
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        first = dict(self.project.image_variants["image"])

        original_save = Storage.save

        def failing_600(storage_self, name, content, *args, **kwargs):
            if "_600_" in name:
                raise OSError("storage unavailable")
            return original_save(storage_self, name, content, *args, **kwargs)

        with (
            self.captureOnCommitCallbacks(execute=True),
            mock_patch.object(Storage, "save", autospec=True, side_effect=failing_600),
            self.assertLogs("climateconnect_main.utility.image_variants", "ERROR"),
        ):
            generate_and_store_variants(self.project)

        self.project.refresh_from_db()
        second = self.project.image_variants["image"]
        self.assertEqual(second["600"], first["600"])
        self.assertNotEqual(second["1200"], first["1200"])
        for path in second.values():
            self.assertTrue(storage.exists(path), path)
        self.assertFalse(storage.exists(first["1200"]))

    def test_total_store_failure_keeps_the_previous_entry(self):
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        first = dict(self.project.image_variants["image"])

        with (
            self.captureOnCommitCallbacks(execute=True),
            mock_patch(
                "django.core.files.storage.Storage.save",
                side_effect=OSError("storage unavailable"),
            ),
            self.assertLogs("climateconnect_main.utility.image_variants", "ERROR"),
        ):
            generate_and_store_variants(self.project)

        self.project.refresh_from_db()
        self.assertEqual(self.project.image_variants["image"], first)
        for path in first.values():
            self.assertTrue(self.project.image.storage.exists(path), path)

    def test_source_is_decoded_once_and_every_width_from_the_original(self):
        from climateconnect_main.utility import images
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)

        with (
            mock_patch.object(
                images, "decode_image", wraps=images.decode_image
            ) as decode_spy,
            mock_patch.object(
                images, "encode_webp_variant", wraps=images.encode_webp_variant
            ) as encode_spy,
        ):
            generate_and_store_variants(self.project, field_names=["image"])

        decode_spy.assert_called_once()
        self.assertEqual(
            [call.kwargs["max_width"] for call in encode_spy.call_args_list],
            [1200, 600],
        )
        decoded = {id(call.args[0]) for call in encode_spy.call_args_list}
        self.assertEqual(len(decoded), 1)

        self.project.refresh_from_db()
        storage = self.project.image.storage
        for key, width in (("1200", 1200), ("600", 600)):
            with storage.open(self.project.image_variants["image"][key]) as fh:
                self.assertEqual(Image.open(fh).width, width)

    def test_variant_names_are_unique_per_generation(self):
        from climateconnect_main.utility.image_variants import _variant_filename

        first = _variant_filename("projects/7/abc.png", 1200)
        second = _variant_filename("projects/7/abc.png", 1200)

        self.assertRegex(first, r"^projects/7/abc_1200_[0-9a-f]{8}\.webp$")
        self.assertNotEqual(first, second)
        self.assertRegex(
            _variant_filename("projects/7/abc.png", None),
            r"^projects/7/abc_webp_[0-9a-f]{8}\.webp$",
        )


# ---------------------------------------------------------------------------
# Serializer output tests
# ---------------------------------------------------------------------------


class TestImageVariantsSerialization(TempMediaRootMixin, APITestCase):
    """The API must expose URLs even though the column stores paths."""

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Serializer Test Project",
            url_slug="serializer-test-project",
            is_active=True,
            language=self.default_language,
        )

    def test_field_renders_absolute_urls(self):
        from climateconnect_main.utility.image_variants import (
            ImageVariantsField,
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        rendered = ImageVariantsField().to_representation(self.project)
        storage = self.project.image.storage

        self.assertIn("image", rendered)
        for key, url in rendered["image"].items():
            self.assertEqual(
                url, storage.url(self.project.image_variants["image"][key])
            )

    def test_serializers_declare_the_variant_field(self):
        """Guard against reverting to the raw model field, which leaks paths."""
        from climateconnect_main.utility.image_variants import ImageVariantsField
        from organization.serializers.organization import (
            OrganizationCardSerializer,
            OrganizationSerializer,
            OrganizationStubSerializer,
        )
        from organization.serializers.project import (
            ProjectMinimalSerializer,
            ProjectSerializer,
            ProjectStubSerializer,
        )

        for serializer_class in (
            ProjectSerializer,
            ProjectMinimalSerializer,
            ProjectStubSerializer,
            OrganizationSerializer,
            OrganizationStubSerializer,
            OrganizationCardSerializer,
        ):
            field = serializer_class().fields["image_variants"]
            self.assertIsInstance(
                field,
                ImageVariantsField,
                "{} must serialize image_variants through ImageVariantsField".format(
                    serializer_class.__name__
                ),
            )


# ---------------------------------------------------------------------------
# Signal dispatch tests
# ---------------------------------------------------------------------------


class TestSignalDispatch(TempMediaRootMixin, APITestCase):
    """Tests that Celery tasks fire only on changed image fields."""

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]

    @mock_patch("organization.tasks.generate_image_variants")
    def test_task_dispatched_on_image_change(self, mock_task):
        """Task is enqueued when an image field changes."""
        project = Project.objects.create(
            name="Signal Test Project",
            url_slug="signal-test-project",
            is_active=True,
            language=self.default_language,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")

        with self.captureOnCommitCallbacks(execute=True):
            project.image.save("test.png", content, save=True)

        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args.kwargs
        self.assertEqual(call_kwargs["model_name"], "Project")
        self.assertEqual(call_kwargs["pk"], project.pk)
        self.assertIn("image", call_kwargs["field_names"])

    @mock_patch("organization.tasks.generate_image_variants")
    def test_task_not_dispatched_on_non_image_change(self, mock_task):
        """Task is NOT enqueued when only a non-image field changes."""
        project = Project.objects.create(
            name="Signal Test Project",
            url_slug="signal-test-project-2",
            is_active=True,
            language=self.default_language,
        )

        with self.captureOnCommitCallbacks(execute=True):
            project.name = "Updated Name"
            project.save(update_fields=["name"])

        mock_task.delay.assert_not_called()

    @mock_patch("organization.tasks.generate_image_variants")
    def test_task_not_dispatched_on_image_no_change(self, mock_task):
        """Task is NOT enqueued when saving with the same image (no change)."""
        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        project = Project.objects.create(
            name="Signal Test Project",
            url_slug="signal-test-project-3",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)
        mock_task.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            project.name = "Updated Name"
            project.save()

        mock_task.delay.assert_not_called()

    @mock_patch("organization.tasks.generate_image_variants")
    def test_task_dispatched_on_update_view_style_image_change(self, mock_task):
        """Task fires when image is reassigned to a new value."""
        from climateconnect_main.utility.general import get_image_from_data_url

        project = Project.objects.create(
            name="Signal Test Project",
            url_slug="signal-test-project-4",
            is_active=True,
            language=self.default_language,
        )

        img = Image.new("RGB", (10, 10), "black")
        buf = BytesIO()
        img.save(buf, format="PNG")
        data_url = "data:image/png;base64," + b64encode(buf.getvalue()).decode("utf-8")

        with self.captureOnCommitCallbacks(execute=True):
            project.image = get_image_from_data_url(data_url)[0]
            project.save()

        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args.kwargs
        self.assertIn("image", call_kwargs["field_names"])

    @mock_patch("organization.tasks.generate_image_variants")
    def test_broker_error_does_not_fail_the_save(self, mock_task):
        """Redis down while enqueueing: the save succeeds (in autocommit, the
        callback runs inside the request), the error is logged with model and
        pk, and the row serves the original until the repair task runs."""
        from kombu.exceptions import OperationalError

        mock_task.delay.side_effect = OperationalError("Error 111 connecting")
        project = Project.objects.create(
            name="Broker Down Project",
            url_slug="broker-down-project",
            is_active=True,
            language=self.default_language,
        )
        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")

        with (
            mock_patch(
                "django.db.transaction.on_commit",
                side_effect=_run_on_commit_immediately,
            ),
            self.assertLogs(
                "climateconnect_main.utility.image_variants", level="ERROR"
            ) as logs,
        ):
            project.image.save("broker_down.png", content, save=True)

        mock_task.delay.assert_called_once()
        self.assertIn("Project pk={}".format(project.pk), logs.output[0])
        stored = Project.objects.get(pk=project.pk)
        self.assertEqual(stored.image.name, project.image.name)
        self.assertNotIn("image", stored.image_variants or {})

    @mock_patch("organization.tasks.generate_image_variants")
    def test_enqueue_callback_is_registered_robust(self, mock_task):
        from django.db import transaction

        project = Project.objects.create(
            name="Robust Project",
            url_slug="robust-project",
            is_active=True,
            language=self.default_language,
        )
        content = make_test_image(width=200, height=100, mode="RGB", color="red")

        with mock_patch(
            "django.db.transaction.on_commit", wraps=transaction.on_commit
        ) as spy:
            project.image.save("robust.png", content, save=True)

        enqueue_calls = [
            call
            for call in spy.call_args_list
            if getattr(call.args[0], "__name__", "") == "_enqueue"
        ]
        self.assertEqual(len(enqueue_calls), 1)
        self.assertIs(enqueue_calls[0].kwargs.get("robust"), True)


# ---------------------------------------------------------------------------
# Backfill command tests
# ---------------------------------------------------------------------------


class TestBackfillCommand(TempMediaRootMixin, APITestCase):

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]

    def test_backfill_generates_variants(self):
        """Backfill command generates variants for existing rows."""
        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        project = Project.objects.create(
            name="Backfill Test Project",
            url_slug="backfill-test-project",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0")

        project.refresh_from_db()
        variants = project.image_variants
        self.assertIn("image", variants)
        self.assertIn("1200", variants["image"])
        self.assertIn("600", variants["image"])

    def test_backfill_idempotent(self):
        """Re-running the backfill should not break anything."""
        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        project = Project.objects.create(
            name="Idempotent Test Project",
            url_slug="idempotent-test-project",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0")
        project.refresh_from_db()
        first_variants = dict(project.image_variants)

        call_command("backfill_image_variants", "--sleep", "0")
        project.refresh_from_db()

        self.assertEqual(set(first_variants.keys()), set(project.image_variants.keys()))
        self.assertIn("image", project.image_variants)
        self.assertIn("1200", project.image_variants["image"])

    def test_backfill_skips_rows_without_images(self):
        """Backfill should not fail on rows without images."""
        Project.objects.create(
            name="No Image Project",
            url_slug="no-image-project",
            is_active=True,
            language=self.default_language,
        )

        call_command("backfill_image_variants", "--sleep", "0")

    @mock_patch("climateconnect_main.utility.images.encode_webp_variant")
    def test_backfill_does_not_break_on_generation_error(self, mock_generate):
        """Backfill should continue even if variant generation fails."""
        mock_generate.return_value = None

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        project = Project.objects.create(
            name="Error Test Project",
            url_slug="error-test-project",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0")
        project.refresh_from_db()

    def test_backfill_organization(self):
        """Backfill handles the Organization model, background image included."""
        content = make_test_image(width=3000, height=1500, mode="RGB", color="blue")
        org = Organization.objects.create(
            name="Backfill Org",
            url_slug="backfill-org",
        )
        org.image.save("org.png", content, save=True)
        org.background_image.save("org_bg.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0")

        org.refresh_from_db()
        self.assertIn("image", org.image_variants)
        self.assertIn("1200", org.image_variants["image"])
        self.assertIn("background_image", org.image_variants)

    def test_backfill_skips_rows_that_already_have_variants(self):
        """A second run must not re-encode rows that are already complete.

        Without this the backfill re-downloads and re-uploads the entire image
        corpus from Azure on every run.
        """
        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        project = Project.objects.create(
            name="Skip Test Project",
            url_slug="skip-test-project",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0")

        with mock_patch(
            "climateconnect_main.utility.image_variants.generate_and_store_variants"
        ) as mock_generate:
            call_command("backfill_image_variants", "--sleep", "0")

        mock_generate.assert_not_called()

    def test_backfill_force_regenerates_existing_variants(self):
        """``--force`` re-encodes rows even when their variants are complete."""
        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        project = Project.objects.create(
            name="Force Test Project",
            url_slug="force-test-project",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0")
        project.refresh_from_db()
        before = dict(project.image_variants["image"])

        with self.captureOnCommitCallbacks(execute=True):
            call_command("backfill_image_variants", "--sleep", "0", "--force")
        project.refresh_from_db()

        # Regenerated under new names; the previous files are gone.
        after = project.image_variants["image"]
        self.assertEqual(set(before), set(after))
        self.assertFalse(set(before.values()) & set(after.values()))
        storage = project.image.storage
        for stored in after.values():
            self.assertTrue(storage.exists(stored))
        for stored in before.values():
            self.assertFalse(storage.exists(stored))

    def test_backfill_dry_run_writes_nothing(self):
        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        project = Project.objects.create(
            name="Dry Run Project",
            url_slug="dry-run-project",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0", "--dry-run")

        project.refresh_from_db()
        self.assertEqual(project.image_variants, {})

    def test_backfill_model_filter(self):
        """``--model`` restricts the backfill to a single model."""
        content = make_test_image(width=2000, height=1000, mode="RGB", color="blue")
        project = Project.objects.create(
            name="Model Filter Project",
            url_slug="model-filter-project",
            is_active=True,
            language=self.default_language,
        )
        project.image.save("test.png", content, save=True)

        org = Organization.objects.create(
            name="Model Filter Org",
            url_slug="model-filter-org",
        )
        org.image.save("org.png", content, save=True)

        call_command(
            "backfill_image_variants", "--sleep", "0", "--model", "Organization"
        )

        project.refresh_from_db()
        org.refresh_from_db()
        self.assertEqual(project.image_variants, {})
        self.assertIn("image", org.image_variants)


# ---------------------------------------------------------------------------
# Orphan cleanup tests
# ---------------------------------------------------------------------------


class TestOrphanCleanup(TempMediaRootMixin, APITestCase):
    """Tests that replacing an image deletes stale variant files."""

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Orphan Cleanup Project",
            url_slug="orphan-cleanup-project",
            is_active=True,
            language=self.default_language,
        )

    @mock_patch("organization.tasks.generate_image_variants")
    def test_old_variant_files_deleted_on_image_replace(self, mock_task):
        """Replacing an image deletes the old variant files from storage."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")

        # Save first image and generate variants synchronously
        self.project.image.save("old_image.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.assertIn("image", self.project.image_variants)

        # Cleanup works from the recorded variant paths.
        old_variant_paths = list(self.project.image_variants["image"].values())
        # Confirm the files exist on storage before the replace
        for path in old_variant_paths:
            self.assertTrue(
                self.project.image.storage.exists(path),
                "Variant file should exist: %s" % path,
            )

        # Replace the image
        with self.captureOnCommitCallbacks(execute=True):
            content2 = make_test_image(
                width=2000, height=1000, mode="RGB", color="blue"
            )
            self.project.image.save("new_image.png", content2, save=True)

        # Old variant files should be gone
        for path in old_variant_paths:
            self.assertFalse(
                self.project.image.storage.exists(path),
                "Old variant file should be deleted: %s" % path,
            )

        # The old field's entries should be cleared from image_variants
        # (new variants not yet generated since task is mocked)
        self.project.refresh_from_db()
        self.assertNotIn("image", self.project.image_variants)

        # Task should have been dispatched for the new image
        mock_task.delay.assert_called_once()

    @mock_patch("organization.tasks.generate_image_variants")
    def test_no_cleanup_on_non_image_change(self, mock_task):
        """Replacing a non-image field should not delete variant files."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("test_image.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        old_variant_paths = list(self.project.image_variants["image"].values())

        with self.captureOnCommitCallbacks(execute=True):
            self.project.name = "Updated Name"
            self.project.save(update_fields=["name"])

        mock_task.delay.assert_not_called()

        # Old variant files should still exist
        for path in old_variant_paths:
            self.assertTrue(self.project.image.storage.exists(path))

    @mock_patch("organization.tasks.generate_image_variants")
    def test_cleanup_on_image_clear(self, mock_task):
        """Clearing an image field deletes its variant files."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("test_image.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        old_variant_paths = list(self.project.image_variants["image"].values())

        with self.captureOnCommitCallbacks(execute=True):
            self.project.image.delete(save=True)

        for path in old_variant_paths:
            self.assertFalse(self.project.image.storage.exists(path))

    def test_cleanup_logs_error_but_does_not_raise(self):
        """A storage delete failure is logged, not raised."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("test_image.png", content, save=True)
        generate_and_store_variants(self.project)

        old_variant_paths = list(self.project.image_variants["image"].values())

        # Patch storage.delete to raise
        def raising_delete(name):
            raise RuntimeError("Azure storage error")

        with (
            mock_patch.object(
                self.project.image.storage, "delete", side_effect=raising_delete
            ),
            self.captureOnCommitCallbacks(execute=True),
        ):
            content2 = make_test_image(
                width=2000, height=1000, mode="RGB", color="blue"
            )
            self.project.image.save("new_image2.png", content2, save=True)

        # Files still exist because delete was mocked to fail
        for path in old_variant_paths:
            self.assertTrue(self.project.image.storage.exists(path))

    @mock_patch("organization.tasks.generate_image_variants")
    def test_rolled_back_replace_keeps_old_variant_files(self, mock_task):
        """Variant files are only deleted once the replacing save commits."""
        from django.db import transaction

        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("rollback_image.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        old_variant_paths = list(self.project.image_variants["image"].values())

        class Rollback(Exception):
            pass

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            try:
                with transaction.atomic():
                    content2 = make_test_image(
                        width=2000, height=1000, mode="RGB", color="blue"
                    )
                    self.project.image.save("replaced.png", content2, save=True)
                    raise Rollback()
            except Rollback:
                pass

        self.assertEqual(callbacks, [])
        mock_task.delay.assert_not_called()

        # The row still references the old original and variants, and they
        # still exist.
        self.project.refresh_from_db()
        self.assertEqual(
            sorted(self.project.image_variants["image"].values()),
            sorted(old_variant_paths),
        )
        self.assertTrue(self.project.image.storage.exists(self.project.image.name))
        for path in old_variant_paths:
            self.assertTrue(self.project.image.storage.exists(path))

    @mock_patch("organization.tasks.generate_image_variants")
    def test_old_original_deleted_on_image_replace(self, mock_task):
        """Replacing an image deletes the old original file, not just variants."""
        content = make_test_image(width=1600, height=800, mode="RGB", color="green")
        self.project.image.save("old_original.png", content, save=True)
        old_name = self.project.image.name
        storage = self.project.image.storage
        self.assertTrue(storage.exists(old_name))

        with self.captureOnCommitCallbacks(execute=True):
            content2 = make_test_image(width=1600, height=800, mode="RGB", color="blue")
            self.project.image.save("new_original.png", content2, save=True)

        self.assertFalse(storage.exists(old_name))
        self.assertTrue(storage.exists(self.project.image.name))

    @mock_patch("organization.tasks.generate_image_variants")
    def test_old_original_deleted_on_image_clear(self, mock_task):
        """Clearing an image field deletes the old original file."""
        content = make_test_image(width=1600, height=800, mode="RGB", color="green")
        self.project.image.save("cleared_original.png", content, save=True)
        old_name = self.project.image.name
        storage = self.project.image.storage

        with self.captureOnCommitCallbacks(execute=True):
            self.project.image = None
            self.project.save()

        self.assertFalse(storage.exists(old_name))


# ---------------------------------------------------------------------------
# Row deletion tests
# ---------------------------------------------------------------------------


class TestDeleteImageFiles(TempMediaRootMixin, APITestCase):
    """Deleting a row deletes its original images and all of their variants."""

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]

    def _add_images(self, instance, field_names):
        """Upload each field, generate variants, return (storage, all file names)."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        for field_name in field_names:
            content = make_test_image(width=1600, height=800, mode="RGB")
            getattr(instance, field_name).save(
                "{}.png".format(field_name), content, save=True
            )
        generate_and_store_variants(instance)
        instance.refresh_from_db()

        names = [getattr(instance, field_name).name for field_name in field_names]
        for variants in instance.image_variants.values():
            names.extend(variants.values())
        storage = getattr(instance, field_names[0]).storage
        for name in names:
            self.assertTrue(storage.exists(name), "File should exist: %s" % name)
        return storage, names

    def test_project_delete_removes_originals_and_variants(self):
        project = Project.objects.create(
            name="Delete Project",
            url_slug="delete-project",
            language=self.default_language,
        )
        storage, names = self._add_images(project, ["image", "thumbnail_image"])
        # 2 originals + image 1200/600 + thumbnail webp
        self.assertEqual(len(names), 5)

        with self.captureOnCommitCallbacks(execute=True):
            project.delete()

        for name in names:
            self.assertFalse(storage.exists(name), "Should be deleted: %s" % name)

    def test_organization_delete_removes_originals_and_variants(self):
        org = Organization.objects.create(name="Delete Org", url_slug="delete-org")
        storage, names = self._add_images(
            org, ["image", "thumbnail_image", "background_image"]
        )
        # 3 originals + image 1200/600 + thumbnail webp + background 1200/600
        self.assertEqual(len(names), 8)

        with self.captureOnCommitCallbacks(execute=True):
            org.delete()

        for name in names:
            self.assertFalse(storage.exists(name), "Should be deleted: %s" % name)

    def test_rolled_back_delete_keeps_files(self):
        from django.db import transaction

        project = Project.objects.create(
            name="Rollback Delete Project",
            url_slug="rollback-delete-project",
            language=self.default_language,
        )
        storage, names = self._add_images(project, ["image"])

        class Rollback(Exception):
            pass

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            try:
                with transaction.atomic():
                    project.delete()
                    raise Rollback()
            except Rollback:
                pass

        self.assertEqual(callbacks, [])
        for name in names:
            self.assertTrue(storage.exists(name), "Should still exist: %s" % name)

    def test_delete_without_images_queues_nothing(self):
        project = Project.objects.create(
            name="No Image Project",
            url_slug="no-image-project",
            language=self.default_language,
        )

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            project.delete()

        self.assertEqual(callbacks, [])

    def test_delete_failure_is_logged_not_raised(self):
        project = Project.objects.create(
            name="Failing Delete Project",
            url_slug="failing-delete-project",
            language=self.default_language,
        )
        storage, names = self._add_images(project, ["image"])

        with (
            mock_patch.object(
                storage, "delete", side_effect=RuntimeError("Azure storage error")
            ),
            self.assertLogs(
                "climateconnect_main.utility.image_variants", level="ERROR"
            ) as logs,
            self.captureOnCommitCallbacks(execute=True),
        ):
            project.delete()

        self.assertFalse(Project.objects.filter(url_slug="failing-delete-project"))
        self.assertEqual(len(logs.records), len(names))


# ---------------------------------------------------------------------------
# Stale instances (review H1)
# ---------------------------------------------------------------------------


class TestStaleInstanceSaves(TempMediaRootMixin, APITestCase):
    """A save or task working on an outdated instance must never touch the
    files of the image the row holds *now*."""

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Stale Instance Project",
            url_slug="stale-instance-project",
            language=self.default_language,
        )

    def _upload(self, instance, field_name, color):
        content = make_test_image(width=1600, height=800, mode="RGB", color=color)
        getattr(instance, field_name).save(
            "{}_{}.png".format(field_name, color), content, save=True
        )

    @mock_patch("organization.tasks.generate_image_variants")
    def test_stale_update_fields_save_keeps_current_image(self, mock_task):
        """``save(update_fields=["image_variants"])`` on an instance loaded
        before the image was replaced must not delete the new image."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        self._upload(self.project, "image", "red")
        stale = Project.objects.get(pk=self.project.pk)

        fresh = Project.objects.get(pk=self.project.pk)
        with self.captureOnCommitCallbacks(execute=True):
            self._upload(fresh, "image", "blue")
        generate_and_store_variants(fresh)
        fresh.refresh_from_db()
        current_files = [fresh.image.name, *fresh.image_variants["image"].values()]
        mock_task.delay.reset_mock()

        with self.captureOnCommitCallbacks(execute=True):
            stale.save(update_fields=["image_variants"])

        storage = fresh.image.storage
        for name in current_files:
            self.assertTrue(storage.exists(name), "Should still exist: %s" % name)
        mock_task.delay.assert_not_called()

    @mock_patch("organization.tasks.generate_image_variants")
    def test_update_fields_only_compares_written_image_fields(self, mock_task):
        """``save(update_fields=["image"])`` with a stale ``thumbnail_image``
        must leave the row's current thumbnail alone."""
        self._upload(self.project, "image", "red")
        self._upload(self.project, "thumbnail_image", "red")
        stale = Project.objects.get(pk=self.project.pk)

        fresh = Project.objects.get(pk=self.project.pk)
        with self.captureOnCommitCallbacks(execute=True):
            self._upload(fresh, "thumbnail_image", "blue")
        current_thumbnail = fresh.thumbnail_image.name

        with self.captureOnCommitCallbacks(execute=True):
            content = make_test_image(width=1600, height=800, color="green")
            stale.image.save("image_green.png", content, save=False)
            stale.save(update_fields=["image"])

        self.assertTrue(fresh.thumbnail_image.storage.exists(current_thumbnail))
        self.assertEqual(mock_task.delay.call_args.kwargs["field_names"], ["image"])

    @mock_patch("organization.tasks.generate_image_variants")
    def test_variants_of_a_replaced_image_are_discarded(self, mock_task):
        """A task that generated variants for an image that was replaced in the
        meantime records nothing and deletes the files it wrote."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        self._upload(self.project, "image", "red")
        stale = Project.objects.get(pk=self.project.pk)
        old_name = stale.image.name

        # Replace without running the commit callbacks, so the old original is
        # still readable — as for a task that read it before the replace.
        fresh = Project.objects.get(pk=self.project.pk)
        with self.captureOnCommitCallbacks(execute=False):
            self._upload(fresh, "image", "blue")

        generate_and_store_variants(stale)

        self.project.refresh_from_db()
        self.assertNotIn("image", self.project.image_variants)
        storage = self.project.image.storage
        self.assertEqual(webp_files_of(storage, old_name), [])
        self.assertTrue(storage.exists(self.project.image.name))

    def test_concurrent_fields_are_merged_not_overwritten(self):
        """Committing one field keeps entries another task wrote meanwhile."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        self._upload(self.project, "image", "red")
        self._upload(self.project, "thumbnail_image", "red")
        first = Project.objects.get(pk=self.project.pk)
        second = Project.objects.get(pk=self.project.pk)

        generate_and_store_variants(first, field_names=["image"])
        generate_and_store_variants(second, field_names=["thumbnail_image"])

        self.project.refresh_from_db()
        self.assertIn("image", self.project.image_variants)
        self.assertIn("thumbnail_image", self.project.image_variants)

    def test_variants_for_a_deleted_row_are_discarded(self):
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        self._upload(self.project, "image", "red")
        stale = Project.objects.get(pk=self.project.pk)
        name = stale.image.name
        storage = stale.image.storage
        with self.captureOnCommitCallbacks(execute=False):
            Project.objects.filter(pk=self.project.pk).delete()

        generate_and_store_variants(stale)

        self.assertEqual(webp_files_of(storage, name), [])


# ---------------------------------------------------------------------------
# Autocommit (review H2)
# ---------------------------------------------------------------------------


def _run_on_commit_immediately(func, using=None, robust=False):
    """What ``transaction.on_commit`` does outside an atomic block."""
    func()


class TestCleanupWithoutTransaction(TempMediaRootMixin, APITestCase):
    """The edit views run in autocommit mode, where ``on_commit`` callbacks run
    immediately. Old files must still only go once the row is written."""

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Autocommit Project",
            url_slug="autocommit-project",
            language=self.default_language,
        )
        content = make_test_image(width=1600, height=800, color="red")
        self.project.image.save("autocommit_old.png", content, save=True)
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.old_files = [
            self.project.image.name,
            *self.project.image_variants["image"].values(),
        ]
        self.storage = self.project.image.storage

    @mock_patch("organization.tasks.generate_image_variants")
    def test_failed_save_keeps_old_files(self, mock_task):
        from django.db import DatabaseError, transaction

        with (
            mock_patch(
                "django.db.transaction.on_commit",
                side_effect=_run_on_commit_immediately,
            ),
            mock_patch.object(
                Project, "_do_update", side_effect=DatabaseError("write failed")
            ),
        ):
            content = make_test_image(width=1600, height=800, color="blue")
            try:
                with transaction.atomic():
                    self.project.image.save("autocommit_new.png", content, save=True)
            except DatabaseError:
                pass

        for name in self.old_files:
            self.assertTrue(self.storage.exists(name), "Should still exist: %s" % name)
        mock_task.delay.assert_not_called()

    @mock_patch("organization.tasks.generate_image_variants")
    def test_successful_save_deletes_old_files(self, mock_task):
        with mock_patch(
            "django.db.transaction.on_commit",
            side_effect=_run_on_commit_immediately,
        ):
            content = make_test_image(width=1600, height=800, color="blue")
            self.project.image.save("autocommit_new.png", content, save=True)

        for name in self.old_files:
            self.assertFalse(self.storage.exists(name), "Should be deleted: %s" % name)
        self.assertTrue(self.storage.exists(self.project.image.name))


# ---------------------------------------------------------------------------
# Task retries (review L5)
# ---------------------------------------------------------------------------


class TestGenerateImageVariantsRetry(TempMediaRootMixin, APITestCase):
    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Retry Project",
            url_slug="retry-project",
            language=self.default_language,
        )
        content = make_test_image(width=1600, height=800, color="red")
        self.project.image.save("retry.png", content, save=True)

    def _run_task(self):
        from organization.tasks import generate_image_variants

        generate_image_variants(
            app_label="organization",
            model_name="Project",
            pk=self.project.pk,
            field_names=["image"],
        )

    def test_unreadable_original_is_retried(self):
        from organization.tasks import generate_image_variants

        with (
            mock_patch(
                "climateconnect_main.utility.images.read_source_bytes",
                return_value=None,
            ),
            mock_patch.object(generate_image_variants, "retry") as mock_retry,
        ):
            self._run_task()

        mock_retry.assert_called_once()
        self.assertEqual(
            mock_retry.call_args.kwargs["kwargs"]["field_names"], ["image"]
        )

    def test_replaced_image_is_not_retried(self):
        from organization.tasks import generate_image_variants

        with (
            mock_patch(
                "climateconnect_main.utility.image_variants.generate_and_store_variants",
                return_value=[("image", "projects/0/replaced_meanwhile.png")],
            ),
            mock_patch.object(generate_image_variants, "retry") as mock_retry,
        ):
            self._run_task()

        mock_retry.assert_not_called()

    def test_gives_up_after_max_retries(self):
        from celery.exceptions import MaxRetriesExceededError

        from organization.tasks import generate_image_variants

        with (
            mock_patch(
                "climateconnect_main.utility.images.read_source_bytes",
                return_value=None,
            ),
            mock_patch.object(
                generate_image_variants,
                "retry",
                side_effect=MaxRetriesExceededError(),
            ),
            self.assertLogs("organization.tasks", level="ERROR") as logs,
        ):
            self._run_task()

        self.assertIn("Giving up", logs.output[0])

    def test_success_does_not_retry(self):
        from organization.tasks import generate_image_variants

        with mock_patch.object(generate_image_variants, "retry") as mock_retry:
            self._run_task()

        mock_retry.assert_not_called()
        self.project.refresh_from_db()
        self.assertIn("image", self.project.image_variants)


# ---------------------------------------------------------------------------
# Full saves never write image_variants (review M1)
# ---------------------------------------------------------------------------


class TestFullSaveKeepsVariants(TempMediaRootMixin, APITestCase):
    """A plain ``save()`` (what the edit views do) must not write back an
    outdated ``image_variants`` or an image someone else replaced."""

    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Full Save Project",
            url_slug="full-save-project",
            language=self.default_language,
        )

    def _upload(self, instance, field_name, color):
        content = make_test_image(width=1600, height=800, mode="RGB", color=color)
        getattr(instance, field_name).save(
            "{}_{}.png".format(field_name, color), content, save=True
        )

    @mock_patch("organization.tasks.generate_image_variants")
    def test_edit_loaded_before_task_finished_keeps_variants(self, mock_task):
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        self._upload(self.project, "image", "red")
        edit = Project.objects.get(pk=self.project.pk)  # loaded: no variants

        generate_and_store_variants(Project.objects.get(pk=self.project.pk))

        edit.name = "Edited"
        edit.save()

        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "Edited")
        self.assertIn("image", self.project.image_variants)

    @mock_patch("organization.tasks.generate_image_variants")
    def test_stale_full_save_does_not_write_back_replaced_image(self, mock_task):
        self._upload(self.project, "image", "red")
        stale = Project.objects.get(pk=self.project.pk)

        fresh = Project.objects.get(pk=self.project.pk)
        with self.captureOnCommitCallbacks(execute=True):
            self._upload(fresh, "image", "blue")
        current = fresh.image.name

        with self.captureOnCommitCallbacks(execute=True):
            stale.name = "Edited"
            stale.save()

        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "Edited")
        self.assertEqual(self.project.image.name, current)
        self.assertTrue(self.project.image.storage.exists(current))

    @mock_patch("organization.tasks.generate_image_variants")
    def test_replacing_one_image_keeps_other_fields_entries(self, mock_task):
        """The stale entry is removed in the database, key by key — not by
        writing back an in-memory map that misses newer entries."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        self._upload(self.project, "image", "red")
        self._upload(self.project, "thumbnail_image", "red")
        generate_and_store_variants(
            Project.objects.get(pk=self.project.pk), field_names=["image"]
        )
        edit = Project.objects.get(pk=self.project.pk)  # no thumbnail entry yet
        generate_and_store_variants(
            Project.objects.get(pk=self.project.pk), field_names=["thumbnail_image"]
        )

        with self.captureOnCommitCallbacks(execute=True):
            self._upload(edit, "image", "blue")

        self.project.refresh_from_db()
        self.assertNotIn("image", self.project.image_variants)
        self.assertIn("thumbnail_image", self.project.image_variants)

    def test_explicit_update_fields_still_writes_image_variants(self):
        self.project.image_variants = {"image": {"600": "projects/x_600.webp"}}
        self.project.save(update_fields=["image_variants"])

        self.project.refresh_from_db()
        self.assertEqual(
            self.project.image_variants, {"image": {"600": "projects/x_600.webp"}}
        )

    def test_full_save_with_deferred_fields(self):
        self._upload(self.project, "image", "red")
        image_name = Project.objects.get(pk=self.project.pk).image.name

        partial = Project.objects.only("id", "name").get(pk=self.project.pk)
        partial.name = "Deferred Edit"
        partial.save()

        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "Deferred Edit")
        self.assertEqual(self.project.image.name, image_name)


# ---------------------------------------------------------------------------
# Query cost of change detection (review M3)
# ---------------------------------------------------------------------------


class TestChangeDetectionQueries(TempMediaRootMixin, APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Query Count Org", url_slug="query-count-org"
        )
        content = make_test_image(width=400, height=200, color="red")
        self.org.image.save("query_count.png", content, save=True)
        self.org = Organization.objects.get(pk=self.org.pk)

    @mock_patch("organization.tasks.generate_image_variants")
    def test_unrelated_save_runs_only_the_update(self, mock_task):
        self.org.name = "Renamed"
        with self.assertNumQueries(1):
            self.org.save()

    @mock_patch("organization.tasks.generate_image_variants")
    def test_image_change_runs_one_narrow_select(self, mock_task):
        content = make_test_image(width=400, height=200, color="blue")
        # SELECT old names + UPDATE row + UPDATE image_variants (key removal)
        with self.assertNumQueries(3):
            self.org.image.save("query_count_new.png", content, save=True)

    @mock_patch("organization.tasks.generate_image_variants")
    def test_refresh_from_db_does_not_look_like_a_change(self, mock_task):
        other = Organization.objects.get(pk=self.org.pk)
        content = make_test_image(width=400, height=200, color="blue")
        with self.captureOnCommitCallbacks(execute=True):
            other.image.save("query_count_other.png", content, save=True)
        mock_task.delay.reset_mock()

        self.org.refresh_from_db()
        self.org.name = "After Refresh"
        with self.captureOnCommitCallbacks(execute=True):
            self.org.save()

        mock_task.delay.assert_not_called()
        self.assertTrue(self.org.image.storage.exists(other.image.name))


# ---------------------------------------------------------------------------
# Repairing maps that point at missing files (review M5)
# ---------------------------------------------------------------------------


class TestVerifyMissingVariants(TempMediaRootMixin, APITestCase):
    def setUp(self):
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        self.project = Project.objects.create(
            name="Verify Project",
            url_slug="verify-project",
            language=self.default_language,
        )
        content = make_test_image(width=1600, height=800, color="red")
        self.project.image.save("verify.png", content, save=True)
        thumb = make_test_image(width=120, height=120, color="blue")
        self.project.thumbnail_image.save("verify_thumb.png", thumb, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.storage = self.project.image.storage
        self.missing = self.project.image_variants["image"]["1200"]
        self.storage.delete(self.missing)

    def test_only_verify_notices_a_missing_file(self):
        from climateconnect_main.utility.image_variants import (
            incomplete_variant_fields,
        )

        self.assertEqual(incomplete_variant_fields(self.project), [])
        self.assertEqual(
            incomplete_variant_fields(self.project, verify=True), ["image"]
        )

    def test_failing_check_counts_as_missing(self):
        from climateconnect_main.utility.image_variants import (
            incomplete_variant_fields,
        )

        with mock_patch.object(
            self.storage, "exists", side_effect=RuntimeError("Azure down")
        ):
            self.assertEqual(
                incomplete_variant_fields(self.project, verify=True),
                ["image", "thumbnail_image"],
            )

    def test_empty_field_with_entry_is_incomplete(self):
        from climateconnect_main.utility.image_variants import (
            incomplete_variant_fields,
        )

        Project.objects.filter(pk=self.project.pk).update(thumbnail_image="")
        self.project.refresh_from_db()
        self.assertIn("thumbnail_image", incomplete_variant_fields(self.project))

    def test_backfill_skips_missing_file_without_verify(self):
        call_command("backfill_image_variants", "--sleep", "0", stdout=_quiet_stdout())
        self.assertFalse(self.storage.exists(self.missing))

    def test_backfill_verify_regenerates_only_the_broken_field(self):
        from climateconnect_main.utility import image_variants

        with mock_patch(
            "organization.management.commands.backfill_image_variants."
            "generate_and_store_variants",
            wraps=image_variants.generate_and_store_variants,
        ) as spy:
            call_command(
                "backfill_image_variants",
                "--sleep",
                "0",
                "--verify",
                stdout=_quiet_stdout(),
            )

        spy.assert_called_once()
        self.assertEqual(spy.call_args.kwargs["field_names"], ["image"])
        self.project.refresh_from_db()
        for path in self.project.image_variants["image"].values():
            self.assertTrue(self.storage.exists(path), path)


def _quiet_stdout():
    """Swallow command output."""
    from io import StringIO

    return StringIO()


# ---------------------------------------------------------------------------
# Periodic repair task (review finding 1, follow-up)
# ---------------------------------------------------------------------------


class TestRegenerateMissingImageVariants(TempMediaRootMixin, APITestCase):
    def setUp(self):
        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]

    def _project(self, slug, updated_ago, with_image=True):

        from django.utils import timezone

        project = Project.objects.create(
            name=slug, url_slug=slug, language=self.default_language
        )
        if with_image:
            content = make_test_image(width=1600, height=800, color="red")
            project.image.save("{}.png".format(slug), content, save=True)
        # update() bypasses auto_now.
        Project.objects.filter(pk=project.pk).update(
            updated_at=timezone.now() - updated_ago
        )
        return Project.objects.get(pk=project.pk)

    def _run(self):
        from organization.tasks import regenerate_missing_image_variants

        regenerate_missing_image_variants()

    def test_repairs_rows_inside_the_window_only(self):
        from datetime import timedelta

        missed = self._project("repair-missed", timedelta(hours=2))
        fresh = self._project("repair-fresh", timedelta(minutes=5))
        old = self._project("repair-old", timedelta(days=30))

        self._run()

        for project, expect_variants in ((missed, True), (fresh, False), (old, False)):
            project.refresh_from_db()
            self.assertEqual(
                "image" in (project.image_variants or {}),
                expect_variants,
                project.url_slug,
            )

    def test_only_incomplete_fields_are_regenerated(self):
        from datetime import timedelta

        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        project = self._project("repair-complete", timedelta(hours=2))
        generate_and_store_variants(project)
        content = make_test_image(width=120, height=120, color="blue")
        Project.objects.filter(pk=project.pk).update(
            thumbnail_image=project.image.storage.save(
                "projects/{}/thumb.png".format(project.pk), content
            )
        )

        with mock_patch(
            "climateconnect_main.utility.image_variants.generate_and_store_variants"
        ) as mock_generate:
            self._run()

        mock_generate.assert_called_once()
        self.assertEqual(
            mock_generate.call_args.kwargs["field_names"], ["thumbnail_image"]
        )

    def test_row_limit_per_run(self):
        from datetime import timedelta

        for index in range(3):
            self._project("repair-limit-{}".format(index), timedelta(hours=2))

        with (
            mock_patch("organization.tasks.IMAGE_VARIANT_REPAIR_MAX_ROWS", 2),
            mock_patch(
                "climateconnect_main.utility.image_variants.generate_and_store_variants"
            ) as mock_generate,
        ):
            self._run()

        self.assertEqual(mock_generate.call_count, 2)

    def test_failing_row_is_logged_and_the_run_continues(self):
        from datetime import timedelta

        self._project("repair-fail-a", timedelta(hours=2))
        self._project("repair-fail-b", timedelta(hours=3))

        with (
            mock_patch(
                "climateconnect_main.utility.image_variants.generate_and_store_variants",
                side_effect=[RuntimeError("Azure down"), []],
            ) as mock_generate,
            self.assertLogs("organization.tasks", level="ERROR") as logs,
        ):
            self._run()

        self.assertEqual(mock_generate.call_count, 2)
        self.assertIn("Repair failed", logs.output[0])

    def test_scheduled_in_celery_beat(self):
        from climateconnect_main.celery import app

        tasks = {entry["task"] for entry in app.conf.beat_schedule.values()}
        self.assertIn("organization.tasks.regenerate_missing_image_variants", tasks)

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

from climateconnect_api.models import Language, UserProfile
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


# ---------------------------------------------------------------------------
# generate_webp_variant unit tests
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
        from climateconnect_main.utility.images import generate_webp_variant

        content_file = make_test_image(
            width=2000, height=1000, mode="RGB", color="green"
        )
        self.project.image.save("test.png", content_file, save=True)

        variant = generate_webp_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertEqual(image.format, "WEBP")

    def test_no_upscaling(self):
        """An image smaller than max_width should not be upscaled."""
        from climateconnect_main.utility.images import generate_webp_variant

        content_file = make_test_image(width=500, height=400, mode="RGB", color="red")
        self.project.image.save("small.png", content_file, save=True)

        variant = generate_webp_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertLessEqual(image.width, 500)

    def test_resizing_large_image(self):
        """A large image should be resized to max_width."""
        from climateconnect_main.utility.images import generate_webp_variant

        content_file = make_test_image(
            width=4000, height=2000, mode="RGB", color="blue"
        )
        self.project.image.save("large.png", content_file, save=True)

        variant = generate_webp_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertEqual(image.width, 1200)
        self.assertEqual(image.height, 600)

    def test_exif_orientation(self):
        """EXIF orientation should be applied."""
        from climateconnect_main.utility.images import generate_webp_variant

        content_file = make_exif_test_image(width=800, height=600, orientation=6)
        self.project.image.save("exif_test.jpg", content_file, save=True)

        variant = generate_webp_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        # Orientation 6 = rotated 90°. After exif_transpose, width/height swapped.
        self.assertEqual(image.width, 600)
        self.assertEqual(image.height, 800)

    def test_alpha_channel_handling(self):
        """RGBA images should be handled without error."""
        from climateconnect_main.utility.images import generate_webp_variant

        content_file = make_png_with_alpha(width=400, height=300)
        self.project.image.save("alpha.png", content_file, save=True)

        variant = generate_webp_variant(self.project.image, max_width=300)

        self.assertIsNotNone(variant)
        image = Image.open(BytesIO(variant.read()))
        self.assertEqual(image.format, "WEBP")
        self.assertEqual(image.mode, "RGBA")

    def test_storage_agnostic_no_path_access(self):
        """Function must work when storage raises on .path (AzureStorage)."""
        from climateconnect_main.utility.images import generate_webp_variant

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
            variant = generate_webp_variant(self.project.image, max_width=1200)

        self.assertIsNotNone(variant)

    def test_undecodable_image_returns_none(self):
        """An undecodable image should log an error and return None."""
        from climateconnect_main.utility.images import generate_webp_variant

        bad_content = ContentFile(b"not an image", name="bad.jpg")
        self.project.image.save("bad.jpg", bad_content, save=True)

        with self.assertLogs("climateconnect_main.utility.images", level="ERROR"):
            variant = generate_webp_variant(self.project.image, max_width=1200)

        self.assertIsNone(variant)

    def test_none_field_file_returns_none(self):
        from climateconnect_main.utility.images import generate_webp_variant

        result = generate_webp_variant(None, max_width=1200)
        self.assertIsNone(result)

    def test_format_only_conversion_for_thumbnail(self):
        """When max_width is None, image is converted without resizing."""
        from climateconnect_main.utility.images import generate_webp_variant

        content_file = make_test_image(width=300, height=200, mode="RGB", color="red")
        self.project.thumbnail_image.save("thumb.png", content_file, save=True)

        variant = generate_webp_variant(self.project.thumbnail_image, max_width=None)

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
        """Regenerating reuses the deterministic name instead of suffixing it.

        ``storage.save()`` appends a random suffix when the target name is
        taken, so without deleting first every backfill re-run would leave an
        extra copy of every variant behind.
        """
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        first = dict(self.project.image_variants["image"])

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        second = self.project.image_variants["image"]

        self.assertEqual(first, second)

    def test_clearing_a_field_drops_its_variant_entry(self):
        """An emptied image field must not leave URLs to deleted files.

        ``cleanup_orphaned_variants`` pops the entry in ``pre_save``, but that
        pop is lost on a ``save(update_fields=[...])`` that omits
        ``image_variants``. The Celery task re-reads from the database, so it
        is the authoritative place to reconcile.
        """
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.assertIn("image", self.project.image_variants)

        self.project.image = ""
        self.project.save(update_fields=["image"])

        # The in-memory instance was already popped by cleanup_orphaned_variants;
        # the row in the database is what still holds the stale entry. Re-fetch
        # the way the Celery task does.
        stale = Project.objects.get(pk=self.project.pk)
        self.assertIn("image", stale.image_variants, "precondition: DB row is stale")

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

    def test_storage_failure_clears_entry_instead_of_serving_404s(self):
        """A failed re-store must not leave paths to deleted files behind."""
        from climateconnect_main.utility.image_variants import (
            generate_and_store_variants,
        )

        content = make_test_image(width=2000, height=1000, mode="RGB", color="red")
        self.project.image.save("test.png", content, save=True)

        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.assertIn("image", self.project.image_variants)

        with mock_patch(
            "django.core.files.storage.Storage.save",
            side_effect=OSError("storage unavailable"),
        ):
            generate_and_store_variants(self.project)

        self.project.refresh_from_db()
        self.assertNotIn("image", self.project.image_variants)


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
        from climateconnect_api.serializers.user import (
            PersonalProfileSerializer,
            UserProfileMinimalSerializer,
            UserProfileSerializer,
            UserProfileStubSerializer,
        )
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
            PersonalProfileSerializer,
            UserProfileSerializer,
            UserProfileMinimalSerializer,
            UserProfileStubSerializer,
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

    @mock_patch("climateconnect_main.utility.images.generate_webp_variant")
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

    def test_backfill_organization_and_userprofile(self):
        """Backfill handles Organization and UserProfile models."""
        from django.contrib.auth.models import User

        content = make_test_image(width=3000, height=1500, mode="RGB", color="blue")
        org = Organization.objects.create(
            name="Backfill Org",
            url_slug="backfill-org",
        )
        org.image.save("org.png", content, save=True)
        org.background_image.save("org_bg.png", content, save=True)

        user = User.objects.create_user(
            username="backfill_user",
            password="testpass",
        )
        profile = UserProfile.objects.get_or_create(
            user=user,
            defaults={"url_slug": "backfill-profile"},
        )[0]
        profile.image.save("profile.png", content, save=True)

        call_command("backfill_image_variants", "--sleep", "0")

        org.refresh_from_db()
        self.assertIn("image", org.image_variants)
        self.assertIn("1200", org.image_variants["image"])
        self.assertIn("background_image", org.image_variants)

        profile.refresh_from_db()
        self.assertIn("image", profile.image_variants)
        self.assertIn("1200", profile.image_variants["image"])

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

        call_command("backfill_image_variants", "--sleep", "0", "--force")
        project.refresh_from_db()

        # Same deterministic paths, regenerated in place.
        self.assertEqual(before, project.image_variants["image"])
        storage = project.image.storage
        for stored in project.image_variants["image"].values():
            self.assertTrue(storage.exists(stored))

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
# Members-list cache invalidation
# ---------------------------------------------------------------------------


class TestMemberListCacheInvalidation(TempMediaRootMixin, APITestCase):
    """Changing an avatar must refresh the cached /api/members/ pages.

    ``ListMemberProfilesView`` is wrapped in ``cache_page`` with a two-day TTL
    and ``remove_cache_keys`` only fires on profile *creation*, so without the
    receiver in ``climateconnect_api.signals`` a new avatar stays invisible in
    the members list for up to two days.
    """

    def setUp(self):
        from django.contrib.auth.models import User

        # Tests run on LocMemCache, which has no keys()/delete_many(), so the
        # real invalidation path short-circuits. Patch the cache the signal
        # module uses, mirroring climateconnect_api/tests/test_registered_event_slugs.py.
        self.cache_patcher = mock_patch("climateconnect_api.signals.cache")
        self.mock_cache = self.cache_patcher.start()
        self.addCleanup(self.cache_patcher.stop)
        self.mock_cache.keys.return_value = ["LIST_MEMBERS.page1"]

        self.default_language = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )[0]
        user = User.objects.create_user(username="cache_user", password="pw")
        self.profile = UserProfile.objects.get_or_create(
            user=user, defaults={"url_slug": "cache-user"}
        )[0]
        self.mock_cache.reset_mock()

    def test_image_change_invalidates(self):
        content = make_test_image(width=400, height=400, mode="RGB", color="red")
        self.profile.image.save("avatar.png", content, save=True)

        self.mock_cache.delete_many.assert_called_once_with(["LIST_MEMBERS.page1"])

    def test_variant_write_invalidates(self):
        """The Celery task writing image_variants must also refresh the list."""
        self.profile.save(update_fields=["image_variants"])

        self.mock_cache.delete_many.assert_called_once_with(["LIST_MEMBERS.page1"])

    def test_unrelated_save_does_not_invalidate(self):
        """A save that touches no image field must not thrash the cache."""
        self.profile.url_slug = "cache-user-renamed"
        self.profile.save()

        self.mock_cache.delete_many.assert_not_called()


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
            IMAGE_VARIANT_CONFIGS,
            _variant_filename,
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")

        # Save first image and generate variants synchronously
        self.project.image.save("old_image.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()
        self.assertIn("image", self.project.image_variants)

        # Collect the variant file paths from the stored URLs
        old_name = self.project.image.name  # e.g. "projects/1/old_image.png"
        config = IMAGE_VARIANT_CONFIGS["Project"]
        widths = config["image"]["widths"]
        old_variant_paths = [_variant_filename(old_name, w) for w in widths]
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
            IMAGE_VARIANT_CONFIGS,
            _variant_filename,
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("test_image.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        old_name = self.project.image.name
        config = IMAGE_VARIANT_CONFIGS["Project"]
        widths = config["image"]["widths"]

        old_variant_paths = [_variant_filename(old_name, w) for w in widths]

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
            IMAGE_VARIANT_CONFIGS,
            _variant_filename,
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("test_image.png", content, save=True)
        generate_and_store_variants(self.project)
        self.project.refresh_from_db()

        old_name = self.project.image.name

        config = IMAGE_VARIANT_CONFIGS["Project"]
        widths = config["image"]["widths"]
        old_variant_paths = [_variant_filename(old_name, w) for w in widths]

        with self.captureOnCommitCallbacks(execute=True):
            self.project.image.delete(save=True)

        for path in old_variant_paths:
            self.assertFalse(self.project.image.storage.exists(path))

    def test_cleanup_logs_error_but_does_not_raise(self):
        """A storage delete failure is logged, not raised."""
        from climateconnect_main.utility.image_variants import (
            IMAGE_VARIANT_CONFIGS,
            _variant_filename,
            generate_and_store_variants,
        )

        content = make_test_image(width=4000, height=2000, mode="RGB", color="green")
        self.project.image.save("test_image.png", content, save=True)
        generate_and_store_variants(self.project)
        old_name = self.project.image.name

        widths = IMAGE_VARIANT_CONFIGS["Project"]["image"]["widths"]
        old_variant_paths = [_variant_filename(old_name, w) for w in widths]

        # Patch storage.delete to raise
        def raising_delete(name):
            raise RuntimeError("Azure storage error")

        with mock_patch.object(
            self.project.image.storage, "delete", side_effect=raising_delete
        ):
            content2 = make_test_image(
                width=2000, height=1000, mode="RGB", color="blue"
            )
            self.project.image.save("new_image2.png", content2, save=True)

        # Files still exist because delete was mocked to fail
        for path in old_variant_paths:
            self.assertTrue(self.project.image.storage.exists(path))

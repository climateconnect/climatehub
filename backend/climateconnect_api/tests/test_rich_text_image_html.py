"""Rich-text images in saved project descriptions (spec 20260708_1302).

Covers the sanitiser, the resolve step on project create and edit, the image
limit per language version and the usage sync.
"""

from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from climateconnect_api.models import Language, RichTextImage, RichTextImageUsage, Role
from climateconnect_api.tests.test_rich_text_images import encode, photo
from climateconnect_api.utility.html import (
    PROJECT_DESCRIPTION_ALLOWED_ATTRIBUTES,
    PROJECT_DESCRIPTION_ALLOWED_TAGS,
    sanitize_html,
)
from climateconnect_api.utility.rich_text_image_html import (
    rich_text_image_ids,
    sizes_attribute,
)
from organization.models import (
    Project,
    ProjectMember,
    ProjectStatus,
    ProjectTranslation,
)

VARIANT = "http://testserver/media/rich_text_images/" + "a" * 32 + ".webp"


def figure(image_id, src=VARIANT, srcset=None, classes="", alt="", caption=""):
    srcset = srcset if srcset is not None else f"{src} 600w"
    class_attr = f' class="{classes}"' if classes else ""
    caption_html = f"<figcaption>{caption}</figcaption>" if caption else ""
    return (
        f'<figure{class_attr}><img src="{src}" srcset="{srcset}" alt="{alt}"'
        f' data-image-id="{image_id}">{caption_html}</figure>'
    )


def sanitize(html):
    return sanitize_html(
        html,
        allowed_tags=PROJECT_DESCRIPTION_ALLOWED_TAGS,
        allowed_attributes=PROJECT_DESCRIPTION_ALLOWED_ATTRIBUTES,
    )


class SanitizerTests(TestCase):
    def test_keeps_platform_image(self):
        html = figure(5, classes="image-size-small image-align-left", caption="Credit")
        self.assertEqual(sanitize(html), html)

    def test_removes_javascript_in_srcset(self):
        html = figure(5, srcset="javascript:alert(1) 600w") + "<p>text</p>"
        self.assertEqual(sanitize(html), "<p>text</p>")

    def test_removes_foreign_and_data_urls(self):
        for src in ("https://tracker.example/p.gif", "data:image/png;base64,AAAA"):
            self.assertEqual(sanitize(figure(5, src=src, srcset="")), "")

    def test_figure_style_only_with_image_facts(self):
        html = figure(5).replace("<figure", '<figure style="--w: 900; --r: 1.5;"')
        self.assertIn('style="--w: 900; --r: 1.5;"', sanitize(html))
        mixed = figure(5).replace(
            "<figure", '<figure style="--w: 900; --r: 1.5; color: red;"'
        )
        self.assertIn('style="--w: 900; --r: 1.5;"', sanitize(mixed))
        for bad in (
            "background-image: url(https://tracker.example/x.gif);",
            "--w: 9e9; --r: 1;",
        ):
            html = figure(5).replace("<figure", f'<figure style="{bad}"')
            cleaned = sanitize(html)
            self.assertNotIn("style=", cleaned, bad)
            self.assertIn("data-image-id", cleaned)

    def test_removes_image_without_id(self):
        html = f'<figure><img src="{VARIANT}"></figure>'
        self.assertEqual(sanitize(html), "")

    def test_removes_event_handlers_and_unknown_classes(self):
        html = figure(5, classes="image-size-small evil").replace(
            "<img ", '<img onerror="alert(1)" style="x" '
        )
        cleaned = sanitize(html)
        self.assertNotIn("onerror", cleaned)
        self.assertNotIn("style", cleaned)
        self.assertIn('class="image-size-small"', cleaned)

    def test_attribute_values_are_parsed_not_matched(self):
        # A raw ">" in a value is valid HTML; the attribute order is free.
        html = (
            f'<figure><img alt="CO2 > 400 ppm" data-image-id="5" src="{VARIANT}">'
            "</figure><p>after</p>"
        )
        cleaned = sanitize(html)
        self.assertIn('data-image-id="5"', cleaned)
        self.assertIn('alt="CO2 > 400 ppm"', cleaned)
        self.assertIn("<p>after</p>", cleaned)

    def test_alt_and_caption_text_round_trip(self):
        html = figure(5, alt="A &amp; B &lt; C", caption="Fotos &amp; Text &lt;x&gt;")
        cleaned = sanitize(html)
        self.assertEqual(cleaned, html)
        self.assertEqual(sanitize(cleaned), cleaned)

    def test_caption_is_plain_text(self):
        cleaned = sanitize(figure(5, caption="Photo: <b>Jane</b>"))
        self.assertIn("<figcaption>Photo: Jane</figcaption>", cleaned)

    def test_removes_images_outside_a_figure(self):
        html = f'<p>a<img src="{VARIANT}" data-image-id="5">b</p>'
        self.assertEqual(sanitize(html), "<p>ab</p>")

    def test_keeps_one_image_per_block(self):
        nested = figure(5).replace("</figure>", figure(6) + "</figure>")
        cleaned = sanitize(nested + "<p>after</p>")
        self.assertEqual(rich_text_image_ids(cleaned), {5})
        self.assertEqual(cleaned.count("<figure"), cleaned.count("</figure>"))
        self.assertTrue(cleaned.endswith("<p>after</p>"))


class DescriptionTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.english = Language.objects.get(language_code="en")
        self.german = Language.objects.get(language_code="de")
        ProjectStatus.objects.update_or_create(
            id=2,
            defaults={"name": "active", "has_end_date": False, "has_start_date": False},
        )
        self.user = User.objects.create_user(username="author", password="x")
        self.other = User.objects.create_user(username="other", password="x")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        # Translation is not under test; DeepL returns the text unchanged.
        patcher = mock.patch(
            "climateconnect_api.utility.translation.translate_text",
            side_effect=lambda text, original_lang, *args, **kwargs: {
                "translated_text": text,
                "original_lang": original_lang,
            },
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def upload(self, user=None):
        client = APIClient()
        client.force_authenticate(user or self.user)
        response = client.post(
            reverse("rich-text-image-upload-api"),
            {"image": _jpeg_file()},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return RichTextImage.objects.get(id=response.data["id"])

    def make_project(self, description_html=""):
        project = Project.objects.create(
            name="Project",
            url_slug=f"project-{Project.objects.count()}",
            language=self.english,
            description_html=description_html,
        )
        role = Role.objects.create(name="Admin", role_type=Role.ALL_TYPE)
        ProjectMember.objects.create(user=self.user, project=project, role=role)
        return project

    def patch(self, project, data):
        return self.client.patch(
            reverse(
                "organization:project-api-view", kwargs={"url_slug": project.url_slug}
            ),
            data,
            format="json",
        )

    def usage_ids(self, project):
        return set(
            RichTextImageUsage.objects.filter(project=project).values_list(
                "image_id", flat=True
            )
        )


def _jpeg_file():
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(
        "photo.jpg", encode(photo(900, 600), "JPEG"), content_type="image/jpeg"
    )


class CreateProjectTests(DescriptionTestCase):
    def create(self, description_html, translations=None):
        return self.client.post(
            reverse("organization:create-project-api"),
            {
                "name": "Draft with images",
                "is_draft": True,
                "description_html": description_html,
                "source_language": "en",
                "translations": translations or {},
                "project_type": {"type_id": "project"},
            },
            format="json",
        )

    def test_images_are_canonicalised_and_linked(self):
        image = self.upload()
        response = self.create(
            "<p>Intro</p>"
            + figure(
                image.id,
                src=VARIANT,
                classes="image-size-small",
                alt="Volunteers planting trees",
                caption="Photo: <b>Jane</b>",
            )
        )
        self.assertEqual(response.status_code, 201, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])

        html = project.description_html
        stored = image.variants[-1]["name"]
        self.assertIn(stored, html)
        self.assertNotIn(VARIANT, html)  # client URLs are replaced
        self.assertIn('class="image-size-small image-align-center"', html)
        self.assertIn('alt="Volunteers planting trees"', html)
        self.assertIn('loading="lazy"', html)
        # Facts about the image for the CSS: natural width and aspect ratio.
        self.assertIn('style="--w: 900; --r: 1.5;"', html)
        # Computed on the server from the size and the natural width (900 px).
        self.assertIn('sizes="(max-width: 600px) 50vw, 390px"', html)
        self.assertIn('width="900" height="600"', html)
        self.assertIn("<figcaption>Photo: Jane</figcaption>", html)
        self.assertNotIn(image.original.name, html)
        self.assertEqual(self.usage_ids(project), {image.id})

    def test_someone_elses_image_is_removed(self):
        foreign = self.upload(self.other)
        response = self.create("<p>Intro</p>" + figure(foreign.id))
        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertEqual(project.description_html, "<p>Intro</p>")
        self.assertEqual(self.usage_ids(project), set())

    def test_unknown_image_is_removed(self):
        response = self.create(figure(999999))
        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertEqual(project.description_html, "")

    def test_client_sizes_are_replaced(self):
        image = self.upload()
        html = figure(image.id).replace("<img ", '<img sizes="100vw" ')
        response = self.create(html)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertNotIn('sizes="100vw"', project.description_html)
        self.assertIn(
            'sizes="(max-width: 600px) 100vw, 900px"', project.description_html
        )

    def test_alt_text_is_shortened(self):
        image = self.upload()
        response = self.create(figure(image.id, alt="x" * 300))
        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertIn('alt="%s"' % ("x" * 150), project.description_html)
        self.assertNotIn("x" * 151, project.description_html)

    def test_alt_text_with_reserved_characters_is_kept(self):
        image = self.upload()
        html = (
            f'<figure><img alt="CO2 > 400 ppm & more" data-image-id="{image.id}"'
            f' src="{VARIANT}"></figure>'
        )
        response = self.create(html)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertIn('alt="CO2 > 400 ppm &amp; more"', project.description_html)
        self.assertEqual(self.usage_ids(project), {image.id})

    def test_someone_elses_image_in_a_translation_is_removed(self):
        own, foreign = self.upload(), self.upload(self.other)
        response = self.create(
            figure(own.id),
            {
                "de": {
                    "is_manual_translation": True,
                    "name": "Entwurf",
                    "description_html": figure(foreign.id) + "<p>Text</p>",
                }
            },
        )
        self.assertEqual(response.status_code, 201, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        translation = ProjectTranslation.objects.get(
            project=project, language=self.german
        )
        self.assertEqual(translation.description_html_translation, "<p>Text</p>")
        self.assertEqual(self.usage_ids(project), {own.id})

    def test_more_than_ten_images_is_rejected(self):
        image = self.upload()
        response = self.create("".join(figure(image.id) for _ in range(11)))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Project.objects.filter(name="Draft with images").exists())

    def test_manual_translation_with_own_images(self):
        english_image = self.upload()
        german_image = self.upload()
        response = self.create(
            figure(english_image.id),
            {
                "de": {
                    "is_manual_translation": True,
                    "name": "Entwurf",
                    "description_html": figure(german_image.id),
                }
            },
        )
        self.assertEqual(response.status_code, 201, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        translation = ProjectTranslation.objects.get(
            project=project, language=self.german
        )
        self.assertEqual(
            rich_text_image_ids(translation.description_html_translation),
            {german_image.id},
        )
        self.assertEqual(self.usage_ids(project), {english_image.id, german_image.id})


class EditProjectTests(DescriptionTestCase):
    def test_adding_and_removing_images_syncs_usages(self):
        project = self.make_project()
        first, second = self.upload(), self.upload()

        response = self.patch(
            project, {"description_html": figure(first.id) + figure(second.id)}
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.usage_ids(project), {first.id, second.id})

        self.patch(project, {"description_html": figure(second.id)})
        self.assertEqual(self.usage_ids(project), {second.id})
        # Unlinked, not deleted (D17, D18).
        self.assertTrue(RichTextImage.objects.filter(id=first.id).exists())

    def test_co_admin_keeps_images_of_another_admin(self):
        project = self.make_project()
        foreign = self.upload(self.other)
        RichTextImageUsage.objects.create(
            image=foreign, project=project, field=RichTextImageUsage.PROJECT_DESCRIPTION
        )
        response = self.patch(project, {"description_html": figure(foreign.id)})
        self.assertEqual(response.status_code, 200, response.data)
        project.refresh_from_db()
        self.assertEqual(rich_text_image_ids(project.description_html), {foreign.id})

    def test_image_used_by_another_project_cannot_be_copied(self):
        other_project = self.make_project()
        foreign = self.upload(self.other)
        RichTextImageUsage.objects.create(
            image=foreign,
            project=other_project,
            field=RichTextImageUsage.PROJECT_DESCRIPTION,
        )
        project = self.make_project()
        self.patch(project, {"description_html": figure(foreign.id)})
        project.refresh_from_db()
        self.assertEqual(rich_text_image_ids(project.description_html), set())

    def test_image_kept_while_used_in_a_translation(self):
        image = self.upload()
        project = self.make_project()
        self.patch(
            project,
            {
                "description_html": figure(image.id),
                "translations": {
                    "de": {
                        "is_manual_translation": True,
                        "description_html": figure(image.id),
                    }
                },
            },
        )
        self.patch(project, {"description_html": "<p>No images in English</p>"})
        self.assertEqual(self.usage_ids(project), {image.id})

    def test_someone_elses_image_in_a_translation_edit_is_removed(self):
        foreign = self.upload(self.other)
        project = self.make_project()
        response = self.patch(
            project,
            {
                "translations": {
                    "de": {
                        "is_manual_translation": True,
                        "description_html": "<p>Text</p>" + figure(foreign.id),
                    }
                },
            },
        )
        self.assertEqual(response.status_code, 200, response.data)
        translation = ProjectTranslation.objects.get(
            project=project, language=self.german
        )
        self.assertEqual(translation.description_html_translation, "<p>Text</p>")
        self.assertEqual(self.usage_ids(project), set())

    def test_ten_images_per_language_version(self):
        project = self.make_project()
        image = self.upload()
        ten = "".join(figure(image.id) for _ in range(10))
        response = self.patch(
            project,
            {
                "description_html": ten,
                "translations": {
                    "de": {"is_manual_translation": True, "description_html": ten}
                },
            },
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_rejected_translation_leaves_project_unchanged(self):
        project = self.make_project("<p>Before</p>")
        image = self.upload()
        response = self.patch(
            project,
            {
                "description_html": "<p>After</p>",
                "short_description": "Changed",
                "translations": {
                    "de": {
                        "is_manual_translation": True,
                        "description_html": figure(image.id) * 11,
                    }
                },
            },
        )
        self.assertEqual(response.status_code, 400)
        project.refresh_from_db()
        self.assertEqual(project.description_html, "<p>Before</p>")
        self.assertNotEqual(project.short_description, "Changed")

    def test_usages_are_synced_even_if_translating_fails(self):
        # The edit is not atomic: the project is saved before the translations.
        project = self.make_project()
        image = self.upload()
        with (
            mock.patch(
                "organization.views.project_views.edit_translations",
                side_effect=RuntimeError("DeepL down"),
            ),
            self.assertRaises(RuntimeError),
        ):
            self.patch(
                project,
                {
                    "description_html": figure(image.id),
                    "translations": {"de": {"is_manual_translation": False}},
                },
            )
        project.refresh_from_db()
        self.assertEqual(rich_text_image_ids(project.description_html), {image.id})
        self.assertEqual(self.usage_ids(project), {image.id})

    def test_legacy_description_unlinks_images(self):
        project = self.make_project()
        image = self.upload()
        self.patch(project, {"description_html": figure(image.id)})
        self.assertEqual(self.usage_ids(project), {image.id})

        response = self.patch(project, {"description": "Plain text only"})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.usage_ids(project), set())


class SizesAttributeTests(TestCase):
    """Same cases as sizesAttribute in the frontend (richTextImageStyles.ts)."""

    def test_never_exceeds_the_natural_width(self):
        self.assertEqual(
            sizes_attribute("image-size-full", 1200), "(max-width: 600px) 100vw, 1168px"
        )
        self.assertEqual(
            sizes_attribute("image-size-small", 1200), "(max-width: 600px) 50vw, 390px"
        )
        self.assertEqual(
            sizes_attribute("image-size-medium", 1200), "(max-width: 600px) 75vw, 584px"
        )
        self.assertEqual(
            sizes_attribute("image-size-full", 800), "(max-width: 600px) 100vw, 800px"
        )
        self.assertEqual(
            sizes_attribute("image-size-full", 220),
            "(max-width: 220px) 100vw, (max-width: 600px) 220px, 220px",
        )
        self.assertEqual(
            sizes_attribute("image-size-small", 220),
            "(max-width: 440px) 50vw, (max-width: 600px) 220px, 220px",
        )

"""Tests for POST /api/translate_many/ (DeepL preview used by the translation editors)."""

from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from climateconnect_api.views import translation_views


def fake_translate_text(text, original_lang, target_lang, is_html=False):
    return {"translated_text": f"[{'html' if is_html else 'text'}] {text}"}


class TranslateManyTextsTests(TestCase):
    url = "/api/translate_many/"

    def post(self, payload):
        with mock.patch.object(
            translation_views, "translate_text", side_effect=fake_translate_text
        ) as translate_text:
            response = APIClient().post(self.url, payload, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data["translations"], translate_text

    def test_html_keys_are_translated_as_html(self):
        translations, _ = self.post(
            {
                "texts": {
                    "name": "Name",
                    "description_html": '<figure><img alt="A" data-image-id="1"></figure>',
                },
                "html_keys": ["description_html"],
                "target_language": "en",
            }
        )
        self.assertTrue(
            translations["description_html"]["translated_text"].startswith("[html]")
        )
        self.assertTrue(translations["name"]["translated_text"].startswith("[text]"))

    def test_without_html_keys_everything_is_plain_text(self):
        _, translate_text = self.post(
            {"texts": {"description_html": "<p>Hi</p>"}, "target_language": "en"}
        )
        self.assertFalse(translate_text.call_args.kwargs["is_html"])

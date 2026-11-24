"""
Unit tests for the Mailjet client selection in climateconnect_api.utility.email_setup.

Without Mailjet API keys (local development, CI) API calls are printed to the
console instead of being sent.
"""

import io
from contextlib import redirect_stdout

from django.test import SimpleTestCase, override_settings
from mailjet_rest import Client

from climateconnect_api.utility.email_setup import (
    ConsoleMailjetClient,
    _mailjet_client,
)


class MailjetClientSelectionTests(SimpleTestCase):
    @override_settings(MJ_APIKEY_PUBLIC="public", MJ_APIKEY_PRIVATE="private")
    def test_uses_mailjet_with_keys(self):
        self.assertIsInstance(_mailjet_client(version="v3.1"), Client)

    @override_settings(MJ_APIKEY_PUBLIC="", MJ_APIKEY_PRIVATE="")
    def test_falls_back_to_console_without_keys(self):
        with self.assertLogs("climateconnect_api.utility.email_setup", "WARNING"):
            client = _mailjet_client(version="v3.1")
        self.assertIsInstance(client, ConsoleMailjetClient)

    @override_settings(MJ_APIKEY_PUBLIC="public", MJ_APIKEY_PRIVATE="")
    def test_falls_back_to_console_with_one_key_missing(self):
        with self.assertLogs("climateconnect_api.utility.email_setup", "WARNING"):
            client = _mailjet_client()
        self.assertIsInstance(client, ConsoleMailjetClient)


class ConsoleMailjetClientTests(SimpleTestCase):
    def call(self, func, *args, **kwargs):
        out = io.StringIO()
        with redirect_stdout(out):
            response = func(*args, **kwargs)
        return response, out.getvalue()

    def test_send_prints_message_and_succeeds(self):
        data = {
            "Messages": [
                {
                    "To": [{"Email": "ada@example.org", "Name": "Ada"}],
                    "Subject": "Aktiviere dein Konto",
                    "Variables": {"url": "https://example.org/activate/abc"},
                    "Attachments": [
                        {"Filename": "event.ics", "Base64Content": "QkVHSU4="}
                    ],
                }
            ]
        }
        response, out = self.call(ConsoleMailjetClient().send.create, data=data)

        self.assertEqual(response.status_code, 200)
        self.assertIn("[Mailjet console] POST send", out)
        self.assertIn("ada@example.org", out)
        self.assertIn("Aktiviere dein Konto", out)
        self.assertIn("https://example.org/activate/abc", out)
        self.assertIn("event.ics", out)
        self.assertNotIn("QkVHSU4=", out)
        # The caller's data is left untouched.
        self.assertEqual(
            data["Messages"][0]["Attachments"][0]["Base64Content"], "QkVHSU4="
        )

    def test_contact_api_answers_like_mailjet(self):
        client = ConsoleMailjetClient()

        response, out = self.call(client.contact.get, "ada@example.org")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["Data"][0]["ID"], 0)
        self.assertIn("GET contact ada@example.org", out)

        response, _ = self.call(
            client.listrecipient.create, data={"ContactID": 0, "ListID": 1}
        )
        self.assertEqual(response.status_code, 201)

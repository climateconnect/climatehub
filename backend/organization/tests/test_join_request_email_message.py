"""
Tests for the optional join request message in the admin notification email
(issue #2308).

``send_join_project_request_email`` must pass the request's message to Mailjet
as the template variable ``RequesterMessage``: plain text, exactly as stored
(no escaping, no ``<br>``), and always present (``""`` for ``None``/empty).

``send_email`` is mocked where it is looked up (``organization.utility.email``),
so the real Mailjet API is never called.
"""

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, tag
from django.utils import timezone

from climateconnect_api.models import Availability
from organization.models import Project
from organization.models.members import MembershipRequests
from organization.utility import MembershipTarget
from organization.utility.email import send_join_project_request_email


@tag("join_request_email_message")
class SendJoinProjectRequestEmailMessageTest(TestCase):
    def setUp(self):
        # The admin has no UserProfile, so the language falls back to English.
        self.admin = User.objects.create_user(
            username="join_email_admin",
            email="join_email_admin@test.com",
            password="pw",
            first_name="Adam",
            last_name="Admin",
        )
        self.requester = User.objects.create_user(
            username="join_email_requester",
            email="join_email_requester@test.com",
            password="pw",
            first_name="Ada",
            last_name="Lovelace",
        )
        self.project = Project.objects.create(
            name="Solar Roof", url_slug="solar-roof-join-email"
        )
        self.availability = Availability.objects.create(name="a", key="a")

    def _create_request(self, message):
        return MembershipRequests.objects.create(
            user=self.requester,
            target_membership_type=MembershipTarget.PROJECT.value,
            target_project=self.project,
            availability=self.availability,
            requested_at=timezone.now(),
            message=message,
        )

    def _send(self, request, hub_url=None):
        """Call the function with ``send_email`` mocked; return the mock."""
        with patch("organization.utility.email.send_email") as mock_send_email:
            send_join_project_request_email(
                user=self.admin,
                request=request,
                requester=self.requester,
                notification=None,
                hub_url=hub_url,
            )
        mock_send_email.assert_called_once()
        return mock_send_email

    def _variables(self, request, hub_url=None):
        return self._send(request, hub_url).call_args.kwargs["variables"]

    def test_message_is_passed_as_requester_message(self):
        request = self._create_request("Hi, I would love to help with the roof!")
        variables = self._variables(request)
        self.assertEqual(
            variables["RequesterMessage"], "Hi, I would love to help with the roof!"
        )

    def test_empty_message_gives_empty_string(self):
        request = self._create_request("")
        variables = self._variables(request)
        self.assertIn("RequesterMessage", variables)
        self.assertEqual(variables["RequesterMessage"], "")

    def test_none_message_gives_empty_string_not_none(self):
        request = self._create_request(None)
        variables = self._variables(request)
        self.assertIn("RequesterMessage", variables)
        self.assertEqual(variables["RequesterMessage"], "")
        self.assertIsNotNone(variables["RequesterMessage"])
        self.assertNotEqual(variables["RequesterMessage"], "None")

    def test_special_characters_are_passed_unchanged(self):
        messages = [
            'I <3 climate & Tom &amp; Jerry "quoted"',
            "&lt;script&gt;alert(1)&lt;/script&gt;",
            "line1\nline2",
            "line1\r\nline2\n\nline4",
            "Planet 🌍 und Umlaute: äöüß",
            "Ampersand & less < greater > 'single' \"double\"",
        ]
        for message in messages:
            with self.subTest(message=message):
                # One request per user and project is allowed, so clear the previous one.
                MembershipRequests.objects.all().delete()
                request = self._create_request(message)
                variables = self._variables(request)
                # Exactly as stored: no escaping, no <br>, no newline conversion.
                self.assertEqual(variables["RequesterMessage"], message)
                self.assertNotIn("<br", variables["RequesterMessage"])
                self.assertNotIn("&lt;br", variables["RequesterMessage"])

    def test_line_breaks_stay_as_newlines(self):
        request = self._create_request("line1\nline2")
        variables = self._variables(request)
        self.assertEqual(variables["RequesterMessage"], "line1\nline2")
        self.assertEqual(variables["RequesterMessage"].split("\n"), ["line1", "line2"])

    def test_stored_message_is_not_modified(self):
        message = 'I <3 climate & Tom &amp; Jerry "quoted"\nnew line 🌍'
        request = self._create_request(message)
        self._variables(request)
        # The object passed in is untouched ...
        self.assertEqual(request.message, message)
        # ... and so is the database row.
        request.refresh_from_db()
        self.assertEqual(request.message, message)

    def test_none_message_stays_none_on_the_request(self):
        request = self._create_request(None)
        self._variables(request)
        self.assertIsNone(request.message)
        request.refresh_from_db()
        self.assertIsNone(request.message)

    def test_existing_variables_are_still_present(self):
        request = self._create_request("Hello")
        variables = self._variables(request)
        self.assertEqual(variables["RequesterName"], "Ada Lovelace")
        self.assertEqual(variables["FirstName"], "Adam")
        self.assertEqual(variables["ProjectName"], "Solar Roof")
        self.assertTrue(
            variables["url"].endswith(
                "/projects/solar-roof-join-email?show_join_requests=true"
            )
        )
        self.assertEqual(
            set(variables.keys()),
            {"RequesterName", "FirstName", "ProjectName", "url", "RequesterMessage"},
        )

    def test_hub_url_handling_is_unchanged(self):
        request = self._create_request("Hello")
        mock_send_email = self._send(request, hub_url="perth")
        variables = mock_send_email.call_args.kwargs["variables"]
        self.assertTrue(variables["url"].endswith("?show_join_requests=true&hub=perth"))
        self.assertEqual(mock_send_email.call_args.kwargs["hub_url"], "perth")

    def test_send_email_arguments_are_unchanged(self):
        request = self._create_request("Hello")
        call_kwargs = self._send(request).call_args.kwargs
        self.assertEqual(call_kwargs["user"], self.admin)
        self.assertEqual(
            call_kwargs["template_key"], "PROJECT_JOIN_REQUEST_TEMPLATE_ID"
        )
        self.assertEqual(
            call_kwargs["should_send_email_setting"], "email_on_join_request"
        )
        self.assertEqual(
            call_kwargs["subjects_by_language"]["en"],
            "Ada Lovelace requested to join your project",
        )
        self.assertIn("Ada Lovelace", call_kwargs["subjects_by_language"]["de"])

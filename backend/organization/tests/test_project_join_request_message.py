from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, tag
from django.urls import reverse

from climateconnect_api.models import Availability, UserProfile
from organization.models import Project
from organization.models.members import MembershipRequests
from organization.utility.requests import MEMBERSHIP_REQUEST_MESSAGE_MAX_LENGTH


@tag("project_join_request_message")
class ProjectJoinRequestMessageTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="joiner", email="joiner@test.com", password="pw"
        )
        self.profile = UserProfile.objects.create(
            user=self.user, url_slug="joiner-slug", name="Joiner"
        )
        self.availability = Availability.objects.create(name="a", key="a")
        self.project = Project.objects.create(name="P", url_slug="p-slug")
        self.client.force_login(self.user)
        self.url = reverse(
            "organization:request-join-entity",
            kwargs={"url_slug": "p-slug", "user_slug": "joiner-slug"},
        )

    def _post(self, data):
        data = {"user_availability": self.availability.id, **data}
        with patch(
            "organization.views.project_views.get_project_admin_creators",
            return_value=[],
        ), patch(
            "organization.views.project_views.create_project_join_request_notification"
        ):
            return self.client.post(self.url, data, content_type="application/json")

    def _stored(self):
        return MembershipRequests.objects.get(user=self.user).message

    def test_message_stored(self):
        self.assertEqual(self._post({"message": "Hi there"}).status_code, 200)
        self.assertEqual(self._stored(), "Hi there")

    def test_html_rejected(self):
        for message in [
            "<b>Hi</b>",
            "<script>x</script>",
            "<<script>script>alert(1)<</script>/script>",
        ]:
            with self.subTest(message=message):
                self.assertEqual(self._post({"message": message}).status_code, 400)
        self.assertFalse(MembershipRequests.objects.exists())

    def test_plain_text_with_special_characters_stored_unchanged(self):
        message = 'I <3 climate & Tom &amp; Jerry "quoted"\nnew line 🌍'
        self.assertEqual(self._post({"message": f"  {message} "}).status_code, 200)
        self.assertEqual(self._stored(), message)

    def test_entity_encoded_html_stored_as_inert_text(self):
        message = "&lt;script&gt;alert(1)&lt;/script&gt;"
        self.assertEqual(self._post({"message": message}).status_code, 200)
        self.assertEqual(self._stored(), message)

    def test_max_length_accepted_and_exceeded_rejected(self):
        n = MEMBERSHIP_REQUEST_MESSAGE_MAX_LENGTH
        self.assertEqual(self._post({"message": "a" * n}).status_code, 200)
        MembershipRequests.objects.all().delete()
        response = self._post({"message": "a" * (n + 1)})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(MembershipRequests.objects.exists())

    def test_empty_and_missing_message_accepted(self):
        self.assertEqual(self._post({"message": ""}).status_code, 200)
        MembershipRequests.objects.all().delete()
        self.assertEqual(self._post({}).status_code, 200)
        self.assertEqual(self._stored(), "")

    def test_duplicate_request_rejected(self):
        self._post({"message": "one"})
        self.assertEqual(self._post({"message": "two"}).status_code, 400)
        self.assertEqual(MembershipRequests.objects.count(), 1)

from unittest.mock import patch

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from chat_messages.models import Message, MessageParticipants, Participant
from climateconnect_api.models import Availability, Language, Role, UserProfile
from organization.models import Project, ProjectMember
from organization.models.members import MembershipRequests
from organization.utility import MembershipTarget, RequestStatus


class TestJoinRequestResponseChat(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name="Admin", role_type=Role.ALL_TYPE)
        self.member_role = Role.objects.create(
            name="Member", role_type=Role.READ_ONLY_TYPE
        )
        self.admin = self._user("admin1")
        self.admin2 = self._user("admin2")
        self.plain_member = self._user("plain")
        self.requester = self._user("requester")
        self.stranger = self._user("stranger")
        self.project = Project.objects.create(name="Solar P", url_slug="solar-p")
        self.other_project = Project.objects.create(name="Other", url_slug="other-p")
        for user, role in (
            (self.admin, self.admin_role),
            (self.admin2, self.admin_role),
            (self.plain_member, self.member_role),
        ):
            ProjectMember.objects.create(user=user, project=self.project, role=role)
        self.availability = Availability.objects.create(name="1h", key="1h-resp")
        self.join_request = self._request(self.requester, "Hello, I can help")

    def _user(self, name):
        user = User.objects.create_user(username=name, password="pw")
        UserProfile.objects.create(
            user=user,
            name=name,
            url_slug=name,
            language=Language.objects.get(language_code="en"),
        )
        return user

    def _request(self, user, message, project=None):
        return MembershipRequests.objects.create(
            user=user,
            target_membership_type=MembershipTarget.PROJECT.value,
            target_project=project or self.project,
            availability=self.availability,
            requested_at=timezone.now(),
            request_status=RequestStatus.PENDING.value,
            message=message,
        )

    def _respond(self, request_id=None, slug=None):
        return self.client.post(
            reverse(
                "organization:respond-to-join-request",
                kwargs={
                    "url_slug": slug or self.project.url_slug,
                    "request_id": request_id or self.join_request.id,
                },
            )
        )

    def test_respond_creates_group_chat(self):
        self.client.force_authenticate(self.admin)
        response = self._respond()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["created"])
        self.join_request.refresh_from_db()
        chat = self.join_request.response_chat
        self.assertEqual(str(chat.chat_uuid), response.data["chat_uuid"])
        self.assertIn("Solar P", chat.name)
        users = set(
            Participant.objects.filter(chat=chat).values_list("user_id", flat=True)
        )
        self.assertEqual(users, {self.admin.id, self.admin2.id, self.requester.id})

    def test_seed_message_with_origin(self):
        self.client.force_authenticate(self.admin)
        self._respond()
        self.join_request.refresh_from_db()
        message = Message.objects.get(
            message_participant=self.join_request.response_chat
        )
        self.assertEqual(message.sender, self.requester)
        self.assertEqual(message.content, "Hello, I can help")
        self.assertEqual(message.origin_type, "membership_request")
        self.assertEqual(message.origin_id, self.join_request.id)
        self.assertEqual(message.sent_at, self.join_request.requested_at)

    def test_no_message_no_seed(self):
        self.join_request.message = ""
        self.join_request.save()
        self.client.force_authenticate(self.admin)
        self._respond()
        self.join_request.refresh_from_db()
        self.assertFalse(
            Message.objects.filter(
                message_participant=self.join_request.response_chat
            ).exists()
        )

    def test_second_admin_reuses_chat(self):
        self.client.force_authenticate(self.admin)
        first = self._respond()
        Participant.objects.filter(user=self.admin2).delete()
        self.client.force_authenticate(self.admin2)
        second = self._respond()
        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.data["created"])
        self.assertEqual(first.data["chat_uuid"], second.data["chat_uuid"])
        self.assertTrue(
            Participant.objects.filter(
                user=self.admin2, chat__chat_uuid=second.data["chat_uuid"]
            ).exists()
        )

    def test_idempotent_double_call(self):
        self.client.force_authenticate(self.admin)
        self._respond()
        self._respond()
        self.assertEqual(MessageParticipants.objects.count(), 1)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(self.plain_member)
        self.assertEqual(self._respond().status_code, 403)
        self.client.force_authenticate(self.requester)
        self.assertEqual(self._respond().status_code, 403)

    def test_wrong_project_404(self):
        foreign = self._request(self.stranger, "x", project=self.other_project)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self._respond(request_id=foreign.id).status_code, 404)

    def test_rate_limit_only_on_create(self):
        self.client.force_authenticate(self.admin)
        with patch(
            "chat_messages.utility.chat_setup.check_can_start_chat",
            return_value="Too many chats",
        ):
            self.assertEqual(self._respond().status_code, 403)
        self.assertEqual(self._respond().status_code, 200)
        with patch(
            "chat_messages.utility.chat_setup.check_can_start_chat",
            return_value="Too many chats",
        ):
            again = self._respond()
        self.assertEqual(again.status_code, 200)
        self.assertFalse(again.data["created"])

    def test_deleted_chat_resets_link(self):
        self.client.force_authenticate(self.admin)
        self._respond()
        self.join_request.refresh_from_db()
        self.join_request.response_chat.delete()
        self.join_request.refresh_from_db()
        self.assertIsNone(self.join_request.response_chat)
        response = self._respond()
        self.assertTrue(response.data["created"])

    def test_origin_view_permissions(self):
        self.client.force_authenticate(self.admin)
        self._respond()
        url = reverse(
            "chat_messages:membership-request-origin",
            kwargs={"request_id": self.join_request.id},
        )
        for user in (self.requester, self.admin2):
            self.client.force_authenticate(user)
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["project_url_slug"], "solar-p")
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get(url).status_code, 403)

import asyncio
from unittest.mock import patch as mock_patch

from django.contrib.auth.models import User
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from chat_messages.consumer import DirectMessageConsumer
from chat_messages.models import Message, MessageReceiver, Participant
from chat_messages.serializers.message import MessageSerializer
from chat_messages.utility.chat_setup import get_or_create_private_chat
from climateconnect_api.models import Language, Role
from organization.models import Organization, OrganizationMember

LONG_MESSAGE = "word " * 60


def _setup_roles():
    admin_role, _ = Role.objects.get_or_create(
        name="Super-Admin", defaults={"role_type": Role.ALL_TYPE}
    )
    Role.objects.get_or_create(
        name="Administrator", defaults={"role_type": Role.READ_WRITE_TYPE}
    )
    read_only, _ = Role.objects.get_or_create(
        role_type=Role.READ_ONLY_TYPE, defaults={"name": "Read Only"}
    )
    return admin_role, read_only


def _get_language():
    # TransactionTestCase flushes the Language rows the test runner seeds
    language, _ = Language.objects.get_or_create(
        language_code="de", defaults={"name": "German", "native_name": "Deutsch"}
    )
    return language


def _create_org(slug="origin-org"):
    return Organization.objects.create(
        name="Origin Org " + slug,
        url_slug=slug,
        language=_get_language(),
    )


class OrganizationOriginFixtureMixin:
    def _fixture(self):
        self.admin_role, self.read_only_role = _setup_roles()
        self.creator = User.objects.create_user("org_creator", password="pw")
        self.second_admin = User.objects.create_user("org_admin2", password="pw")
        self.member = User.objects.create_user("org_member", password="pw")
        self.sender = User.objects.create_user("org_sender", password="pw")
        self.org = _create_org()
        OrganizationMember.objects.create(
            user=self.creator, organization=self.org, role=self.admin_role
        )
        OrganizationMember.objects.create(
            user=self.second_admin, organization=self.org, role=self.admin_role
        )
        OrganizationMember.objects.create(
            user=self.member, organization=self.org, role=self.read_only_role
        )
        self.chat = get_or_create_private_chat(
            self.sender, self.creator, created_by=self.sender
        )


class TestSendMessageOrganizationOrigin(OrganizationOriginFixtureMixin, APITestCase):
    def setUp(self):
        self._fixture()
        self.url = reverse("chat_messages:send_message", args=[self.chat.chat_uuid])
        self.client.force_authenticate(self.sender)

    def _post(self, **extra):
        with (
            mock_patch("chat_messages.views.message_views.create_email_notification"),
            mock_patch("chat_messages.views.message_views.create_user_notification"),
        ):
            return self.client.post(
                self.url, {"message_content": LONG_MESSAGE, **extra}, format="json"
            )

    def test_valid_origin_is_stored_and_serialized(self):
        response = self._post(origin_organization_url_slug=self.org.url_slug)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "organization")
        self.assertEqual(message.origin_id, self.org.id)
        data = MessageSerializer(message, context={"request": None}).data
        self.assertEqual(data["origin_type"], "organization")
        self.assertEqual(data["origin_id"], self.org.id)

    def test_no_origin_leaves_origin_empty_and_adds_nobody(self):
        response = self._post()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "")
        self.assertIsNone(message.origin_id)
        self.assertEqual(Participant.objects.filter(chat=self.chat).count(), 2)

    def test_unknown_slug_is_rejected(self):
        response = self._post(origin_organization_url_slug="does-not-exist")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
        self.assertFalse(Message.objects.exists())

    def test_org_without_admin_in_chat_is_rejected(self):
        other = _create_org("other-org")
        response = self._post(origin_organization_url_slug=other.url_slug)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Message.objects.exists())
        self.assertEqual(Participant.objects.filter(chat=self.chat).count(), 2)

    def test_multiple_origins_are_rejected(self):
        response = self._post(
            origin_organization_url_slug=self.org.url_slug,
            origin_project_url_slug="some-project",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_admins_join_once_and_receive_message(self):
        self._post(origin_organization_url_slug=self.org.url_slug)
        self._post(origin_organization_url_slug=self.org.url_slug)
        participants = Participant.objects.filter(chat=self.chat, is_active=True)
        self.assertEqual(
            set(participants.values_list("user_id", flat=True)),
            {self.sender.id, self.creator.id, self.second_admin.id},
        )
        self.assertEqual(participants.count(), 3)
        self.assertFalse(participants.filter(user=self.member).exists())
        self.assertEqual(
            MessageReceiver.objects.filter(receiver=self.second_admin).count(), 2
        )

    def test_added_admin_can_reply(self):
        self._post(origin_organization_url_slug=self.org.url_slug)
        self.client.force_authenticate(self.second_admin)
        response = self._post()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rejected_message_adds_nobody(self):
        # Too short first message: 411 must not leave admins added to the chat.
        with (
            mock_patch("chat_messages.views.message_views.create_email_notification"),
            mock_patch("chat_messages.views.message_views.create_user_notification"),
        ):
            response = self.client.post(
                self.url,
                {
                    "message_content": "hi",
                    "origin_organization_url_slug": self.org.url_slug,
                },
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_411_LENGTH_REQUIRED)
        self.assertEqual(Participant.objects.filter(chat=self.chat).count(), 2)


class TestConsumerOrganizationOrigin(
    OrganizationOriginFixtureMixin, TransactionTestCase
):
    def setUp(self):
        self._fixture()

    def _send(self, data):
        consumer = DirectMessageConsumer()

        async def run():
            with (
                mock_patch("chat_messages.consumer.create_email_notification"),
                mock_patch("chat_messages.consumer.create_user_notification"),
            ):
                return await consumer.new_message(
                    self.chat.chat_uuid, self.sender, "hi", data
                )

        asyncio.run(run())

    def test_valid_origin(self):
        self._send({"origin_organization_url_slug": self.org.url_slug})
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "organization")
        self.assertEqual(message.origin_id, self.org.id)
        self.assertTrue(
            Participant.objects.filter(
                chat=self.chat, user=self.second_admin, is_active=True
            ).exists()
        )

    def test_invalid_origin_delivers_untagged(self):
        self._send({"origin_organization_url_slug": "nope"})
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "")
        self.assertIsNone(message.origin_id)
        self.assertEqual(Participant.objects.filter(chat=self.chat).count(), 2)

    def test_absent_origin(self):
        self._send({})
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "")


class TestOrganizationOriginView(OrganizationOriginFixtureMixin, APITestCase):
    def setUp(self):
        self._fixture()
        self.url = reverse("organization:organization-origin", args=[self.org.id])
        Message.objects.create(
            content="x",
            sender=self.sender,
            message_participant=self.chat,
            origin_type="organization",
            origin_id=self.org.id,
        )

    def test_chat_participant(self):
        self.client.force_authenticate(self.sender)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["organization_name"], self.org.name)
        self.assertEqual(response.data["organization_url_slug"], self.org.url_slug)

    def test_org_admin(self):
        self.client.force_authenticate(self.second_admin)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)

    def test_unrelated_user_forbidden(self):
        stranger = User.objects.create_user("stranger", password="pw")
        self.client.force_authenticate(stranger)
        self.assertEqual(
            self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_unknown_organization(self):
        self.client.force_authenticate(self.sender)
        url = reverse("organization:organization-origin", args=[999999])
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous(self):
        self.assertEqual(
            self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED
        )

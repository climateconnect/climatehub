from datetime import timedelta
from unittest.mock import patch as mock_patch

from django.contrib.auth.models import User
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from chat_messages.consumer import DirectMessageConsumer
from chat_messages.models import Message
from chat_messages.utility.chat_setup import get_or_create_private_chat
from climateconnect_api.models import Language, Role
from organization.models import Project, ProjectMember, ProjectStatus

LONG_MESSAGE = "word " * 60


def _setup_project(slug="origin-project"):
    status_obj, _ = ProjectStatus.objects.get_or_create(
        id=2,
        defaults={
            "name": "active_origin",
            "name_de_translation": "aktiv",
            "has_end_date": True,
            "has_start_date": True,
        },
    )
    language, _ = Language.objects.get_or_create(
        language_code="en", defaults={"name": "English", "native_name": "English"}
    )
    admin_role, _ = Role.objects.get_or_create(
        name="Super-Admin", defaults={"role_type": Role.ALL_TYPE}
    )
    Role.objects.get_or_create(
        name="Administrator", defaults={"role_type": Role.READ_WRITE_TYPE}
    )
    Role.objects.get_or_create(
        role_type=Role.READ_ONLY_TYPE, defaults={"name": "Read Only"}
    )
    project = Project.objects.create(
        name="Origin Project",
        url_slug=slug,
        is_active=True,
        is_draft=False,
        status=status_obj,
        language=language,
        project_type="EV",
        start_date=timezone.now() + timedelta(days=30),
        end_date=timezone.now() + timedelta(days=90),
    )
    return project, admin_role


class TestSendMessageOrigin(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("origin_admin", password="pw")
        self.sender = User.objects.create_user("origin_sender", password="pw")
        self.project, role = _setup_project()
        ProjectMember.objects.create(user=self.admin, project=self.project, role=role)
        self.other_project, _ = _setup_project("other-origin-project")
        self.chat = get_or_create_private_chat(
            self.sender, self.admin, created_by=self.sender
        )
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

    def test_valid_origin_is_stored(self):
        response = self._post(origin_project_url_slug=self.project.url_slug)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "project")
        self.assertEqual(message.origin_id, self.project.id)

    def test_no_origin_leaves_origin_empty(self):
        response = self._post()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "")
        self.assertIsNone(message.origin_id)

    def test_unknown_slug_returns_400(self):
        response = self._post(origin_project_url_slug="does-not-exist")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Message.objects.exists())

    def test_project_without_admin_in_chat_returns_400(self):
        response = self._post(origin_project_url_slug=self.other_project.url_slug)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Message.objects.exists())


class TestProjectOriginView(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user("po_admin", password="pw")
        self.sender = User.objects.create_user("po_sender", password="pw")
        self.stranger = User.objects.create_user("po_stranger", password="pw")
        self.project, role = _setup_project("po-project")
        ProjectMember.objects.create(user=self.admin, project=self.project, role=role)
        chat = get_or_create_private_chat(
            self.sender, self.admin, created_by=self.sender
        )
        Message.objects.create(
            content="hi",
            sender=self.sender,
            message_participant=chat,
            sent_at=timezone.now(),
            origin_type="project",
            origin_id=self.project.id,
        )
        self.url = reverse("organization:project-origin", args=[self.project.id])

    def test_participant_gets_context(self):
        self.client.force_authenticate(self.sender)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "project_name": self.project.name,
                "project_url_slug": self.project.url_slug,
                "project_type": "EV",
            },
        )

    def test_admin_gets_context(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def test_unrelated_user_forbidden(self):
        self.client.force_authenticate(self.stranger)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_unknown_project_404(self):
        self.client.force_authenticate(self.sender)
        url = reverse("organization:project-origin", args=[999999])
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_anonymous_unauthorized(self):
        self.assertEqual(self.client.get(self.url).status_code, 401)


class TestConsumerOrigin(TransactionTestCase):
    def setUp(self):
        self.admin = User.objects.create_user("co_admin", password="pw")
        self.sender = User.objects.create_user("co_sender", password="pw")
        self.project, role = _setup_project("co-project")
        ProjectMember.objects.create(user=self.admin, project=self.project, role=role)
        self.chat = get_or_create_private_chat(
            self.sender, self.admin, created_by=self.sender
        )

    def _send(self, slug):
        consumer = DirectMessageConsumer()
        with (
            mock_patch("chat_messages.consumer.create_email_notification"),
            mock_patch("chat_messages.consumer.create_user_notification"),
        ):
            return consumer.new_message(self.chat.chat_uuid, self.sender, "hi", slug)

    async def _run(self, slug):
        return await self._send(slug)

    def test_valid_origin(self):
        import asyncio

        asyncio.run(self._run(self.project.url_slug))
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(
            (message.origin_type, message.origin_id), ("project", self.project.id)
        )

    def test_invalid_origin_keeps_message(self):
        import asyncio

        asyncio.run(self._run("nope"))
        message = Message.objects.get(message_participant=self.chat)
        self.assertEqual(message.origin_type, "")

    def test_no_origin(self):
        import asyncio

        asyncio.run(self._run(None))
        self.assertEqual(Message.objects.get().origin_type, "")

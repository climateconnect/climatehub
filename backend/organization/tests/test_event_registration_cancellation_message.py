from datetime import timedelta
from unittest.mock import patch as mock_patch

from django.contrib.auth.models import User
from django.test import tag
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from chat_messages.models import Message, MessageReceiver
from chat_messages.utility.chat_setup import get_or_create_private_chat
from climateconnect_api.models import Language, Role
from organization.models import Project, ProjectMember, ProjectStatus
from organization.models.event_registration import (
    EventRegistration,
    EventRegistrationConfig,
)
from organization.tasks import send_cancellation_chat_message


class TestCancellationChatTask(APITestCase):
    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_cancel_message_task",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )

        self.organiser = User.objects.create_user(
            username="organiser_cancel_message_task",
            password="testpassword",
            first_name="Org",
            last_name="Owner",
        )
        self.guest = User.objects.create_user(
            username="guest_cancel_message_task",
            password="testpassword",
            first_name="Guest",
            last_name="User",
        )

        # Required by get_project_admin_creators(...) and get_or_create_private_chat(...)
        self.admin_role, _ = Role.objects.get_or_create(
            name="Super-Admin",
            defaults={"role_type": Role.ALL_TYPE},
        )
        Role.objects.get_or_create(
            name="Administrator",
            defaults={"role_type": Role.READ_WRITE_TYPE},
        )
        Role.objects.get_or_create(
            role_type=Role.READ_ONLY_TYPE,
            defaults={"name": "Read Only"},
        )

        self.event = Project.objects.create(
            name="Cancellation Message Event",
            url_slug="cancellation-message-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        ProjectMember.objects.create(
            user=self.organiser,
            project=self.event,
            role=self.admin_role,
        )
        self.registration_config = EventRegistrationConfig.objects.create(
            project=self.event,
            max_participants=50,
            registration_end_date=timezone.now() + timedelta(days=60),
            status="open",
        )
        self.registration = EventRegistration.objects.create(
            user=self.guest,
            registration_config=self.registration_config,
        )

    @tag("cancel_registration", "cancellation_message")
    def test_task_creates_origin_message(self):
        with (
            mock_patch(
                "climateconnect_api.utility.notification.create_email_notification"
            ) as mock_email,
            mock_patch(
                "climateconnect_api.utility.notification.create_user_notification"
            ) as mock_user_notif,
        ):
            send_cancellation_chat_message.run(
                guest_user_id=self.guest.id,
                project_url_slug=self.event.url_slug,
                registration_id=self.registration.id,
                message="I cannot attend anymore.",
            )

        message = Message.objects.get(
            origin_type="event_registration",
            origin_id=self.registration.id,
            sender=self.guest,
        )
        self.assertEqual(message.content, "I cannot attend anymore.")
        self.assertTrue(
            MessageReceiver.objects.filter(
                message=message, receiver=self.organiser
            ).exists()
        )
        mock_user_notif.assert_called_once()
        mock_email.assert_called_once()

    @tag("cancel_registration", "cancellation_message")
    def test_task_reuses_existing_private_chat(self):
        first_chat = get_or_create_private_chat(
            self.guest,
            self.organiser,
            created_by=self.guest,
        )

        with (
            mock_patch(
                "climateconnect_api.utility.notification.create_email_notification"
            ),
            mock_patch(
                "climateconnect_api.utility.notification.create_user_notification"
            ),
        ):
            send_cancellation_chat_message.run(
                guest_user_id=self.guest.id,
                project_url_slug=self.event.url_slug,
                registration_id=self.registration.id,
                message="First",
            )
            send_cancellation_chat_message.run(
                guest_user_id=self.guest.id,
                project_url_slug=self.event.url_slug,
                registration_id=self.registration.id,
                message="Second",
            )

        messages = Message.objects.filter(
            sender=self.guest,
            origin_type="event_registration",
            origin_id=self.registration.id,
        ).order_by("id")
        self.assertEqual(messages.count(), 2)
        self.assertEqual(messages[0].message_participant_id, first_chat.id)
        self.assertEqual(messages[1].message_participant_id, first_chat.id)

    @tag("cancel_registration", "cancellation_message")
    def test_task_is_idempotent_for_retry_same_payload(self):
        with (
            mock_patch(
                "climateconnect_api.utility.notification.create_email_notification"
            ),
            mock_patch(
                "climateconnect_api.utility.notification.create_user_notification"
            ),
        ):
            send_cancellation_chat_message.run(
                guest_user_id=self.guest.id,
                project_url_slug=self.event.url_slug,
                registration_id=self.registration.id,
                message="Retry-safe cancellation message",
            )
            # Simulate Celery retry of the exact same payload.
            send_cancellation_chat_message.run(
                guest_user_id=self.guest.id,
                project_url_slug=self.event.url_slug,
                registration_id=self.registration.id,
                message="Retry-safe cancellation message",
            )

        messages = Message.objects.filter(
            sender=self.guest,
            origin_type="event_registration",
            origin_id=self.registration.id,
            content="Retry-safe cancellation message",
        )
        self.assertEqual(messages.count(), 1)
        self.assertEqual(
            MessageReceiver.objects.filter(
                message=messages.first(), receiver=self.organiser
            ).count(),
            1,
        )


class TestEventRegistrationOriginEndpoint(APITestCase):
    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_cancel_message_origin",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )

        self.organiser = User.objects.create_user(
            username="organiser_cancel_message_origin",
            password="testpassword",
        )
        self.guest = User.objects.create_user(
            username="guest_cancel_message_origin",
            password="testpassword",
        )
        self.outsider = User.objects.create_user(
            username="outsider_cancel_message_origin",
            password="testpassword",
        )

        # Required by get_project_admin_creators(...) and get_or_create_private_chat(...)
        self.admin_role, _ = Role.objects.get_or_create(
            name="Super-Admin",
            defaults={"role_type": Role.ALL_TYPE},
        )
        Role.objects.get_or_create(
            name="Administrator",
            defaults={"role_type": Role.READ_WRITE_TYPE},
        )
        Role.objects.get_or_create(
            role_type=Role.READ_ONLY_TYPE,
            defaults={"name": "Read Only"},
        )

        self.event = Project.objects.create(
            name="Origin Endpoint Event",
            url_slug="origin-endpoint-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        ProjectMember.objects.create(
            user=self.organiser,
            project=self.event,
            role=self.admin_role,
        )

        self.registration_config = EventRegistrationConfig.objects.create(
            project=self.event,
            max_participants=10,
            registration_end_date=timezone.now() + timedelta(days=60),
            status="open",
        )
        self.registration = EventRegistration.objects.create(
            user=self.guest,
            registration_config=self.registration_config,
        )

        self.chat = get_or_create_private_chat(
            self.guest,
            self.organiser,
            created_by=self.guest,
        )
        self.message = Message.objects.create(
            message_participant=self.chat,
            content="I need to cancel",
            sender=self.guest,
            origin_type="event_registration",
            origin_id=self.registration.id,
            sent_at=timezone.now(),
        )
        MessageReceiver.objects.create(receiver=self.organiser, message=self.message)

    def _origin_url(self, registration_id):
        return reverse(
            "chat_messages:event-registration-origin",
            kwargs={"registration_id": registration_id},
        )

    @tag("cancel_registration", "cancellation_message")
    def test_participant_can_read_origin(self):
        self.client.login(
            username="organiser_cancel_message_origin", password="testpassword"
        )
        response = self.client.get(self._origin_url(self.registration.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["event_name"], self.event.name)
        self.assertEqual(response.data["event_url_slug"], self.event.url_slug)

    @tag("cancel_registration", "cancellation_message")
    def test_unrelated_user_gets_403(self):
        self.client.login(
            username="outsider_cancel_message_origin", password="testpassword"
        )
        response = self.client.get(self._origin_url(self.registration.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @tag("cancel_registration", "cancellation_message")
    def test_missing_registration_returns_404(self):
        self.client.login(
            username="organiser_cancel_message_origin", password="testpassword"
        )
        response = self.client.get(self._origin_url(999999))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

"""
Tests for multi-seat event registrations ("bring guests").

A registration books 1..N seats (``EventRegistration.number_of_seats``), capped
per registration by ``EventRegistrationConfig.max_seats_per_registration``.
Every capacity site sums seats over active registrations.

See spec: doc/spec/20261021_1235_event_registration_guest_seats.md
"""

import threading
from datetime import timedelta
from unittest.mock import patch as mock_patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TransactionTestCase, tag
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from climateconnect_api.models import Language, Role
from organization.models import Project, ProjectMember, ProjectStatus
from organization.models.event_registration import (
    EventRegistration,
    EventRegistrationConfig,
    RegistrationFieldAnswer,
    RegistrationStatus,
)
from organization.models.registration_field import (
    RegistrationField,
    RegistrationFieldType,
)
from organization.serializers.event_registration import (
    EventRegistrationConfigSerializer,
)
from organization.utility.email import (
    format_seats,
    send_admin_event_notification,
    send_event_registration_confirmation_to_user,
)
from organization.utility.event_registration import (
    evaluate_registration_status,
    get_available_seats,
    get_booked_seats,
)


def _create_event(slug, max_participants=10, max_seats_per_registration=1):
    project_status, _ = ProjectStatus.objects.update_or_create(
        id=2,
        defaults={
            "name": "active_seats",
            "name_de_translation": "aktiv",
            "has_end_date": True,
            "has_start_date": True,
        },
    )
    language, _ = Language.objects.get_or_create(
        language_code="en",
        defaults={"name": "English", "native_name": "English"},
    )
    event = Project.objects.create(
        name="Seats Test Event",
        url_slug=slug,
        is_active=True,
        is_draft=False,
        status=project_status,
        language=language,
        project_type="EV",
        start_date=timezone.now() + timedelta(days=30),
        end_date=timezone.now() + timedelta(days=90),
    )
    rc = EventRegistrationConfig.objects.create(
        project=event,
        max_participants=max_participants,
        max_seats_per_registration=max_seats_per_registration,
        registration_end_date=timezone.now() + timedelta(days=60),
        status=RegistrationStatus.OPEN,
    )
    return event, rc


class _SeatsTestBase(APITestCase):
    def setUp(self):
        self.event, self.rc = _create_event(
            "seats-test-event", max_participants=5, max_seats_per_registration=3
        )
        self.organiser = User.objects.create_user(
            username="organiser_seats", password="x"
        )
        role = Role.objects.create(name="Admin_seats", role_type=Role.ALL_TYPE)
        ProjectMember.objects.create(user=self.organiser, project=self.event, role=role)
        self.user_counter = 0

    def _make_user(self, **kwargs):
        self.user_counter += 1
        return User.objects.create_user(
            username=f"seats_user_{self.user_counter}", password="x", **kwargs
        )

    def _registrations_url(self):
        return reverse(
            "organization:event-registrations",
            kwargs={"url_slug": self.event.url_slug},
        )

    def _config_url(self):
        return reverse(
            "organization:edit-registration-config",
            kwargs={"url_slug": self.event.url_slug},
        )

    def _register(self, user, payload=None):
        self.client.force_authenticate(user=user)
        return self.client.post(self._registrations_url(), payload or {}, format="json")

    def _seed(self, number_of_seats, cancelled=False):
        user = self._make_user()
        reg = EventRegistration.objects.create(
            user=user,
            registration_config=self.rc,
            number_of_seats=number_of_seats,
        )
        if cancelled:
            reg.cancelled_at = timezone.now()
            reg.cancelled_by = user
            reg.save()
        return reg


# ---------------------------------------------------------------------------
# Shared seat calculation
# ---------------------------------------------------------------------------


class TestSeatCalculation(_SeatsTestBase):
    @tag("event_registration", "seats")
    def test_booked_seats_sum_active_registrations_only(self):
        self._seed(3)
        self._seed(1)
        self._seed(2, cancelled=True)
        self.assertEqual(get_booked_seats(self.rc), 4)
        self.assertEqual(get_available_seats(self.rc), 1)

    @tag("event_registration", "seats")
    def test_available_seats_none_for_unlimited_capacity(self):
        self.rc.max_participants = None
        self.rc.save()
        self._seed(3)
        self.assertIsNone(get_available_seats(self.rc))
        self.assertEqual(evaluate_registration_status(self.rc), RegistrationStatus.OPEN)

    @tag("event_registration", "seats")
    def test_full_when_booked_seats_reach_max_participants(self):
        self._seed(3)
        self.assertEqual(evaluate_registration_status(self.rc), RegistrationStatus.OPEN)
        self._seed(2)
        self.assertEqual(evaluate_registration_status(self.rc), RegistrationStatus.FULL)

    @tag("event_registration", "seats")
    def test_config_serializer_available_seats_counts_seats(self):
        self._seed(3)
        data = EventRegistrationConfigSerializer(
            self.rc, context={"include_seat_count": True}
        ).data
        self.assertEqual(data["available_seats"], 2)
        self.assertEqual(data["max_seats_per_registration"], 3)

    @tag("event_registration", "seats")
    def test_defaults_are_one_seat(self):
        """AC-12: new rows default to one seat / one seat per registration."""
        rc = EventRegistrationConfig.objects.create(
            project=Project.objects.create(
                name="Defaults", url_slug="seats-defaults-event", project_type="EV"
            )
        )
        rc.refresh_from_db()
        self.assertEqual(rc.max_seats_per_registration, 1)
        reg = EventRegistration.objects.create(
            user=self._make_user(), registration_config=rc
        )
        reg.refresh_from_db()
        self.assertEqual(reg.number_of_seats, 1)


# ---------------------------------------------------------------------------
# POST /registrations/
# ---------------------------------------------------------------------------


class TestRegisterWithSeats(_SeatsTestBase):
    @tag("event_registration", "seats")
    def test_post_without_number_of_seats_books_one_seat(self):
        """AC-13: backward compatible — no seat count = exactly one seat."""
        response = self._register(self._make_user())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["available_seats"], 4)
        self.assertEqual(EventRegistration.objects.get().number_of_seats, 1)

    @tag("event_registration", "seats")
    def test_idempotent_repost_keeps_seat_count(self):
        user = self._make_user()
        self._register(user, {"number_of_seats": 2})
        response = self._register(user, {"number_of_seats": 3})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["available_seats"], 3)
        self.assertEqual(EventRegistration.objects.get().number_of_seats, 2)

    @tag("event_registration", "seats")
    def test_multi_seat_booking_reduces_available_seats_by_n(self):
        response = self._register(self._make_user(), {"number_of_seats": 3})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["available_seats"], 2)
        self.assertEqual(EventRegistration.objects.get().number_of_seats, 3)
        self.rc.refresh_from_db()
        self.assertEqual(self.rc.status, RegistrationStatus.OPEN)

    @tag("event_registration", "seats")
    def test_status_full_when_last_seats_taken(self):
        self._register(self._make_user(), {"number_of_seats": 3})
        response = self._register(self._make_user(), {"number_of_seats": 2})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["available_seats"], 0)
        self.rc.refresh_from_db()
        self.assertEqual(self.rc.status, RegistrationStatus.FULL)

    @tag("event_registration", "seats")
    def test_over_capacity_refused_names_remaining_seats_and_saves_nothing(self):
        field = RegistrationField.objects.create(
            registration_config=self.rc,
            field_type=RegistrationFieldType.CHECKBOX,
            order=0,
            is_required=False,
            label="Consent",
            settings={"description": "I agree"},
        )
        self._seed(3)
        response = self._register(
            self._make_user(),
            {
                "number_of_seats": 3,
                "answers": [{"field": field.id, "value_boolean": True}],
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["available_seats"], 2)
        self.assertIn("2 seats", response.data["message"])
        self.assertEqual(EventRegistration.objects.count(), 1)
        self.assertEqual(RegistrationFieldAnswer.objects.count(), 0)

    @tag("event_registration", "seats")
    def test_over_capacity_refusal_singular_message(self):
        self._seed(3)
        self._seed(1)
        response = self._register(self._make_user(), {"number_of_seats": 2})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["available_seats"], 1)
        self.assertIn("1 seat ", response.data["message"])

    @tag("event_registration", "seats")
    def test_per_registration_maximum_enforced_server_side(self):
        self.rc.max_participants = 100
        self.rc.save()
        response = self._register(self._make_user(), {"number_of_seats": 4})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["max_seats_per_registration"], 3)
        self.assertEqual(EventRegistration.objects.count(), 0)

    @tag("event_registration", "seats")
    def test_default_max_one_rejects_guests(self):
        """AC-12: events without the setting allow no guests."""
        self.rc.max_seats_per_registration = 1
        self.rc.save()
        response = self._register(self._make_user(), {"number_of_seats": 2})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(EventRegistration.objects.count(), 0)

    @tag("event_registration", "seats")
    def test_invalid_number_of_seats_rejected(self):
        for value in (0, -1, "abc"):
            response = self._register(self._make_user(), {"number_of_seats": value})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("number_of_seats", response.data)
        self.assertEqual(EventRegistration.objects.count(), 0)

    @tag("event_registration", "seats")
    def test_unlimited_capacity_capped_by_per_registration_maximum_only(self):
        self.rc.max_participants = None
        self.rc.save()
        response = self._register(self._make_user(), {"number_of_seats": 3})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["available_seats"])

    @tag("event_registration", "seats")
    def test_time_slot_taken_once_per_registration(self):
        """AC-8: a multi-seat registration takes a time slot once."""
        self.rc.max_participants = 100
        self.rc.save()
        field = RegistrationField.objects.create(
            registration_config=self.rc,
            field_type=RegistrationFieldType.TIME_SLOT_SELECT,
            order=0,
            is_required=True,
            label="Slot",
            settings={"title": "Pick a slot"},
        )
        option = field.options.create(
            title="Morning",
            order=0,
            available_amount=2,
            start_time=timezone.now() + timedelta(days=30),
            end_time=timezone.now() + timedelta(days=30, hours=1),
        )
        payload = {
            "number_of_seats": 3,
            "answers": [{"field": field.id, "value_option": option.id}],
        }
        self.assertEqual(
            self._register(self._make_user(), payload).status_code,
            status.HTTP_201_CREATED,
        )
        self.assertEqual(
            self._register(self._make_user(), payload).status_code,
            status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Cancellation and re-registration
# ---------------------------------------------------------------------------


class TestSeatsCancellation(_SeatsTestBase):
    @tag("event_registration", "seats")
    def test_self_cancel_frees_all_seats_and_reopens(self):
        user = self._make_user()
        self._register(user, {"number_of_seats": 3})
        self._register(self._make_user(), {"number_of_seats": 2})
        self.rc.refresh_from_db()
        self.assertEqual(self.rc.status, RegistrationStatus.FULL)

        self.client.force_authenticate(user=user)
        response = self.client.delete(self._registrations_url())
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.rc.refresh_from_db()
        self.assertEqual(self.rc.status, RegistrationStatus.OPEN)
        self.assertEqual(get_available_seats(self.rc), 3)
        # Cancelled row keeps its seat count for display (AC-10).
        self.assertEqual(EventRegistration.objects.get(user=user).number_of_seats, 3)

    @tag("event_registration", "seats")
    def test_admin_cancel_frees_all_seats(self):
        reg = self._seed(3)
        self._seed(2)
        self.rc.status = RegistrationStatus.FULL
        self.rc.save()

        self.client.force_authenticate(user=self.organiser)
        url = reverse(
            "organization:admin-cancel-guest-registration",
            kwargs={"url_slug": self.event.url_slug, "registration_id": reg.id},
        )
        response = self.client.patch(url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.rc.refresh_from_db()
        self.assertEqual(self.rc.status, RegistrationStatus.OPEN)
        self.assertEqual(get_available_seats(self.rc), 3)

    @tag("event_registration", "seats")
    def test_reregistration_replaces_seat_count(self):
        user = self._make_user()
        self._register(user, {"number_of_seats": 3})
        self.client.force_authenticate(user=user)
        self.client.delete(self._registrations_url())

        response = self._register(user, {"number_of_seats": 2})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["available_seats"], 3)
        self.assertEqual(EventRegistration.objects.get(user=user).number_of_seats, 2)

    @tag("event_registration", "seats")
    def test_reregistration_without_seat_count_resets_to_one(self):
        user = self._make_user()
        self._register(user, {"number_of_seats": 3})
        self.client.force_authenticate(user=user)
        self.client.delete(self._registrations_url())

        self._register(user)
        self.assertEqual(EventRegistration.objects.get(user=user).number_of_seats, 1)


# ---------------------------------------------------------------------------
# Organiser attendee list + config PATCH
# ---------------------------------------------------------------------------


class TestSeatsOrganiserContracts(_SeatsTestBase):
    @tag("event_registration", "seats")
    def test_attendee_list_includes_number_of_seats_for_all_rows(self):
        self._seed(3)
        self._seed(2, cancelled=True)
        self.client.force_authenticate(user=self.organiser)
        response = self.client.get(self._registrations_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["number_of_seats"] for row in response.data], [3, 2])

    @tag("event_registration", "seats")
    def test_patch_max_seats_per_registration_round_trips(self):
        self.client.force_authenticate(user=self.organiser)
        response = self.client.patch(
            self._config_url(), {"max_seats_per_registration": 4}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["max_seats_per_registration"], 4)
        self.rc.refresh_from_db()
        self.assertEqual(self.rc.max_seats_per_registration, 4)
        # Partial update: other fields untouched.
        self.assertEqual(self.rc.max_participants, 5)

    @tag("event_registration", "seats")
    def test_patch_without_max_seats_preserves_stored_value(self):
        self.client.force_authenticate(user=self.organiser)
        response = self.client.patch(
            self._config_url(), {"max_participants": 8}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.rc.refresh_from_db()
        self.assertEqual(self.rc.max_seats_per_registration, 3)

    @tag("event_registration", "seats")
    def test_patch_max_seats_below_one_rejected(self):
        self.client.force_authenticate(user=self.organiser)
        for value in (0, -2, None):
            response = self.client.patch(
                self._config_url(), {"max_seats_per_registration": value}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("max_seats_per_registration", response.data)

    @tag("event_registration", "seats")
    def test_lowering_max_seats_keeps_existing_registrations(self):
        """AC-2."""
        reg = self._seed(3)
        self.client.force_authenticate(user=self.organiser)
        self.client.patch(
            self._config_url(), {"max_seats_per_registration": 1}, format="json"
        )
        reg.refresh_from_db()
        self.assertEqual(reg.number_of_seats, 3)

    @tag("event_registration", "seats")
    def test_lowering_max_participants_below_booked_seats_rejected(self):
        self._seed(3)
        self.client.force_authenticate(user=self.organiser)
        response = self.client.patch(
            self._config_url(), {"max_participants": 2}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("booked seats (3)", str(response.data["max_participants"]))

    @tag("event_registration", "seats")
    def test_lowering_max_participants_to_booked_seats_sets_full(self):
        self._seed(3)
        self.client.force_authenticate(user=self.organiser)
        response = self.client.patch(
            self._config_url(), {"max_participants": 3}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], RegistrationStatus.FULL)
        self.assertEqual(response.data["available_seats"], 0)

    @tag("event_registration", "seats")
    def test_reopen_guard_uses_booked_seats(self):
        self._seed(3)
        self._seed(2)
        self.rc.status = RegistrationStatus.CLOSED
        self.rc.save()
        self.client.force_authenticate(user=self.organiser)
        response = self.client.patch(
            self._config_url(), {"status": "open"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

        response = self.client.patch(
            self._config_url(),
            {"status": "open", "max_participants": 6},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], RegistrationStatus.OPEN)


# ---------------------------------------------------------------------------
# Emails
# ---------------------------------------------------------------------------


class TestSeatsEmails(_SeatsTestBase):
    def _capture(self):
        captured = {}

        def capture_send_email(
            user, variables, template_key, subjects_by_language, **kwargs
        ):
            captured["variables"] = variables

        return captured, capture_send_email

    @tag("event_registration", "seats", "email")
    def test_format_seats_singular_and_plural(self):
        self.assertEqual(format_seats(1, "en"), "1 seat")
        self.assertEqual(format_seats(2, "en"), "2 seats")
        self.assertEqual(format_seats(1, "de"), "1 Platz")
        self.assertEqual(format_seats(3, "de"), "3 Plätze")

    def _send_confirmation(self, reg, lang="en"):
        captured, side_effect = self._capture()
        with (
            mock_patch(
                "organization.utility.email.get_user_lang_code", return_value=lang
            ),
            mock_patch(
                "organization.utility.email.send_email", side_effect=side_effect
            ),
        ):
            send_event_registration_confirmation_to_user(
                user=reg.user, project=self.event, registration=reg
            )
        return captured["variables"]["FieldAnswersHtml"]

    @tag("event_registration", "seats", "email")
    def test_confirmation_email_names_seats(self):
        self.assertIn("You booked 3 seats.", self._send_confirmation(self._seed(3)))
        self.assertIn("You booked 1 seat.", self._send_confirmation(self._seed(1)))
        self.assertIn(
            "Du hast 2 Plätze gebucht.", self._send_confirmation(self._seed(2), "de")
        )
        self.assertIn(
            "Du hast 1 Platz gebucht.", self._send_confirmation(self._seed(1), "de")
        )

    @tag("event_registration", "seats", "email")
    def test_confirmation_email_unchanged_for_single_seat_events(self):
        self.rc.max_seats_per_registration = 1
        self.rc.save()
        self.assertEqual(self._send_confirmation(self._seed(1)), "")

    def _send_admin(self, number_of_seats, lang="en", change_type="registered"):
        captured, side_effect = self._capture()
        with (
            mock_patch(
                "organization.utility.email.get_user_lang_code", return_value=lang
            ),
            mock_patch(
                "organization.utility.email.send_email", side_effect=side_effect
            ),
        ):
            send_admin_event_notification(
                admin_user=self.organiser,
                project=self.event,
                guest_user=self._make_user(first_name="Ada"),
                change_type=change_type,
                number_of_seats=number_of_seats,
            )
        return captured["variables"]["Body"]

    @tag("event_registration", "seats", "email")
    def test_admin_notification_names_seats(self):
        self.assertIn("(3 seats)", self._send_admin(3))
        self.assertIn("(1 seat)", self._send_admin(1))
        self.assertIn("angemeldet (2 Plätze)", self._send_admin(2, "de"))
        self.assertIn("storniert (1 Platz)", self._send_admin(1, "de", "cancelled"))
        self.assertNotIn("seat", self._send_admin(None))

    @tag("event_registration", "seats", "email")
    def test_admin_notification_task_passes_seat_count(self):
        from organization.tasks import notify_admins_of_registration_change

        reg = self._seed(2)
        with mock_patch(
            "organization.utility.email.send_admin_event_notification"
        ) as mock_send:
            notify_admins_of_registration_change.apply(
                kwargs={
                    "project_id": self.event.id,
                    "guest_user_id": reg.user_id,
                    "change_type": "registered",
                }
            )
        self.assertEqual(mock_send.call_args.kwargs["number_of_seats"], 2)

        self.rc.max_seats_per_registration = 1
        self.rc.save()
        reg.number_of_seats = 1
        reg.save()
        with mock_patch(
            "organization.utility.email.send_admin_event_notification"
        ) as mock_send:
            notify_admins_of_registration_change.apply(
                kwargs={
                    "project_id": self.event.id,
                    "guest_user_id": reg.user_id,
                    "change_type": "registered",
                }
            )
        self.assertIsNone(mock_send.call_args.kwargs["number_of_seats"])


# ---------------------------------------------------------------------------
# Concurrency (real transactions + threads)
# ---------------------------------------------------------------------------


class TestSeatsConcurrency(TransactionTestCase):
    """
    TransactionTestCase so both threads see committed rows. No
    serialized_rollback: other TransactionTestCases flush the DB and
    content types get recreated with new ids, so restoring the snapshot
    would collide on their unique key.
    """

    @tag("event_registration", "seats", "concurrency")
    def test_concurrent_multi_seat_signups_never_overbook(self):
        """Two 3-seat sign-ups for 5 seats: exactly one succeeds."""
        event, rc = _create_event(
            "seats-race-event", max_participants=5, max_seats_per_registration=3
        )
        users = [
            User.objects.create_user(username=f"race_user_{i}", password="x")
            for i in range(2)
        ]
        url = reverse(
            "organization:event-registrations", kwargs={"url_slug": event.url_slug}
        )
        barrier = threading.Barrier(len(users))
        results = []

        def sign_up(user):
            try:
                client = APIClient()
                client.force_authenticate(user=user)
                barrier.wait()
                results.append(
                    client.post(url, {"number_of_seats": 3}, format="json").status_code
                )
            finally:
                connection.close()

        with (
            mock_patch(
                "organization.views.event_registration_views._send_registration_email"
            ),
            mock_patch(
                "organization.views.event_registration_views._notify_admins_task"
            ),
        ):
            threads = [threading.Thread(target=sign_up, args=(u,)) for u in users]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        self.assertEqual(
            sorted(results),
            [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST],
        )
        self.assertEqual(get_booked_seats(rc), 3)

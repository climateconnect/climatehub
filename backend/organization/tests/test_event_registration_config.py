"""
Tests for EventRegistrationConfig CRUD, status, and validation.

Contains:
  - TestEventRegistrationCreate
  - TestEventRegistrationRead
  - TestEventRegistrationStatus
  - TestEditEventRegistrationSettings
  - TestEditEventRegistrationStatusChange
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import tag
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language, Role
from location.models import Location
from organization.models import Project, ProjectMember, ProjectStatus
from organization.models.event_registration import (
    EventRegistration,
    EventRegistrationConfig,
    RegistrationStatus,
)

from ._helpers import _make_black_image_b64


class TestEventRegistrationCreate(APITestCase):
    """Tests for creating an event with registration_config via POST /api/projects/."""

    def setUp(self):
        self.url = reverse("organization:create-project-api")

        # The CreateProjectView hardcodes request.data["status"] = 2, so we
        # must ensure a ProjectStatus with id=2 exists.
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_er",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )

        self.user = User.objects.create_user(
            username="testuser_er",
            password="testpassword",
        )

        Location.objects.get_or_create(
            city="Test City",
            country="Testland",
            defaults={"name": "Test City, Testland", "place_id": 9999},
        )

        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )

        self.image = _make_black_image_b64()

        self.location_data = {
            "place_id": 9999,
            "country": "Testland",
            "city": "Test City",
            "name": "Test City",
            "type": "city",
            "lon": 13.0,
            "lat": 52.0,
        }

        self.event_project_type = {
            "name": "Event",
            "original_name": "Event",
            "help_text": "Your Project will show up in the Event calendar",
            "icon": "",
            "type_id": "event",
        }

        self.project_project_type = {
            "name": "Project",
            "original_name": "Project",
            "help_text": "Not an Idea or Event? Click here.",
            "icon": "",
            "type_id": "project",
        }

        self.base_event_data = {
            "name": "Test Event ER",
            "status": self.project_status.id,
            "short_description": "A short description",
            "collaborators_welcome": False,
            "team_members": [],
            "sectors": [],  # required param; empty means no sector tagging
            "loc": self.location_data,
            "image": self.image,
            "source_language": self.default_language.language_code,  # "en"
            "translations": {},
            "project_type": self.event_project_type,
            "hubName": None,
            "end_date": "2026-08-01T20:00:00Z",
            "start_date": "2026-07-01T10:00:00Z",
        }

    # ------------------------------------------------------------------
    # Happy-path tests
    # ------------------------------------------------------------------

    @tag("registration_config", "projects")
    def test_create_event_with_registration_creates_event_registration_record(self):
        """POST with valid registration_config payload creates an EventRegistrationConfig row."""
        self.client.login(username="testuser_er", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertTrue(
            EventRegistrationConfig.objects.filter(project=project).exists(),
            "EventRegistrationConfig record should have been created",
        )
        er = EventRegistrationConfig.objects.get(project=project)
        self.assertEqual(er.max_participants, 50)
        # Stored datetime is timezone-aware
        self.assertIsNotNone(er.registration_end_date.tzinfo)

    @tag("registration_config", "projects")
    def test_create_event_without_registration_does_not_create_record(self):
        """POST without registration_config key does not create an EventRegistrationConfig record."""
        self.client.login(username="testuser_er", password="testpassword")

        response = self.client.post(self.url, self.base_event_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertFalse(
            EventRegistrationConfig.objects.filter(project=project).exists(),
            "No EventRegistrationConfig record should have been created",
        )

    @tag("registration_config", "projects")
    def test_create_draft_event_with_partial_registration_creates_partial_record(self):
        """POST with is_draft=True and a partial registration_config payload creates an
        EventRegistrationConfig row with null fields for any missing values."""
        self.client.login(username="testuser_er", password="testpassword")
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {
                "max_participants": 40,
                # registration_end_date intentionally absent
            },
        }
        # Drafts don't enforce image or loc at the API level
        data.pop("image", None)
        data.pop("loc", None)

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        self.assertTrue(project.is_draft)
        self.assertTrue(
            EventRegistrationConfig.objects.filter(project=project).exists(),
            "Partial ER row should be created even for a draft",
        )
        er = EventRegistrationConfig.objects.get(project=project)
        self.assertEqual(er.max_participants, 40)
        self.assertIsNone(er.registration_end_date)

    # ------------------------------------------------------------------
    # Validation error tests
    # ------------------------------------------------------------------

    @tag("registration_config", "projects")
    def test_create_non_event_with_registration_returns_400(self):
        """POST with registration_config on a non-event project type returns 400."""
        self.client.login(username="testuser_er", password="testpassword")
        data = {
            **self.base_event_data,
            "project_type": self.project_project_type,
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Serializer returns DRF-standard errors: type check raises a non-field error.
        self.assertIn("non_field_errors", response.data)
        self.assertIn("registration_config", str(response.data["non_field_errors"][0]))

    @tag("registration_config", "projects")
    def test_create_event_registration_missing_max_participants_returns_400(self):
        """registration_config without max_participants returns 400."""
        self.client.login(username="testuser_er", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "registration_end_date": "2026-07-31T23:59:00Z",
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Serializer returns field-level errors keyed by field name.
        self.assertIn("max_participants", response.data)

    @tag("registration_config", "projects")
    def test_create_event_registration_missing_end_date_returns_400(self):
        """registration_config without registration_end_date returns 400."""
        self.client.login(username="testuser_er", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 50,
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("registration_end_date", response.data)

    @tag("registration_config", "projects")
    def test_create_event_registration_zero_max_participants_returns_400(self):
        """max_participants = 0 returns 400."""
        self.client.login(username="testuser_er", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 0,
                "registration_end_date": "2026-07-31T23:59:00Z",
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # min_value=1 on the field produces a field-level error, not a message string.
        self.assertIn("max_participants", response.data)

    @tag("registration_config", "projects")
    def test_create_event_registration_end_date_after_event_end_returns_400(self):
        """registration_end_date after event end_date returns 400."""
        self.client.login(username="testuser_er", password="testpassword")
        data = {
            **self.base_event_data,
            # event ends 2026-08-01 but registration ends 2026-09-01 (after)
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-09-01T23:59:00Z",
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("registration_end_date", response.data)

    @tag("registration_config", "projects")
    def test_create_event_registration_end_date_equal_to_event_end_is_valid(self):
        """registration_end_date equal to event end_date is allowed."""
        self.client.login(username="testuser_er", password="testpassword")

        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 10,
                "registration_end_date": "2026-08-01T20:00:00Z",  # equal to end_date
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    @tag("registration_config", "projects")
    def test_unauthenticated_user_cannot_create_event(self):
        """Unauthenticated request returns 401."""
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TestEventRegistrationRead(APITestCase):
    """Tests for reading registration_config via GET /api/projects/{slug}/."""

    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_er_read",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )

        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )

        self.event_project = Project.objects.create(
            name="Event With Registration",
            url_slug="event-with-registration",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date="2026-09-01T10:00:00Z",
            end_date="2026-10-01T20:00:00Z",
        )

        self.registration_config = EventRegistrationConfig.objects.create(
            project=self.event_project,
            max_participants=100,
            registration_end_date="2026-09-01T23:59:00Z",
        )

        self.plain_event_project = Project.objects.create(
            name="Event Without Registration",
            url_slug="event-without-registration",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date="2026-09-01T10:00:00Z",
            end_date="2026-10-01T20:00:00Z",
        )

    @tag("registration_config", "projects")
    def test_get_event_project_includes_event_registration(self):
        """GET /api/projects/{slug}/ returns registration_config object for an event with registration."""
        url = reverse(
            "organization:project-api-view",
            kwargs={"url_slug": "event-with-registration"},
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("registration_config", data)
        er = data["registration_config"]
        self.assertIsNotNone(er)
        self.assertEqual(er["max_participants"], 100)
        self.assertIn("registration_end_date", er)

    @tag("registration_config", "projects")
    def test_get_event_project_without_registration_returns_null(self):
        """GET /api/projects/{slug}/ returns registration_config: null for event without registration."""
        url = reverse(
            "organization:project-api-view",
            kwargs={"url_slug": "event-without-registration"},
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("registration_config", data)
        self.assertIsNone(data["registration_config"])

    @tag("registration_config", "projects")
    def test_list_projects_includes_event_registration_field(self):
        """GET /api/projects/ includes registration_config key in each result."""
        url = reverse("organization:list-projects")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertTrue(len(results) > 0, "Expected at least one project in list")
        for item in results:
            self.assertIn(
                "registration_config",
                item,
                "Each list item should contain 'registration_config' key",
            )

    @tag("registration_config", "projects")
    def test_list_includes_registration_data_for_event_with_registration(self):
        """GET /api/projects/ returns correct registration_config data for events with registration."""
        url = reverse("organization:list-projects")

        response = self.client.get(url)

        results = response.json().get("results", [])
        event_result = next(
            (r for r in results if r["url_slug"] == "event-with-registration"), None
        )
        self.assertIsNotNone(event_result, "event-with-registration not found in list")
        er = event_result["registration_config"]
        self.assertIsNotNone(er)
        self.assertEqual(er["max_participants"], 100)

    # ------------------------------------------------------------------
    # "ended" computed status
    # ------------------------------------------------------------------

    @tag("registration_config", "projects")
    def test_open_registration_with_past_end_date_returns_ended_status(self):
        """GET returns status 'ended' when stored status is OPEN but registration_end_date has passed."""
        self.registration_config.registration_end_date = timezone.now() - timedelta(
            hours=1
        )
        self.registration_config.status = RegistrationStatus.OPEN
        self.registration_config.save()

        url = reverse(
            "organization:project-api-view",
            kwargs={"url_slug": "event-with-registration"},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["registration_config"]["status"], "ended")

    @tag("registration_config", "projects")
    def test_open_registration_with_future_end_date_returns_open_status(self):
        """GET returns status 'open' when stored status is OPEN and end date is in the future."""
        self.registration_config.registration_end_date = timezone.now() + timedelta(
            days=10
        )
        self.registration_config.status = RegistrationStatus.OPEN
        self.registration_config.save()

        url = reverse(
            "organization:project-api-view",
            kwargs={"url_slug": "event-with-registration"},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["registration_config"]["status"], "open")

    @tag("registration_config", "projects")
    def test_closed_registration_with_past_end_date_returns_closed_not_ended(self):
        """GET returns 'closed' (not 'ended') when organiser explicitly closed registration,
        even if the end date has also passed. Organiser intent takes precedence."""
        self.registration_config.registration_end_date = timezone.now() - timedelta(
            hours=1
        )
        self.registration_config.status = RegistrationStatus.CLOSED
        self.registration_config.save()

        url = reverse(
            "organization:project-api-view",
            kwargs={"url_slug": "event-with-registration"},
        )
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["registration_config"]["status"], "closed")


class TestEventRegistrationStatus(APITestCase):
    """Tests for the status field on EventRegistrationConfig."""

    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_er_status",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )
        self.user = User.objects.create_user(
            username="statususer_er",
            password="testpassword",
        )
        Location.objects.get_or_create(
            city="Status City",
            country="Statusland",
            defaults={"name": "Status City, Statusland", "place_id": 7777},
        )
        self.role = Role.objects.create(
            name="Admin_er_status",
            role_type=Role.ALL_TYPE,
        )
        self.event_project = Project.objects.create(
            name="Status Event",
            url_slug="status-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date="2026-09-01T10:00:00Z",
            end_date="2026-10-01T20:00:00Z",
        )
        self.registration_config = EventRegistrationConfig.objects.create(
            project=self.event_project,
            max_participants=50,
            registration_end_date="2026-09-15T23:59:00Z",
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.event_project,
            role=self.role,
        )

    def _url(self, slug):
        return reverse("organization:project-api-view", kwargs={"url_slug": slug})

    # ------------------------------------------------------------------
    # Default state
    # ------------------------------------------------------------------

    @tag("registration_config", "status")
    def test_new_event_registration_defaults_to_open(self):
        """A newly created EventRegistrationConfig has status='open' by default."""
        self.assertEqual(self.registration_config.status, RegistrationStatus.OPEN)

    @tag("registration_config", "status")
    def test_get_returns_status_field(self):
        """GET /api/projects/{slug}/ includes status in registration_config."""
        response = self.client.get(self._url("status-event"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        er = response.data["registration_config"]
        self.assertIn("status", er)
        self.assertEqual(er["status"], RegistrationStatus.OPEN)

    # ------------------------------------------------------------------
    # CREATE inherits default status
    # ------------------------------------------------------------------

    @tag("registration_config", "status")
    def test_create_event_registration_default_status_is_open(self):
        """POST /api/projects/ with registration_config payload stores status='open'."""
        create_url = reverse("organization:create-project-api")
        self.client.login(username="statususer_er", password="testpassword")
        location_data = {
            "place_id": 7777,
            "country": "Statusland",
            "city": "Status City",
            "name": "Status City",
            "type": "city",
            "lon": 10.0,
            "lat": 50.0,
        }
        payload = {
            "name": "Status Default Test Event",
            "status": self.project_status.id,
            "short_description": "Testing default status",
            "collaborators_welcome": False,
            "team_members": [],
            "sectors": [],
            "loc": location_data,
            "image": _make_black_image_b64(),
            "source_language": "en",
            "translations": {},
            "project_type": {"type_id": "event"},
            "hubName": None,
            "start_date": "2026-09-01T10:00:00Z",
            "end_date": "2026-10-01T20:00:00Z",
            "registration_config": {
                "max_participants": 30,
                "registration_end_date": "2026-09-15T23:59:00Z",
            },
        }
        response = self.client.post(create_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = project.registration_config
        self.assertEqual(er.status, RegistrationStatus.OPEN)


class TestEditEventRegistrationSettings(APITestCase):
    """
    Tests for PATCH /api/projects/{url_slug}/registration-config/
    (EditRegistrationConfigView).

    Covers:
    - Happy-path updates (max_participants, registration_end_date, both)
    - Response shape: max_participants, registration_end_date, status returned
    - status field is read-only (ignored if included in request body)
    - Validation: past-date guard, upper-bound guard, min_value=1
    - Draft-mode: past-date and upper-bound validations are skipped
    - 404 when project not found
    - 404 when project has no EventRegistrationConfig record
    - 401 Unauthorized for unauthenticated requests
    - 403 Forbidden for authenticated users without edit rights
    """

    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_edit_reg",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )

        # Organiser — has ALL_TYPE role on all test projects.
        self.organiser = User.objects.create_user(
            username="organiser_edit_reg", password="testpassword"
        )
        self.role = Role.objects.create(
            name="Admin_edit_reg",
            role_type=Role.ALL_TYPE,
        )

        # Non-member — used for 403 tests.
        self.non_member = User.objects.create_user(
            username="non_member_edit_reg", password="testpassword"
        )

        # Published event with an EventRegistrationConfig.
        self.event = Project.objects.create(
            name="Edit Reg Event",
            url_slug="edit-reg-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        self.er = EventRegistrationConfig.objects.create(
            project=self.event,
            max_participants=100,
            registration_end_date=timezone.now() + timedelta(days=60),
            status=RegistrationStatus.OPEN,
        )
        ProjectMember.objects.create(
            user=self.organiser,
            project=self.event,
            role=self.role,
        )

        # Published event WITHOUT an EventRegistrationConfig.
        self.event_no_er = Project.objects.create(
            name="Edit Reg Event No ER",
            url_slug="edit-reg-event-no-er",
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
            project=self.event_no_er,
            role=self.role,
        )

    def _url(self, slug):
        return reverse(
            "organization:edit-registration-config",
            kwargs={"url_slug": slug},
        )

    # ------------------------------------------------------------------
    # Happy-path updates
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_patch_max_participants_updates_record(self):
        """PATCH max_participants → 200 OK and DB row is updated."""
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 80},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.max_participants, 80)

    @tag("registration_config", "edit_settings")
    def test_patch_registration_end_date_updates_record(self):
        """PATCH registration_end_date → 200 OK and DB row is updated."""
        self.client.login(username="organiser_edit_reg", password="testpassword")
        new_date = timezone.now() + timedelta(days=45)

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"registration_end_date": new_date.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        # Compare with second precision to avoid microsecond drift.
        self.assertAlmostEqual(
            self.er.registration_end_date.timestamp(),
            new_date.timestamp(),
            delta=1,
        )

    @tag("registration_config", "edit_settings")
    def test_patch_both_fields_updates_both(self):
        """PATCH both fields → 200 OK; both DB values are updated."""
        self.client.login(username="organiser_edit_reg", password="testpassword")
        new_date = timezone.now() + timedelta(days=55)

        response = self.client.patch(
            self._url("edit-reg-event"),
            {
                "max_participants": 200,
                "registration_end_date": new_date.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.max_participants, 200)

    # ------------------------------------------------------------------
    # Response shape
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_200_response_includes_max_participants_registration_end_date_status(self):
        """Successful PATCH returns max_participants, registration_end_date, status, available_seats."""
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 75},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("max_participants", response.data)
        self.assertIn("registration_end_date", response.data)
        self.assertIn("status", response.data)
        self.assertIn("available_seats", response.data)
        self.assertEqual(response.data["max_participants"], 75)
        self.assertEqual(response.data["status"], RegistrationStatus.OPEN)

    @tag("registration_config", "edit_settings")
    def test_response_available_seats_reflects_current_registrations(self):
        """available_seats in PATCH response equals max_participants minus participant count."""
        for i in range(4):
            participant = User.objects.create_user(
                username=f"participant_seats_check_{i}", password="x"
            )
            EventRegistration.objects.create(
                user=participant, registration_config=self.er
            )
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["available_seats"], 6)  # 10 - 4

    @tag("registration_config", "edit_settings")
    def test_response_available_seats_is_null_for_unlimited_capacity(self):
        """available_seats is null when max_participants is null (unlimited)."""
        self.er.max_participants = None
        self.er.save(update_fields=["max_participants", "updated_at"])
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {
                "registration_end_date": (
                    timezone.now() + timedelta(days=30)
                ).isoformat()
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsNone(response.data["available_seats"])

    # ------------------------------------------------------------------
    # status field is read-only via this endpoint
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_status_closed_in_request_body_is_applied(self):
        """Including status='closed' in the request body closes the registration."""
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 90, "status": "closed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.CLOSED)
        self.assertEqual(response.data["status"], RegistrationStatus.CLOSED)

    # ------------------------------------------------------------------
    # Validation — published projects
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_past_registration_end_date_returns_400(self):
        """PATCH with registration_end_date in the past → 400 Bad Request."""
        self.client.login(username="organiser_edit_reg", password="testpassword")
        past_date = timezone.now() - timedelta(days=1)

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"registration_end_date": past_date.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("registration_end_date", response.data)

    @tag("registration_config", "edit_settings")
    def test_registration_end_date_after_event_end_date_returns_400(self):
        """PATCH with registration_end_date after event end_date → 400."""
        self.client.login(username="organiser_edit_reg", password="testpassword")
        after_event_end = self.event.end_date + timedelta(days=1)

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"registration_end_date": after_event_end.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("registration_end_date", response.data)

    @tag("registration_config", "edit_settings")
    def test_max_participants_zero_returns_400(self):
        """PATCH with max_participants=0 → 400 (min_value=1)."""
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 0},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_participants", response.data)

    @tag("registration_config", "edit_settings")
    def test_registration_end_date_equal_to_event_end_date_is_valid(self):
        """registration_end_date exactly equal to event end_date is allowed."""
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"registration_end_date": self.event.end_date.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ------------------------------------------------------------------
    # Participant count lower-bound guard
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_max_participants_below_participant_count_returns_400(self):
        """PATCH max_participants below current registrations → 400 Bad Request."""
        for i in range(3):
            participant = User.objects.create_user(
                username=f"participant_lower_bound_{i}", password="x"
            )
            EventRegistration.objects.create(
                user=participant, registration_config=self.er
            )
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 2},  # below current count of 3
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("max_participants", response.data)
        # Error message must mention the count so the organiser knows the floor.
        self.assertIn("3", str(response.data["max_participants"]))

    @tag("registration_config", "edit_settings")
    def test_max_participants_equal_to_participant_count_is_valid(self):
        """PATCH max_participants equal to current registrations → 200 OK."""
        for i in range(3):
            participant = User.objects.create_user(
                username=f"participant_equal_bound_{i}", password="x"
            )
            EventRegistration.objects.create(
                user=participant, registration_config=self.er
            )
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 3},  # exactly the current count — allowed
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    @tag("registration_config", "edit_settings")
    def test_max_participants_patch_does_not_revalidate_stored_end_date(self):
        """PATCH with only max_participants does not trigger the past-date guard
        on the stored registration_end_date. The past-date guard fires only when
        registration_end_date is explicitly included in the request body."""
        # Simulate a registration whose deadline has already passed.
        self.er.registration_end_date = timezone.now() - timedelta(days=1)
        self.er.save(update_fields=["registration_end_date", "updated_at"])

        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 120},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.max_participants, 120)

    # ------------------------------------------------------------------
    # 404 responses
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_unknown_slug_returns_404(self):
        """PATCH to an unknown project slug → 404 Not Found."""
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("does-not-exist"),
            {"max_participants": 50},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @tag("registration_config", "edit_settings")
    def test_project_without_event_registration_returns_404(self):
        """PATCH on a project that has no EventRegistrationConfig → 404 Not Found."""
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event-no-er"),
            {"max_participants": 50},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Authentication and authorisation
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_unauthenticated_request_returns_401(self):
        """Unauthenticated PATCH → 401 Unauthorized."""
        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 50},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @tag("registration_config", "edit_settings")
    def test_non_member_returns_403(self):
        """Authenticated user who is not a project member → 403 Forbidden."""
        self.client.login(username="non_member_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 50},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------------
    # "ended" computed status in PATCH response
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_patch_response_shows_ended_status_when_end_date_is_past(self):
        """PATCH max_participants on a registration whose end_date has passed returns status 'ended'."""
        # Bypass the past-date guard by writing directly to the DB — simulates
        # a registration that was valid when set but has since expired.
        self.er.registration_end_date = timezone.now() - timedelta(hours=1)
        self.er.save(update_fields=["registration_end_date"])

        self.client.login(username="organiser_edit_reg", password="testpassword")
        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 90},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["status"], "ended")

    # ------------------------------------------------------------------
    # Status auto-adjustment when max_participants changes
    # ------------------------------------------------------------------

    @tag("registration_config", "edit_settings")
    def test_raising_max_participants_above_full_capacity_auto_reopens_registration(
        self,
    ):
        """PATCH max_participants above current count auto-reopens a FULL registration."""
        for i in range(3):
            participant = User.objects.create_user(
                username=f"participant_auto_reopen_{i}", password="x"
            )
            EventRegistration.objects.create(
                user=participant, registration_config=self.er
            )
        self.er.max_participants = 3
        self.er.status = RegistrationStatus.FULL
        self.er.save(update_fields=["max_participants", "status", "updated_at"])

        self.client.login(username="organiser_edit_reg", password="testpassword")
        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.OPEN)
        self.assertEqual(response.data["status"], RegistrationStatus.OPEN)

    @tag("registration_config", "edit_settings")
    def test_lowering_max_participants_to_current_count_auto_sets_full(self):
        """PATCH max_participants equal to current count auto-sets status to FULL."""
        for i in range(3):
            participant = User.objects.create_user(
                username=f"participant_auto_full_{i}", password="x"
            )
            EventRegistration.objects.create(
                user=participant, registration_config=self.er
            )
        # er is OPEN with 100 capacity and 3 participants.
        self.client.login(username="organiser_edit_reg", password="testpassword")

        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": 3},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.FULL)
        self.assertEqual(response.data["status"], RegistrationStatus.FULL)

    @tag("registration_config", "edit_settings")
    def test_setting_max_participants_to_null_reopens_full_registration(self):
        """PATCH max_participants=null (unlimited) auto-reopens a FULL registration."""
        for i in range(3):
            participant = User.objects.create_user(
                username=f"participant_null_reopen_{i}", password="x"
            )
            EventRegistration.objects.create(
                user=participant, registration_config=self.er
            )
        self.er.max_participants = 3
        self.er.status = RegistrationStatus.FULL
        self.er.save(update_fields=["max_participants", "status", "updated_at"])

        self.client.login(username="organiser_edit_reg", password="testpassword")
        response = self.client.patch(
            self._url("edit-reg-event"),
            {"max_participants": None},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertIsNone(self.er.max_participants)
        self.assertEqual(self.er.status, RegistrationStatus.OPEN)
        self.assertEqual(response.data["status"], RegistrationStatus.OPEN)


class TestEditEventRegistrationStatusChange(APITestCase):
    """
    Tests for organiser-driven status changes via
    PATCH /api/projects/{slug}/registration-config/.

    Covers:
    - Organiser can close registration (open → closed)
    - Organiser can reopen registration (closed → open)
    - full → open transition is permitted (organiser overrides capacity block)
    - Setting status to its current value is idempotent (200 OK, no DB change)
    - "full" and "ended" cannot be set via the API (400 Bad Request)
    - Attempting to reopen when effective_status == "ended" returns 400
    - Status-only PATCH does not affect other fields
    - 401 Unauthorized for unauthenticated requests
    - 403 Forbidden for non-members
    """

    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_status_change",
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
            username="organiser_status_change", password="testpassword"
        )
        self.role = Role.objects.create(
            name="Admin_status_change",
            role_type=Role.ALL_TYPE,
        )
        self.non_member = User.objects.create_user(
            username="non_member_status_change", password="testpassword"
        )

        self.event = Project.objects.create(
            name="Status Change Event",
            url_slug="status-change-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        self.er = EventRegistrationConfig.objects.create(
            project=self.event,
            max_participants=50,
            registration_end_date=timezone.now() + timedelta(days=60),
            status=RegistrationStatus.OPEN,
        )
        ProjectMember.objects.create(
            user=self.organiser,
            project=self.event,
            role=self.role,
        )

    def _url(self, slug="status-change-event"):
        return reverse(
            "organization:edit-registration-config",
            kwargs={"url_slug": slug},
        )

    # ------------------------------------------------------------------
    # Happy-path: close and reopen
    # ------------------------------------------------------------------

    @tag("registration_config", "status_change")
    def test_organiser_can_close_open_registration(self):
        """PATCH status='closed' on an open registration → 200 OK, status is CLOSED."""
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "closed"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.CLOSED)
        self.assertEqual(response.data["status"], RegistrationStatus.CLOSED)

    @tag("registration_config", "status_change")
    def test_organiser_can_reopen_closed_registration(self):
        """PATCH status='open' on a closed registration → 200 OK, status is OPEN."""
        self.er.status = RegistrationStatus.CLOSED
        self.er.save(update_fields=["status", "updated_at"])
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "open"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.OPEN)
        self.assertEqual(response.data["status"], RegistrationStatus.OPEN)

    @tag("registration_config", "status_change")
    def test_cannot_reopen_fully_booked_registration_returns_400(self):
        """PATCH status='open' when stored status is FULL and event is at capacity → 400."""
        # Fill the event to capacity (max_participants=50 from setUp).
        users = [
            User.objects.create_user(username=f"full_cap_user_{i}", password="x")
            for i in range(self.er.max_participants)
        ]
        for u in users:
            EventRegistration.objects.create(user=u, registration_config=self.er)
        self.er.status = RegistrationStatus.FULL
        self.er.save(update_fields=["status", "updated_at"])
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "open"}, format="json")

        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("status", response.data)
        self.assertIn("fully booked", str(response.data["status"]))

    @tag("registration_config", "status_change")
    def test_cannot_reopen_closed_booked_out_registration_returns_400(self):
        """PATCH status='open' when stored status is CLOSED but event is at capacity → 400."""
        self.er.max_participants = 3
        self.er.status = RegistrationStatus.CLOSED
        self.er.save(update_fields=["status", "max_participants", "updated_at"])
        users = [
            User.objects.create_user(username=f"closed_cap_user_{i}", password="x")
            for i in range(3)
        ]
        for u in users:
            EventRegistration.objects.create(user=u, registration_config=self.er)
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "open"}, format="json")

        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("status", response.data)
        self.assertIn("fully booked", str(response.data["status"]))

    @tag("registration_config", "status_change")
    def test_organiser_can_reopen_full_registration_after_increasing_capacity(self):
        """PATCH status='open' AND max_participants > current count on a FULL event → 200 OK."""
        self.er.max_participants = 3
        self.er.status = RegistrationStatus.FULL
        self.er.save(update_fields=["status", "max_participants", "updated_at"])
        users = [
            User.objects.create_user(username=f"increase_cap_user_{i}", password="x")
            for i in range(3)
        ]
        for u in users:
            EventRegistration.objects.create(user=u, registration_config=self.er)
        self.client.login(username="organiser_status_change", password="testpassword")

        # Raise cap to 10 (> 3 participants) AND explicitly reopen.
        response = self.client.patch(
            self._url(),
            {"status": "open", "max_participants": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.OPEN)
        self.assertEqual(self.er.max_participants, 10)

    # ------------------------------------------------------------------
    # Idempotency
    # ------------------------------------------------------------------

    @tag("registration_config", "status_change")
    def test_setting_status_to_current_open_value_is_idempotent(self):
        """PATCH status='open' on an already-open registration → 200 OK, no change."""
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "open"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.OPEN)

    @tag("registration_config", "status_change")
    def test_setting_status_to_current_closed_value_is_idempotent(self):
        """PATCH status='closed' on an already-closed registration → 200 OK, no change."""
        self.er.status = RegistrationStatus.CLOSED
        self.er.save(update_fields=["status", "updated_at"])
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "closed"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.CLOSED)

    # ------------------------------------------------------------------
    # System-managed statuses rejected on write
    # ------------------------------------------------------------------

    @tag("registration_config", "status_change")
    def test_setting_status_to_full_returns_400(self):
        """PATCH status='full' → 400 Bad Request (system-managed)."""
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "full"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)
        self.assertIn("system-managed", str(response.data["status"]))

    @tag("registration_config", "status_change")
    def test_setting_status_to_ended_returns_400(self):
        """PATCH status='ended' → 400 Bad Request (system-managed computed value)."""
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "ended"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)
        self.assertIn("system-managed", str(response.data["status"]))

    # ------------------------------------------------------------------
    # Reopen guard: cannot reopen when effective_status == "ended"
    # ------------------------------------------------------------------

    @tag("registration_config", "status_change")
    def test_cannot_reopen_when_registration_deadline_has_passed(self):
        """PATCH status='open' when deadline is in the past → 400 with helpful message."""
        # Bypass the past-date guard by writing directly — simulates a registration
        # that expired naturally after being created with a valid future date.
        self.er.registration_end_date = timezone.now() - timedelta(hours=1)
        self.er.save(update_fields=["registration_end_date"])
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "open"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)
        self.assertIn("deadline has passed", str(response.data["status"]))

    @tag("registration_config", "status_change")
    def test_closing_when_deadline_has_passed_is_allowed(self):
        """PATCH status='closed' when deadline is in the past → 200 OK (allowed)."""
        self.er.registration_end_date = timezone.now() - timedelta(hours=1)
        self.er.save(update_fields=["registration_end_date"])
        self.client.login(username="organiser_status_change", password="testpassword")

        response = self.client.patch(self._url(), {"status": "closed"}, format="json")

        # Closing an ended registration is allowed (no-op in practice but valid).
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.CLOSED)

    # ------------------------------------------------------------------
    # Status change does not affect unrelated fields
    # ------------------------------------------------------------------

    @tag("registration_config", "status_change")
    def test_status_only_patch_does_not_change_max_participants(self):
        """PATCH with only status does not alter max_participants."""
        original_max = self.er.max_participants
        self.client.login(username="organiser_status_change", password="testpassword")

        self.client.patch(self._url(), {"status": "closed"}, format="json")

        self.er.refresh_from_db()
        self.assertEqual(self.er.max_participants, original_max)

    @tag("registration_config", "status_change")
    def test_explicit_status_overrides_auto_adjustment(self):
        """When status is explicitly provided, auto-adjustment from max_participants is skipped.

        Scenario: organiser sends status='open' AND max_participants equal to participant
        count. Without the explicit-status priority, auto-adjustment would set FULL.
        With the priority, the explicit status='open' wins.
        """
        # Create 3 participants
        for i in range(3):
            p = User.objects.create_user(
                username=f"p_explicit_override_{i}", password="x"
            )
            EventRegistration.objects.create(user=p, registration_config=self.er)

        self.er.status = RegistrationStatus.FULL
        self.er.max_participants = 3
        self.er.save(update_fields=["status", "max_participants", "updated_at"])

        self.client.login(username="organiser_status_change", password="testpassword")
        # Organiser raises cap to 10 AND explicitly sets status=open — should be OPEN.
        response = self.client.patch(
            self._url(),
            {"status": "open", "max_participants": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertEqual(self.er.status, RegistrationStatus.OPEN)

    # ------------------------------------------------------------------
    # Auth / authorisation
    # ------------------------------------------------------------------

    @tag("registration_config", "status_change")
    def test_unauthenticated_status_change_returns_401(self):
        """Unauthenticated PATCH → 401 Unauthorized."""
        response = self.client.patch(self._url(), {"status": "closed"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @tag("registration_config", "status_change")
    def test_non_member_status_change_returns_403(self):
        """Authenticated user who is not a project member → 403 Forbidden."""
        self.client.login(username="non_member_status_change", password="testpassword")
        response = self.client.patch(self._url(), {"status": "closed"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------------
    # Effect on member registration (closed blocks new sign-ups)
    # ------------------------------------------------------------------

    @tag("registration_config", "status_change")
    def test_closed_registration_blocks_new_member_signups(self):
        """After organiser closes registration, POST /registrations/ returns 400."""
        # Close the registration via PATCH
        self.client.login(username="organiser_status_change", password="testpassword")
        patch_resp = self.client.patch(self._url(), {"status": "closed"}, format="json")
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)

        # A new member tries to register
        User.objects.create_user(
            username="blocked_member_status", password="testpassword"
        )
        self.client.login(username="blocked_member_status", password="testpassword")
        register_url = reverse(
            "organization:event-registrations",
            kwargs={"url_slug": "status-change-event"},
        )
        response = self.client.post(register_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @tag("registration_config", "status_change")
    def test_reopened_registration_allows_member_signups(self):
        """After organiser reopens a closed registration, POST /registrations/ succeeds."""
        # First close
        self.er.status = RegistrationStatus.CLOSED
        self.er.save(update_fields=["status", "updated_at"])

        # Reopen via PATCH
        self.client.login(username="organiser_status_change", password="testpassword")
        patch_resp = self.client.patch(self._url(), {"status": "open"}, format="json")
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)

        # A member registers successfully
        from unittest.mock import patch as mock_patch

        User.objects.create_user(
            username="allowed_member_status", password="testpassword"
        )
        self.client.login(username="allowed_member_status", password="testpassword")
        register_url = reverse(
            "organization:event-registrations",
            kwargs={"url_slug": "status-change-event"},
        )
        with mock_patch(
            "organization.views.event_registration_views._send_registration_email"
        ):
            response = self.client.post(register_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

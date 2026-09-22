"""
Tests for the notify_admins flag on EventRegistrationConfig (#1882).

Contains:
  - TestNotifyAdminsField
  - TestNotifyAdminsCreateProject
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
from organization.models.event_registration import EventRegistrationConfig

from ._helpers import _make_black_image_b64

# ---------------------------------------------------------------------------
# Tests for notify_admins field (#1882)
# ---------------------------------------------------------------------------


class TestNotifyAdminsField(APITestCase):
    """
    Tests for the ``notify_admins`` boolean field on EventRegistrationConfig.

    Covers spec test cases 1–6 (backend):
    1. GET /api/projects/{slug}/ includes registration_config.notify_admins
    2. GET /api/projects/ (list) does NOT include notify_admins
    3. POST /api/projects/ with notify_admins=false creates config with notify_admins=False
    4. POST /api/projects/ without notify_admins defaults to True
    5. PATCH /api/projects/{slug}/registration-config/ with notify_admins=false updates field
    6. PATCH /api/projects/{slug}/registration-config/ without notify_admins leaves value unchanged
    """

    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_notify_admins",
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
            username="organiser_notify_admins", password="testpassword"
        )
        self.role = Role.objects.create(
            name="Admin_notify_admins",
            role_type=Role.ALL_TYPE,
        )

        # Published event with an EventRegistrationConfig (notify_admins=True by default).
        self.event = Project.objects.create(
            name="Notify Admins Event",
            url_slug="notify-admins-event",
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
            notify_admins=True,
        )
        ProjectMember.objects.create(
            user=self.organiser,
            project=self.event,
            role=self.role,
        )

    def _detail_url(self, slug):
        return reverse("organization:project-api-view", kwargs={"url_slug": slug})

    def _edit_config_url(self, slug):
        return reverse(
            "organization:edit-registration-config", kwargs={"url_slug": slug}
        )

    # ------------------------------------------------------------------
    # Test case 1: GET detail includes notify_admins
    # ------------------------------------------------------------------

    @tag("notify_admins", "registration_config")
    def test_get_detail_includes_notify_admins(self):
        """GET /api/projects/{slug}/ returns registration_config.notify_admins."""
        response = self.client.get(self._detail_url("notify-admins-event"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("registration_config", data)
        er = data["registration_config"]
        self.assertIsNotNone(er)
        self.assertIn("notify_admins", er)
        self.assertTrue(er["notify_admins"])

    # ------------------------------------------------------------------
    # Test case 2: GET list does NOT include notify_admins
    # ------------------------------------------------------------------

    @tag("notify_admins", "registration_config")
    def test_get_list_does_not_include_notify_admins(self):
        """GET /api/projects/ list response does not include notify_admins in registration_config."""
        url = reverse("organization:list-projects")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        event_result = next(
            (r for r in results if r["url_slug"] == "notify-admins-event"), None
        )
        self.assertIsNotNone(event_result, "notify-admins-event not found in list")
        er = event_result.get("registration_config")
        self.assertIsNotNone(er)
        self.assertNotIn(
            "notify_admins",
            er,
            "notify_admins must not appear in list endpoint registration_config",
        )

    # ------------------------------------------------------------------
    # Test cases 5 & 6: PATCH /registration-config/
    # ------------------------------------------------------------------

    @tag("notify_admins", "registration_config", "edit_settings")
    def test_patch_notify_admins_false_updates_field(self):
        """PATCH with notify_admins=false persists False and response includes updated value."""
        self.client.login(username="organiser_notify_admins", password="testpassword")

        response = self.client.patch(
            self._edit_config_url("notify-admins-event"),
            {"notify_admins": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertFalse(self.er.notify_admins)
        self.assertIn("notify_admins", response.data)
        self.assertFalse(response.data["notify_admins"])

    @tag("notify_admins", "registration_config", "edit_settings")
    def test_patch_without_notify_admins_leaves_value_unchanged(self):
        """PATCH without notify_admins in body leaves the existing value unchanged."""
        # Ensure the stored value is True before the PATCH.
        self.er.notify_admins = True
        self.er.save(update_fields=["notify_admins"])

        self.client.login(username="organiser_notify_admins", password="testpassword")

        response = self.client.patch(
            self._edit_config_url("notify-admins-event"),
            {"max_participants": 60},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertTrue(
            self.er.notify_admins,
            "notify_admins must remain True when not in PATCH body",
        )

    @tag("notify_admins", "registration_config", "edit_settings")
    def test_patch_notify_admins_true_updates_field(self):
        """PATCH with notify_admins=true persists True."""
        # Start with False.
        self.er.notify_admins = False
        self.er.save(update_fields=["notify_admins"])

        self.client.login(username="organiser_notify_admins", password="testpassword")

        response = self.client.patch(
            self._edit_config_url("notify-admins-event"),
            {"notify_admins": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.er.refresh_from_db()
        self.assertTrue(self.er.notify_admins)
        self.assertTrue(response.data["notify_admins"])


class TestNotifyAdminsCreateProject(APITestCase):
    """
    Tests for notify_admins during event creation via POST /api/projects/.

    Covers spec test cases 3 & 4 (backend):
    3. POST with notify_admins=false creates config with notify_admins=False
    4. POST without notify_admins defaults to True
    """

    def setUp(self):
        self.url = reverse("organization:create-project-api")

        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_notify_create",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.user = User.objects.create_user(
            username="testuser_notify_create",
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
        self.base_event_data = {
            "name": "Notify Admins Create Event",
            "status": self.project_status.id,
            "short_description": "A short description",
            "collaborators_welcome": False,
            "team_members": [],
            "sectors": [],
            "loc": self.location_data,
            "image": self.image,
            "source_language": self.default_language.language_code,
            "translations": {},
            "project_type": self.event_project_type,
            "hubName": None,
            "end_date": "2026-08-01T20:00:00Z",
            "start_date": "2026-07-01T10:00:00Z",
        }

    @tag("notify_admins", "registration_config", "projects")
    def test_create_with_notify_admins_false_stores_false(self):
        """POST with registration_config.notify_admins=false creates config with notify_admins=False."""
        self.client.login(username="testuser_notify_create", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
                "notify_admins": False,
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        self.assertFalse(er.notify_admins)

    @tag("notify_admins", "registration_config", "projects")
    def test_create_without_notify_admins_defaults_to_true(self):
        """POST without notify_admins in registration_config creates config with notify_admins=True."""
        self.client.login(username="testuser_notify_create", password="testpassword")
        data = {
            **self.base_event_data,
            "name": "Notify Admins Default Event",
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
                # notify_admins intentionally omitted
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        self.assertTrue(er.notify_admins)

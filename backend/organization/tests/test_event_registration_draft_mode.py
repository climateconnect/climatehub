"""
Tests for the EventRegistrationConfig is_draft lifecycle feature.

Covers spec acceptance-criteria test cases from
doc/spec/20260528_1454_validate_registration_config_on_publish.md:

  1  – Create draft project with registration config → config.is_draft = True
  2  – Create published project with registration config → config.is_draft = False
  3  – PATCH registration config, save as draft (no is_draft in body) → 200, is_draft stays True
  4  – PATCH registration config, publish with complete data → 200, is_draft = False
  5  – PATCH registration config, publish with missing max_participants → 400
  6  – PATCH registration config, publish with registration_end_date after project.end_date → 400
  7  – PATCH registration config, set is_draft=True on published config → 400 (one-way)
  8  – Publish project with draft registration config → 200, config stays draft
  9  – Publish project with published config, date collision → 400
  10 – Publish project with published config, no collision → 200
  11 – Publish project without registration config → 200
  12 – API response: draft config hidden for non-admin, visible for admin
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import tag
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language, Role, UserProfile
from location.models import Location
from organization.models import Project, ProjectMember, ProjectStatus
from organization.models.event_registration import (
    EventRegistrationConfig,
    RegistrationStatus,
)

from ._helpers import _make_black_image_b64

# ---------------------------------------------------------------------------
# Shared base mixin — creates common fixtures for draft-mode tests
# ---------------------------------------------------------------------------


class _DraftModeBase(APITestCase):
    """
    Shared setUp for is_draft lifecycle tests.

    Creates:
        self.organiser       — ALL_TYPE project member
        self.viewer          — authenticated user with no project membership
        self.project_status  — active status (id=2)
        self.default_language — English
        self.image           — base64 encoded image for project creation
        self.location_data   — test location payload
        self.event_project_type — project_type payload for events
    """

    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_draft_mode",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )
        self.admin_role = Role.objects.create(
            name="AdminDraftMode", role_type=Role.ALL_TYPE
        )
        self.read_write_role = Role.objects.create(
            name="ReadWriteDraftMode", role_type=Role.READ_WRITE_TYPE
        )
        self.read_only_role = Role.objects.create(
            name="ReadOnlyDraftMode", role_type=Role.READ_ONLY_TYPE
        )

        self.organiser = User.objects.create_user(
            username="organiser_draft_mode", password="testpassword"
        )
        self.viewer = User.objects.create_user(
            username="viewer_draft_mode", password="testpassword"
        )

        Location.objects.get_or_create(
            city="Draft City",
            country="Draftland",
            defaults={"name": "Draft City, Draftland", "place_id": 8888},
        )
        self.image = _make_black_image_b64()
        self.location_data = {
            "place_id": 8888,
            "country": "Draftland",
            "city": "Draft City",
            "name": "Draft City",
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


# ---------------------------------------------------------------------------
# 1 & 2: Create flow — config.is_draft inherits project.is_draft
# ---------------------------------------------------------------------------


class TestCreateDraftMode(_DraftModeBase):
    """Tests 1 & 2: Create flow — config.is_draft inherits project.is_draft."""

    def _base_payload(self, **overrides):
        data = {
            "name": "Draft Mode Create Test",
            "status": self.project_status.id,
            "short_description": "Testing draft mode creation",
            "collaborators_welcome": False,
            "team_members": [],
            "sectors": [],
            "loc": self.location_data,
            "image": self.image,
            "source_language": self.default_language.language_code,
            "translations": {},
            "project_type": self.event_project_type,
            "hubName": None,
            "start_date": "2026-07-01T10:00:00Z",
            "end_date": "2026-08-01T20:00:00Z",
        }
        data.update(overrides)
        return data

    @tag("registration_config", "draft_mode")
    def test_create_draft_project_with_registration_config_sets_is_draft_true(self):
        """Test 1: Draft project → config.is_draft = True."""
        url = reverse("organization:create-project-api")
        self.client.login(username="organiser_draft_mode", password="testpassword")
        payload = self._base_payload(
            is_draft=True,
            registration_config={
                "max_participants": None,
                "registration_end_date": None,
            },
        )
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        project = Project.objects.get(url_slug=response.data["url_slug"])
        rc = project.registration_config
        self.assertTrue(rc.is_draft)

    @tag("registration_config", "draft_mode")
    def test_create_published_project_with_registration_config_sets_is_draft_false(
        self,
    ):
        """Test 2: Published project → config.is_draft = False."""
        url = reverse("organization:create-project-api")
        self.client.login(username="organiser_draft_mode", password="testpassword")
        payload = self._base_payload(
            is_draft=False,
            registration_config={
                "max_participants": 50,
                "registration_end_date": "2026-07-15T23:59:00Z",
            },
        )
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        project = Project.objects.get(url_slug=response.data["url_slug"])
        rc = project.registration_config
        self.assertFalse(rc.is_draft)


# ---------------------------------------------------------------------------
# 3–7: Registration config PATCH — draft → published transition
# ---------------------------------------------------------------------------


class TestEditRegistrationConfigDraftMode(_DraftModeBase):
    """
    Tests 3–7: PATCH /registration-config/ draft → published transition.

    Uses separate projects for each test to avoid state leakage.
    """

    def _create_draft_project_and_config(self, **rc_overrides):
        """Helper: create a draft project with a draft registration config."""
        project = Project.objects.create(
            name="Draft Edit Test",
            url_slug="draft-edit-test",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=10),
            end_date=timezone.now() + timedelta(days=60),
        )
        defaults = {"is_draft": True, "status": RegistrationStatus.OPEN}
        defaults.update(rc_overrides)
        rc = EventRegistrationConfig.objects.create(project=project, **defaults)
        ProjectMember.objects.create(
            user=self.organiser, project=project, role=self.admin_role
        )
        return project, rc

    def _create_published_project_and_config(self, **rc_overrides):
        """Helper: create a published project with a published registration config."""
        project = Project.objects.create(
            name="Published Edit Test",
            url_slug="published-edit-test",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        defaults = {
            "is_draft": False,
            "status": RegistrationStatus.OPEN,
            "max_participants": 100,
            "registration_end_date": timezone.now() + timedelta(days=60),
        }
        defaults.update(rc_overrides)
        rc = EventRegistrationConfig.objects.create(project=project, **defaults)
        ProjectMember.objects.create(
            user=self.organiser, project=project, role=self.admin_role
        )
        return project, rc

    def _patch_url(self, slug):
        return reverse(
            "organization:edit-registration-config",
            kwargs={"url_slug": slug},
        )

    # -- Test 3: save as draft (no is_draft in body) ---

    @tag("registration_config", "draft_mode")
    def test_save_as_draft_without_is_draft_in_body_keeps_draft(self):
        """Test 3: PATCH without is_draft in body → 200, is_draft stays True."""
        project, rc = self._create_draft_project_and_config()
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._patch_url(project.url_slug),
            {"max_participants": 30},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        rc.refresh_from_db()
        self.assertTrue(rc.is_draft)
        self.assertEqual(rc.max_participants, 30)

    # -- Test 4: publish with complete data ---

    @tag("registration_config", "draft_mode")
    def test_publish_registration_config_with_complete_data_succeeds(self):
        """Test 4: PATCH is_draft=false with complete data → 200, is_draft=False."""
        project, rc = self._create_draft_project_and_config()
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._patch_url(project.url_slug),
            {
                "is_draft": False,
                "max_participants": 50,
                "registration_end_date": (
                    timezone.now() + timedelta(days=30)
                ).isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        rc.refresh_from_db()
        self.assertFalse(rc.is_draft)
        self.assertEqual(rc.max_participants, 50)

    # -- Test 5: publish with missing max_participants ---

    @tag("registration_config", "draft_mode")
    def test_publish_registration_config_without_max_participants_fails(self):
        """Test 5: PATCH is_draft=false without max_participants → 400."""
        project, rc = self._create_draft_project_and_config()
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._patch_url(project.url_slug),
            {
                "is_draft": False,
                "registration_end_date": (
                    timezone.now() + timedelta(days=30)
                ).isoformat(),
            },
            format="json",
        )
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("max_participants", response.data)
        rc.refresh_from_db()
        self.assertTrue(rc.is_draft)  # Still draft

    # -- Test 5b: publish with missing registration_end_date ---

    @tag("registration_config", "draft_mode")
    def test_publish_registration_config_without_registration_end_date_fails(self):
        """PATCH is_draft=false without registration_end_date → 400."""
        project, rc = self._create_draft_project_and_config()
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._patch_url(project.url_slug),
            {"is_draft": False, "max_participants": 50},
            format="json",
        )
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("registration_end_date", response.data)
        rc.refresh_from_db()
        self.assertTrue(rc.is_draft)

    # -- Test 6: publish with date collision ---

    @tag("registration_config", "draft_mode")
    def test_publish_registration_config_with_date_collision_fails(self):
        """Test 6: registration_end_date > project.end_date → 400."""
        project, rc = self._create_draft_project_and_config()
        self.client.login(username="organiser_draft_mode", password="testpassword")

        # Set registration_end_date after project.end_date
        after_event_end = project.end_date + timedelta(days=5)
        response = self.client.patch(
            self._patch_url(project.url_slug),
            {
                "is_draft": False,
                "max_participants": 50,
                "registration_end_date": after_event_end.isoformat(),
            },
            format="json",
        )
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("registration_end_date", response.data)
        self.assertIn("event end date", str(response.data["registration_end_date"]))

    # -- Test 7: one-way transition rejection ---

    @tag("registration_config", "draft_mode")
    def test_cannot_set_is_draft_true_on_published_config(self):
        """Test 7: PATCH is_draft=true on a published config → 400."""
        project, rc = self._create_published_project_and_config()
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._patch_url(project.url_slug),
            {"is_draft": True},
            format="json",
        )
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("is_draft", response.data)
        rc.refresh_from_db()
        self.assertFalse(rc.is_draft)  # Still published


# ---------------------------------------------------------------------------
# 8–11: Project PATCH — publish project with draft/published config
# ---------------------------------------------------------------------------


class TestPublishProjectWithRegistrationConfig(_DraftModeBase):
    """
    Tests 8–11: PATCH /api/projects/{slug}/ with is_draft transition.

    Tests date collision checks when publishing projects with registration configs.
    """

    def _create_project_and_config(
        self, *, project_is_draft, config_is_draft, slug, **rc_overrides
    ):
        project = Project.objects.create(
            name=f"Publish Test {slug}",
            url_slug=slug,
            is_active=True,
            is_draft=project_is_draft,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        defaults = {
            "is_draft": config_is_draft,
            "status": RegistrationStatus.OPEN,
            "max_participants": 50,
            "registration_end_date": timezone.now() + timedelta(days=60),
        }
        defaults.update(rc_overrides)
        EventRegistrationConfig.objects.create(project=project, **defaults)
        ProjectMember.objects.create(
            user=self.organiser, project=project, role=self.admin_role
        )
        return project

    def _project_url(self, slug):
        return reverse("organization:project-api-view", kwargs={"url_slug": slug})

    # -- Test 8: publish project with draft config → succeeds ---

    @tag("registration_config", "draft_mode")
    def test_publish_project_with_draft_registration_config_succeeds(self):
        """Test 8: Publishing a project with draft config → 200, config stays draft."""
        project = self._create_project_and_config(
            project_is_draft=True,
            config_is_draft=True,
            slug="publish-draft-config",
            max_participants=None,
            registration_end_date=None,
        )
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._project_url(project.url_slug),
            {"is_draft": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        project.refresh_from_db()
        self.assertFalse(project.is_draft)
        rc = project.registration_config
        rc.refresh_from_db()
        self.assertTrue(rc.is_draft)  # Config stays draft

    # -- Test 9: publish project with published config, date collision → 400 ---

    @tag("registration_config", "draft_mode")
    def test_publish_project_with_published_config_date_collision_fails(self):
        """Test 9: registration_end_date > new end_date → 400."""
        project = self._create_project_and_config(
            project_is_draft=True,
            config_is_draft=False,
            slug="publish-date-collision",
        )
        self.client.login(username="organiser_draft_mode", password="testpassword")

        # Change end_date to be before the registration_end_date
        new_end = timezone.now() + timedelta(days=10)  # reg end is +60
        response = self.client.patch(
            self._project_url(project.url_slug),
            {"is_draft": False, "end_date": new_end.isoformat()},
            format="json",
        )
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("registration_config", response.data)
        self.assertIn("registration_end_date", response.data["registration_config"])

    # -- Test 9b: publish project with published config, changing end_date to collide ---

    @tag("registration_config", "draft_mode")
    def test_publish_project_end_date_change_causes_date_collision(self):
        """Publish project, changing end_date to be before existing reg_end → 400."""
        project = self._create_project_and_config(
            project_is_draft=False,
            config_is_draft=False,
            slug="end-date-change-collision",
        )
        # Re-draft the project to allow re-publishing
        project.is_draft = True
        project.save(update_fields=["is_draft"])
        self.client.login(username="organiser_draft_mode", password="testpassword")

        # Change end_date to be before registration_end_date (+60 days)
        new_end = timezone.now() + timedelta(days=10)
        response = self.client.patch(
            self._project_url(project.url_slug),
            {"is_draft": False, "end_date": new_end.isoformat()},
            format="json",
        )
        self.assertEqual(
            response.status_code, status.HTTP_400_BAD_REQUEST, response.data
        )
        self.assertIn("registration_config", response.data)

    # -- Test 10: publish project with published config, no collision → 200 ---

    @tag("registration_config", "draft_mode")
    def test_publish_project_with_published_config_no_collision_succeeds(self):
        """Test 10: registration_end_date ≤ end_date → 200."""
        project = self._create_project_and_config(
            project_is_draft=True,
            config_is_draft=False,
            slug="publish-no-collision",
        )
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._project_url(project.url_slug),
            {"is_draft": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        project.refresh_from_db()
        self.assertFalse(project.is_draft)

    # -- Test 11: publish project without registration config → 200 ---

    @tag("registration_config", "draft_mode")
    def test_publish_project_without_registration_config_succeeds(self):
        """Test 11: Project without registration config → 200, no registration validation."""
        project = Project.objects.create(
            name="No Reg Config",
            url_slug="no-reg-config",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        ProjectMember.objects.create(
            user=self.organiser, project=project, role=self.admin_role
        )
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._project_url(project.url_slug),
            {"is_draft": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        project.refresh_from_db()
        self.assertFalse(project.is_draft)

    # -- Test 11b: non-event project is unaffected ---

    @tag("registration_config", "draft_mode")
    def test_publish_non_event_project_unaffected(self):
        """Non-event project publish → 200, no registration validation."""
        project = Project.objects.create(
            name="Non Event Project",
            url_slug="non-event-project",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.default_language,
            project_type="PK",  # not an event
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        ProjectMember.objects.create(
            user=self.organiser, project=project, role=self.admin_role
        )
        self.client.login(username="organiser_draft_mode", password="testpassword")

        response = self.client.patch(
            self._project_url(project.url_slug),
            {"is_draft": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)


# ---------------------------------------------------------------------------
# 12: API response filtering — draft configs hidden for non-admins
# ---------------------------------------------------------------------------


class TestDraftConfigAPIResponseFiltering(_DraftModeBase):
    """
    Test 12: API response filtering for draft registration configs.

    Draft configs should be:
      - Hidden (None) for non-authenticated users
      - Hidden (None) for non-admin users
      - Visible for project admins
    """

    def setUp(self):
        super().setUp()
        # The list endpoint requires a UserProfile on each user.
        UserProfile.objects.get_or_create(user=self.organiser)
        UserProfile.objects.get_or_create(user=self.viewer)
        self.event = Project.objects.create(
            name="Filter Test Event",
            url_slug="filter-test-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=30),
            end_date=timezone.now() + timedelta(days=90),
        )
        self.rc = EventRegistrationConfig.objects.create(
            project=self.event,
            max_participants=50,
            registration_end_date=timezone.now() + timedelta(days=60),
            status=RegistrationStatus.OPEN,
            is_draft=True,
        )
        ProjectMember.objects.create(
            user=self.organiser, project=self.event, role=self.admin_role
        )
        # viewer has no membership on this event

    def _detail_url(self):
        return reverse(
            "organization:project-api-view",
            kwargs={"url_slug": self.event.url_slug},
        )

    def _list_url(self):
        return reverse("organization:list-projects")

    @tag("registration_config", "draft_mode")
    def test_draft_config_hidden_for_unauthenticated_detail_view(self):
        """Unauthenticated GET detail → registration_config is None."""
        response = self.client.get(self._detail_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data.get("registration_config"))

    @tag("registration_config", "draft_mode")
    def test_draft_config_hidden_for_non_admin_detail_view(self):
        """Non-admin GET detail → registration_config is None."""
        self.client.login(username="viewer_draft_mode", password="testpassword")
        response = self.client.get(self._detail_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data.get("registration_config"))

    @tag("registration_config", "draft_mode")
    def test_draft_config_visible_for_admin_detail_view(self):
        """Admin GET detail → registration_config is present with is_draft=True."""
        self.client.login(username="organiser_draft_mode", password="testpassword")
        response = self.client.get(self._detail_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rc = response.data.get("registration_config")
        self.assertIsNotNone(rc)
        self.assertTrue(rc["is_draft"])

    @tag("registration_config", "draft_mode")
    def test_draft_config_hidden_for_non_admin_list_view(self):
        """Non-admin GET list → registration_config is None."""
        self.client.login(username="viewer_draft_mode", password="testpassword")
        response = self.client.get(self._list_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Find our project in the results
        results = response.data.get("results", [])
        our_project = next(
            (p for p in results if p["url_slug"] == self.event.url_slug), None
        )
        if our_project:
            self.assertIsNone(our_project.get("registration_config"))

    @tag("registration_config", "draft_mode")
    def test_draft_config_visible_for_admin_list_view(self):
        """Admin GET list → registration_config is present with is_draft=True."""
        self.client.login(username="organiser_draft_mode", password="testpassword")
        response = self.client.get(self._list_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", [])
        our_project = next(
            (p for p in results if p["url_slug"] == self.event.url_slug), None
        )
        if our_project:
            rc = our_project.get("registration_config")
            self.assertIsNotNone(rc)
            self.assertTrue(rc["is_draft"])

    @tag("registration_config", "draft_mode")
    def test_published_config_visible_for_all_detail_view(self):
        """Published config → visible to everyone."""
        self.rc.is_draft = False
        self.rc.save(update_fields=["is_draft"])
        response = self.client.get(self._detail_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rc = response.data.get("registration_config")
        self.assertIsNotNone(rc)
        self.assertFalse(rc["is_draft"])

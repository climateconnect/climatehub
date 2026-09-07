"""
Tests for the custom registration fields feature (Phase 4a backend).

Tests covering spec test cases:
  1  – Create event with 5 custom fields (checkbox + option select)
  2  – 6th field rejected with 400
  3  – Option select with 0 options on publish → 400
  4  – Option select with 0 options on draft → accepted
  5  – Reorder fields → new order reflected in response
  6  – Delete a field → field and options removed
  7  – Unauthenticated → 401
  8  – Non-organiser → 403
  9  – Unknown settings key stripped (checkbox)
  10 – XSS in description stripped
  11 – <a> without rel → rel="noopener noreferrer" added
  12 – Checkbox empty description on publish → 400
  13 – Checkbox empty description on draft → accepted
  14 – Option select arbitrary settings stripped; {} persisted
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
    RegistrationFieldAnswer,
    RegistrationStatus,
)
from organization.models.registration_field import (
    RegistrationField,
    RegistrationFieldOption,
)

from ._helpers import _make_black_image_b64

# ---------------------------------------------------------------------------
# Base mixin — creates organiser + event project for PATCH-path tests
# ---------------------------------------------------------------------------


class _CustomFieldsBase(APITestCase):
    """
    Shared setUp for PATCH /registration-config/ custom-field tests.

    Creates:
        self.organiser     — ALL_TYPE project member
        self.non_organiser — authenticated user with no project membership
        self.event         — published event project
        self.er            — EventRegistrationConfig for self.event
        self.patch_url     — URL for PATCH /registration-config/
        self.draft_event   — draft event project (is_draft=True)
        self.draft_er      — EventRegistrationConfig for draft event
        self.draft_patch_url — URL for PATCH on draft event
    """

    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_cf",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.default_language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )
        self.admin_role = Role.objects.create(name="AdminCF", role_type=Role.ALL_TYPE)
        self.organiser = User.objects.create_user(
            username="organiser_cf", password="testpassword"
        )
        self.non_organiser = User.objects.create_user(
            username="non_organiser_cf", password="testpassword"
        )
        self.event = Project.objects.create(
            name="Custom Fields Event",
            url_slug="custom-fields-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=10),
            end_date=timezone.now() + timedelta(days=60),
        )
        self.er = EventRegistrationConfig.objects.create(
            project=self.event,
            max_participants=100,
            registration_end_date=timezone.now() + timedelta(days=30),
            status=RegistrationStatus.OPEN,
        )
        self.draft_event = Project.objects.create(
            name="Draft Custom Fields Event",
            url_slug="draft-custom-fields-event",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.default_language,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=10),
            end_date=timezone.now() + timedelta(days=60),
        )
        self.draft_er = EventRegistrationConfig.objects.create(
            project=self.draft_event,
            status=RegistrationStatus.OPEN,
            is_draft=True,
        )
        ProjectMember.objects.create(
            user=self.organiser, project=self.event, role=self.admin_role
        )
        ProjectMember.objects.create(
            user=self.organiser, project=self.draft_event, role=self.admin_role
        )
        self.patch_url = reverse(
            "organization:edit-registration-config",
            kwargs={"url_slug": self.event.url_slug},
        )
        self.draft_patch_url = reverse(
            "organization:edit-registration-config",
            kwargs={"url_slug": self.draft_event.url_slug},
        )


# ---------------------------------------------------------------------------
# POST /api/projects/ — create event with fields
# ---------------------------------------------------------------------------


class TestCreateEventWithCustomFields(APITestCase):
    """Tests for creating an event that includes custom registration fields."""

    def setUp(self):
        self.url = reverse("organization:create-project-api")

        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_cf_create",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.user = User.objects.create_user(
            username="testuser_cf_create", password="testpassword"
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
            "name": "Custom Fields Test Event",
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
            "end_date": "2099-08-01T20:00:00Z",
            "start_date": "2026-07-01T10:00:00Z",
        }

    # ── Test 1: create with 10 mixed fields ─────────────────────────────────

    @tag("custom_fields", "projects")
    def test_create_event_with_15_custom_fields(self):
        """Spec test 1 — up to 15 fields (checkbox + option_select) are saved and returned."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "is_required": True,
                        "label": "Checkbox 1",
                        "settings": {"description": "<p>I agree to the terms.</p>"},
                    },
                    {
                        "field_type": "option_select",
                        "order": 1,
                        "is_required": False,
                        "label": "Option Select 1",
                        "settings": {"title": "Meal preference"},
                        "options": [
                            {"title": "Vegetarian", "order": 0},
                            {"title": "Vegan", "order": 1},
                        ],
                    },
                    {
                        "field_type": "checkbox",
                        "order": 2,
                        "is_required": False,
                        "label": "Checkbox 2",
                        "settings": {"description": "<p>Newsletter opt-in</p>"},
                    },
                    {
                        "field_type": "option_select",
                        "order": 3,
                        "is_required": True,
                        "label": "Option Select 2",
                        "settings": {"title": "Participation mode"},
                        "options": [{"title": "Online", "order": 0}],
                    },
                    {
                        "field_type": "checkbox",
                        "order": 4,
                        "is_required": False,
                        "label": "Checkbox 3",
                        "settings": {"description": "<p>GDPR consent</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 5,
                        "is_required": False,
                        "label": "Checkbox 4",
                        "settings": {"description": "<p>Additional info</p>"},
                    },
                    {
                        "field_type": "option_select",
                        "order": 6,
                        "is_required": False,
                        "label": "Option Select 3",
                        "settings": {"title": "T-shirt size"},
                        "options": [
                            {"title": "S", "order": 0},
                            {"title": "M", "order": 1},
                            {"title": "L", "order": 2},
                        ],
                    },
                    {
                        "field_type": "checkbox",
                        "order": 7,
                        "is_required": False,
                        "label": "Checkbox 5",
                        "settings": {"description": "<p>Photo consent</p>"},
                    },
                    {
                        "field_type": "option_select",
                        "order": 8,
                        "is_required": False,
                        "label": "Option Select 4",
                        "settings": {"title": "Transport"},
                        "options": [
                            {"title": "Car", "order": 0},
                            {"title": "Bike", "order": 1},
                        ],
                    },
                    {
                        "field_type": "checkbox",
                        "order": 9,
                        "is_required": False,
                        "label": "Checkbox 6",
                        "settings": {"description": "<p>Terms v2</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 10,
                        "is_required": False,
                        "label": "Checkbox 7",
                        "settings": {"description": "<p>Terms v2</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 11,
                        "is_required": False,
                        "label": "Checkbox 8",
                        "settings": {"description": "<p>Terms v2</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 12,
                        "is_required": False,
                        "label": "Checkbox 9",
                        "settings": {"description": "<p>Terms v2</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 13,
                        "is_required": False,
                        "label": "Checkbox 10",
                        "settings": {"description": "<p>Terms v2</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 14,
                        "is_required": False,
                        "label": "Checkbox 11",
                        "settings": {"description": "<p>Terms v2</p>"},
                    },
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        fields = RegistrationField.objects.filter(registration_config=er).order_by(
            "order"
        )
        self.assertEqual(fields.count(), 15)
        self.assertEqual(fields[0].field_type, "checkbox")
        self.assertEqual(fields[1].field_type, "option_select")
        self.assertEqual(
            RegistrationFieldOption.objects.filter(field=fields[1]).count(), 2
        )

    # ── Test 2: 16th field rejected ─────────────────────────────────────────

    @tag("custom_fields", "projects")
    def test_create_event_with_eleven_fields_rejected(self):
        """Spec test 2 — attempting to create 16 custom fields returns 400."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        fields = [
            {
                "field_type": "checkbox",
                "order": i,
                "is_required": False,
                "label": f"Checkbox {i + 1}",
                "settings": {"description": "<p>Field</p>"},
            }
            for i in range(16)
        ]
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {"fields": fields},
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── Test 3: option_select 0 options on publish → 400 ────────────────────

    @tag("custom_fields", "projects")
    def test_option_select_no_options_on_publish_rejected(self):
        """Spec test 3 — option_select with zero options rejected on publish."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
                "fields": [
                    {
                        "field_type": "option_select",
                        "order": 0,
                        "is_required": False,
                        "label": "Option Select 1",
                        "settings": {},
                        "options": [],
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Test 4: option_select 0 options on draft → accepted ─────────────────

    @tag("custom_fields", "projects")
    def test_option_select_no_options_on_draft_accepted(self):
        """Spec test 4 — option_select with zero options accepted in draft mode."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {
                "fields": [
                    {
                        "field_type": "option_select",
                        "order": 0,
                        "is_required": False,
                        "label": "Option Select 1",
                        "settings": {},
                        "options": [],
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        self.assertEqual(
            RegistrationField.objects.filter(registration_config=er).count(), 1
        )

    # ── Test 9: unknown settings key stripped ───────────────────────────────

    @tag("custom_fields", "projects")
    def test_checkbox_unknown_settings_key_stripped(self):
        """Spec test 9 — unknown settings key is stripped; only description persisted."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "is_required": False,
                        "label": "Checkbox 1",
                        "settings": {
                            "description": "<p>Valid</p>",
                            "rogue": "should-be-stripped",
                        },
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        field = RegistrationField.objects.get(registration_config=er)
        self.assertNotIn("rogue", field.settings)
        self.assertIn("description", field.settings)

    # ── Test 10: XSS in description stripped ────────────────────────────────

    @tag("custom_fields", "projects")
    def test_checkbox_description_xss_stripped(self):
        """Spec test 10 — <script> tag in description is stripped."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 1",
                        "settings": {
                            "description": "<p>Safe</p><script>alert(1)</script>"
                        },
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        field = RegistrationField.objects.get(registration_config=er)
        self.assertNotIn("script", field.settings["description"])
        self.assertIn("<p>Safe</p>", field.settings["description"])

    # ── Test 11: <a> without rel gets rel added ──────────────────────────────

    @tag("custom_fields", "projects")
    def test_checkbox_link_gets_noopener_rel(self):
        """Spec test 11 — <a> without rel gets rel="noopener noreferrer" on save."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 1",
                        "settings": {
                            "description": '<p>See <a href="https://example.com">terms</a></p>'
                        },
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        field = RegistrationField.objects.get(registration_config=er)
        self.assertIn('rel="noopener noreferrer"', field.settings["description"])

    # ── Test 12: empty description on publish → 400 ──────────────────────────

    @tag("custom_fields", "projects")
    def test_checkbox_empty_description_on_publish_rejected(self):
        """Spec test 12 — empty checkbox description rejected on publish."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "is_required": True,
                        "label": "Checkbox 1",
                        "settings": {"description": ""},
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Test 13: empty description on draft → accepted ───────────────────────

    @tag("custom_fields", "projects")
    def test_checkbox_empty_description_on_draft_accepted(self):
        """Spec test 13 — empty checkbox description accepted in draft mode."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "is_required": True,
                        "label": "Checkbox 1",
                        "settings": {"description": ""},
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    # ── Test 14: option_select arbitrary settings stripped ───────────────────

    @tag("custom_fields", "projects")
    def test_option_select_arbitrary_settings_stripped(self):
        """Spec test 14 — arbitrary keys in option_select settings are stripped."""
        self.client.login(username="testuser_cf_create", password="testpassword")
        data = {
            **self.base_event_data,
            "is_draft": True,
            "registration_config": {
                "fields": [
                    {
                        "field_type": "option_select",
                        "order": 0,
                        "label": "Option Select 1",
                        "settings": {"arbitrary": "value", "another": 123},
                        "options": [{"title": "Option A", "order": 0}],
                    }
                ],
            },
        }

        response = self.client.post(self.url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        field = RegistrationField.objects.get(registration_config=er)
        self.assertEqual(field.settings, {})


# ---------------------------------------------------------------------------
# PATCH /api/projects/{slug}/registration-config/ — edit fields
# ---------------------------------------------------------------------------


class TestEditRegistrationConfigFields(_CustomFieldsBase):
    """Tests for syncing custom fields via the registration-config PATCH endpoint."""

    def _create_field(
        self, field_type="checkbox", order=0, settings=None, options=None, label=None
    ):
        """Helper: create a RegistrationField directly on self.er."""
        if label is None:
            if not hasattr(self, "_label_counter"):
                self._label_counter = {}
            type_names = {
                "checkbox": "Checkbox",
                "option_select": "Option Select",
                "inventory": "Inventory",
            }
            key = type_names.get(field_type, field_type)
            count = self._label_counter.get(key, 0) + 1
            self._label_counter[key] = count
            label = f"{key} {count}"
        if settings is None:
            settings = (
                {"description": "<p>Test</p>"} if field_type == "checkbox" else {}
            )
        field = RegistrationField.objects.create(
            registration_config=self.er,
            field_type=field_type,
            order=order,
            is_required=False,
            label=label,
            settings=settings,
        )
        if options:
            for opt in options:
                RegistrationFieldOption.objects.create(field=field, **opt)
        return field

    # ── Test 5: reorder fields ───────────────────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_reorder_fields_reflected_in_response(self):
        """Spec test 5 — reordering fields is reflected in the API response."""
        field_a = self._create_field(order=0)
        field_b = self._create_field(
            field_type="option_select", order=1, options=[{"title": "Yes", "order": 0}]
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {"id": field_b.id, "order": 0, "label": "Option Select 2"},
                    {"id": field_a.id, "order": 1, "label": "Checkbox 2"},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        returned_fields = response.data["fields"]
        self.assertEqual(returned_fields[0]["id"], field_b.id)
        self.assertEqual(returned_fields[1]["id"], field_a.id)

        field_a.refresh_from_db()
        field_b.refresh_from_db()
        self.assertEqual(field_a.order, 1)
        self.assertEqual(field_b.order, 0)

    # ── Test 6: delete a field ───────────────────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_delete_field_removes_field_and_options(self):
        """Spec test 6 — field absent from the array is deleted, along with its options."""
        field_keep = self._create_field(order=0)
        field_delete = self._create_field(
            field_type="option_select",
            order=1,
            options=[{"title": "A", "order": 0}, {"title": "B", "order": 1}],
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {"fields": [{"id": field_keep.id, "order": 0, "label": "Checkbox 2"}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(RegistrationField.objects.filter(id=field_delete.id).exists())
        self.assertFalse(
            RegistrationFieldOption.objects.filter(field=field_delete).exists()
        )
        self.assertTrue(RegistrationField.objects.filter(id=field_keep.id).exists())

    # ── Test 7: unauthenticated → 401 ───────────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_unauthenticated_patch_returns_401(self):
        """Spec test 7 — unauthenticated request returns 401."""
        response = self.client.patch(
            self.patch_url,
            {"fields": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Test 8: non-organiser → 403 ─────────────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_non_organiser_patch_returns_403(self):
        """Spec test 8 — non-organiser authenticated request returns 403."""
        self.client.login(username="non_organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {"fields": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ── Full sync (create + update + delete) ─────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_full_field_sync_in_single_request(self):
        """Create, update, and delete fields atomically in a single PATCH."""
        field_update = self._create_field(order=0)
        field_delete = self._create_field(
            field_type="option_select",
            order=1,
            options=[{"title": "Option A", "order": 0}],
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    # Update existing
                    {
                        "id": field_update.id,
                        "order": 0,
                        "label": "Checkbox 2",
                        "settings": {"description": "<p>Updated</p>"},
                    },
                    # Create new
                    {
                        "field_type": "option_select",
                        "order": 1,
                        "label": "Option Select 2",
                        "settings": {"title": "New select"},
                        "options": [{"title": "New opt", "order": 0}],
                    },
                    # field_delete absent → deleted
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        field_update.refresh_from_db()
        self.assertIn("Updated", field_update.settings.get("description", ""))

        self.assertFalse(RegistrationField.objects.filter(id=field_delete.id).exists())

        new_field = RegistrationField.objects.filter(
            registration_config=self.er, field_type="option_select", order=1
        ).first()
        self.assertIsNotNone(new_field)
        self.assertEqual(
            RegistrationFieldOption.objects.filter(field=new_field).count(), 1
        )

    # ── Max 15 field enforcement on PATCH ───────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_patch_eleven_fields_rejected(self):
        """11 fields via PATCH returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        fields = [
            {
                "field_type": "checkbox",
                "order": i,
                "label": f"Checkbox {i + 1}",
                "settings": {"description": "<p>x</p>"},
            }
            for i in range(16)
        ]
        response = self.client.patch(
            self.draft_patch_url,
            {"fields": fields},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── Invalid field ID ─────────────────────────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_patch_invalid_field_id_rejected(self):
        """A field ID that doesn't belong to this event returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [{"id": 999999, "order": 0, "label": "Checkbox 1"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Duplicate order values rejected ─────────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_duplicate_field_orders_rejected(self):
        """Two fields with the same order value return 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 1",
                        "settings": {},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 2",
                        "settings": {},
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Fields not sent → existing fields unchanged ──────────────────────────

    @tag("custom_fields", "registration_config")
    def test_patch_without_fields_leaves_existing_fields_untouched(self):
        """PATCH that omits the `fields` key does not touch existing fields."""
        field = self._create_field(order=0)

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {"max_participants": 200},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(RegistrationField.objects.filter(id=field.id).exists())
        self.assertEqual(self.er.fields.count(), 1)


# ---------------------------------------------------------------------------
# PATCH — answer-cascade and draft-vs-publish validation
# ---------------------------------------------------------------------------


class TestEditFieldsDeleteWithAnswers(_CustomFieldsBase):
    """
    Tests 7 and 7b — deleting a field / option that already has registrant
    answers must succeed; the DB CASCADE removes dependent answers automatically.
    """

    def setUp(self):
        super().setUp()
        self.registrant = User.objects.create_user(
            username="registrant_cf", password="testpassword"
        )
        self.registration = EventRegistration.objects.create(
            user=self.registrant,
            registration_config=self.er,
        )

    def _create_field(
        self, field_type="checkbox", order=0, settings=None, options=None, label=None
    ):
        if label is None:
            if not hasattr(self, "_label_counter"):
                self._label_counter = {}
            type_names = {
                "checkbox": "Checkbox",
                "option_select": "Option Select",
                "inventory": "Inventory",
            }
            key = type_names.get(field_type, field_type)
            count = self._label_counter.get(key, 0) + 1
            self._label_counter[key] = count
            label = f"{key} {count}"
        if settings is None:
            settings = (
                {"description": "<p>Test</p>"} if field_type == "checkbox" else {}
            )
        field = RegistrationField.objects.create(
            registration_config=self.er,
            field_type=field_type,
            order=order,
            is_required=False,
            label=label,
            settings=settings,
        )
        if options:
            for opt in options:
                RegistrationFieldOption.objects.create(field=field, **opt)
        return field

    @tag("custom_fields", "registration_config")
    def test_delete_field_with_answers_cascades_and_returns_200(self):
        """Test 7 — deleting a field that has registrant answers succeeds; answers cascade-deleted."""
        field = self._create_field(order=0)
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=field,
            value_boolean=True,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {"fields": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(RegistrationField.objects.filter(id=field.id).exists())
        self.assertFalse(
            RegistrationFieldAnswer.objects.filter(
                registration=self.registration
            ).exists()
        )

    @tag("custom_fields", "registration_config")
    def test_delete_option_with_answers_cascades_and_returns_200(self):
        """Test 7b — deleting an option that has answers succeeds; answers cascade-deleted."""
        field = self._create_field(
            field_type="option_select",
            order=0,
            options=[
                {"title": "Option A", "order": 0},
                {"title": "Option B", "order": 1},
            ],
        )
        option_a = field.options.get(title="Option A")
        option_b = field.options.get(title="Option B")
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=field,
            value_option=option_a,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        # Keep the field, keep option_b, drop option_a
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Option Select 2",
                        "options": [
                            {"id": option_b.id, "title": "Option B", "order": 0}
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(
            RegistrationFieldOption.objects.filter(id=option_a.id).exists()
        )
        self.assertFalse(
            RegistrationFieldAnswer.objects.filter(
                registration=self.registration, value_option=option_a
            ).exists()
        )
        self.assertTrue(RegistrationFieldOption.objects.filter(id=option_b.id).exists())


class TestEditFieldsDraftVsPublish(_CustomFieldsBase):
    """
    Tests 3, 4, 10, 11, 12, 13 for the PATCH path.

    Tests 3 and 10 use the published project from _CustomFieldsBase (is_draft=False).
    Tests 4 and 11 use a separate draft project created here.
    Tests 12 and 13 verify server-side sanitization on PATCH.
    """

    def setUp(self):
        super().setUp()

    # ── Test 3: option_select 0 options on publish → 400 ────────────────────

    @tag("custom_fields", "registration_config")
    def test_option_select_no_options_on_publish_rejected_via_patch(self):
        """Test 3 (PATCH) — option_select with 0 options rejected on published project."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "option_select",
                        "order": 0,
                        "label": "Option Select 1",
                        "settings": {},
                        "options": [],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Test 4: option_select 0 options on draft → accepted ─────────────────

    @tag("custom_fields", "registration_config")
    def test_option_select_no_options_on_draft_accepted_via_patch(self):
        """Test 4 (PATCH) — option_select with 0 options accepted on draft project."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [
                    {
                        "field_type": "option_select",
                        "order": 0,
                        "label": "Option Select 1",
                        "settings": {},
                        "options": [],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ── option_select missing title on publish → 400 ──────────────────────

    @tag("custom_fields", "registration_config")
    def test_option_select_missing_title_on_publish_rejected_via_patch(self):
        """option_select without title rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "option_select",
                        "order": 0,
                        "label": "Option Select 1",
                        "settings": {"title": ""},
                        "options": [{"title": "A", "order": 0}],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── option_select missing title on draft → accepted ────────────────────

    @tag("custom_fields", "registration_config")
    def test_option_select_missing_title_on_draft_accepted_via_patch(self):
        """option_select without title accepted on draft project."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [
                    {
                        "field_type": "option_select",
                        "order": 0,
                        "label": "Option Select 1",
                        "settings": {"title": ""},
                        "options": [{"title": "A", "order": 0}],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ── Test 10: checkbox empty description on publish → 400 ─────────────────

    @tag("custom_fields", "registration_config")
    def test_checkbox_empty_description_on_publish_rejected_via_patch(self):
        """Test 10 (PATCH) — empty checkbox description rejected on published project."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 1",
                        "settings": {"description": ""},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Test 11: checkbox empty description on draft → accepted ──────────────

    @tag("custom_fields", "registration_config")
    def test_checkbox_empty_description_on_draft_accepted_via_patch(self):
        """Test 11 (PATCH) — empty checkbox description accepted on draft project."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 1",
                        "settings": {"description": ""},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ── Test 12: unknown settings key stripped via PATCH ──────────────────────

    @tag("custom_fields", "registration_config")
    def test_checkbox_unknown_settings_key_stripped_via_patch(self):
        """Test 12 (PATCH) — unknown key in settings is stripped on PATCH."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 1",
                        "settings": {
                            "description": "<p>Valid</p>",
                            "rogue": "should-be-stripped",
                        },
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field = RegistrationField.objects.get(registration_config=self.draft_er)
        self.assertNotIn("rogue", field.settings)
        self.assertIn("description", field.settings)

    # ── Test 13: HTML sanitization via PATCH ─────────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_checkbox_xss_stripped_via_patch(self):
        """Test 13 (PATCH) — disallowed HTML tags stripped on PATCH."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Checkbox 1",
                        "settings": {
                            "description": "<p>Safe</p><script>alert(1)</script>"
                        },
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field = RegistrationField.objects.get(registration_config=self.draft_er)
        self.assertNotIn("script", field.settings["description"])
        self.assertIn("<p>Safe</p>", field.settings["description"])


# ---------------------------------------------------------------------------
# PATCH — has_answers flag and answer-lock validation
# ---------------------------------------------------------------------------


class TestAnswerLock(_CustomFieldsBase):
    """
    Tests 14-19 — answer-aware read-only restrictions and has_answers flag.

    When a field or option has existing registrant answers:
      - GET response includes has_answers=true
      - Changing immutable text properties (checkbox description, option_select
        title, option title) is rejected with 400
      - Non-text changes (is_required, order) are still allowed
    """

    def setUp(self):
        super().setUp()
        self.registrant = User.objects.create_user(
            username="registrant_lock", password="testpassword"
        )
        self.registration = EventRegistration.objects.create(
            user=self.registrant,
            registration_config=self.er,
        )

    def _create_checkbox_field(self, description="<p>Agree</p>", order=0, label=None):
        if label is None:
            if not hasattr(self, "_label_counter"):
                self._label_counter = {}
            count = self._label_counter.get("Checkbox", 0) + 1
            self._label_counter["Checkbox"] = count
            label = f"Checkbox {count}"
        return RegistrationField.objects.create(
            registration_config=self.er,
            field_type="checkbox",
            order=order,
            is_required=False,
            label=label,
            settings={"description": description},
        )

    def _create_option_select_field(
        self, title="Meal?", order=0, options=None, label=None
    ):
        if label is None:
            if not hasattr(self, "_label_counter"):
                self._label_counter = {}
            count = self._label_counter.get("Option Select", 0) + 1
            self._label_counter["Option Select"] = count
            label = f"Option Select {count}"
        field = RegistrationField.objects.create(
            registration_config=self.er,
            field_type="option_select",
            order=order,
            is_required=False,
            label=label,
            settings={"title": title},
        )
        if options:
            for opt in options:
                RegistrationFieldOption.objects.create(field=field, **opt)
        return field

    # ── Test 14: has_answers=true in GET response ────────────────────────────

    @tag("custom_fields", "registration_config")
    def test_has_answers_true_in_get_response(self):
        """Test 14 — has_answers=true on fields/options that have answers."""
        field = self._create_checkbox_field()
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=field,
            value_boolean=True,
        )

        option_field = self._create_option_select_field(
            order=1, options=[{"title": "A", "order": 0}, {"title": "B", "order": 1}]
        )
        option_a = option_field.options.get(title="A")
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=option_field,
            value_option=option_a,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        # GET via PATCH with no fields key — response includes fields
        response = self.client.patch(self.patch_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        returned_fields = {f["id"]: f for f in response.data["fields"]}

        # Checkbox field: has_answers=true
        self.assertTrue(returned_fields[field.id]["has_answers"])

        # option_select field: has_answers=true; option A locked, option B not
        self.assertTrue(returned_fields[option_field.id]["has_answers"])
        opt_map = {o["id"]: o for o in returned_fields[option_field.id]["options"]}
        self.assertTrue(opt_map[option_a.id]["has_answers"])
        option_b = option_field.options.get(title="B")
        self.assertFalse(opt_map[option_b.id]["has_answers"])

    # ── Test 15: checkbox description change rejected ────────────────────────

    @tag("custom_fields", "registration_config")
    def test_checkbox_description_change_rejected_when_has_answers(self):
        """Test 15 — changing checkbox description rejected when field has answers."""
        field = self._create_checkbox_field(description="<p>Original</p>")
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=field,
            value_boolean=True,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Checkbox 2",
                        "settings": {"description": "<p>Changed</p>"},
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── Test 16: option_select title change rejected ─────────────────────────

    @tag("custom_fields", "registration_config")
    def test_option_select_title_change_rejected_when_has_answers(self):
        """Test 16 — changing option_select question title rejected when field has answers."""
        field = self._create_option_select_field(
            title="Original?", options=[{"title": "Yes", "order": 0}]
        )
        option = field.options.first()
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=field,
            value_option=option,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Option Select 2",
                        "settings": {"title": "Changed?"},
                        "options": [{"id": option.id, "title": "Yes", "order": 0}],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── Test 17: answered option title change rejected ───────────────────────

    @tag("custom_fields", "registration_config")
    def test_answered_option_title_change_rejected(self):
        """Test 17 — changing title of a selected option rejected when has answers."""
        field = self._create_option_select_field(
            title="Meal?", options=[{"title": "Vegan", "order": 0}]
        )
        option = field.options.first()
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=field,
            value_option=option,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Option Select 2",
                        "settings": {"title": "Meal?"},
                        "options": [
                            {"id": option.id, "title": "Plant-based", "order": 0}
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── Test 18: is_required and order changes allowed with has_answers ───────

    @tag("custom_fields", "registration_config")
    def test_is_required_and_order_changes_allowed_when_has_answers(self):
        """Test 18 — is_required and order can change even when field has answers."""
        field = self._create_checkbox_field(description="<p>Agree</p>")
        RegistrationFieldAnswer.objects.create(
            registration=self.registration,
            field=field,
            value_boolean=True,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Checkbox 2",
                        "is_required": True,
                        # description unchanged — not sending settings at all
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field.refresh_from_db()
        self.assertTrue(field.is_required)

    # ── Test 19: has_answers=false when no answers ───────────────────────────

    @tag("custom_fields", "registration_config")
    def test_has_answers_false_when_no_answers(self):
        """Test 19 — has_answers=false for fields and options without any answers."""
        field = self._create_option_select_field(options=[{"title": "Yes", "order": 0}])
        option = field.options.first()

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(self.patch_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        returned_field = next(f for f in response.data["fields"] if f["id"] == field.id)
        self.assertFalse(returned_field["has_answers"])
        opt_data = next(o for o in returned_field["options"] if o["id"] == option.id)
        self.assertFalse(opt_data["has_answers"])


# ---------------------------------------------------------------------------
# Inventory field type (Phase 4b)
# ---------------------------------------------------------------------------


class TestInventoryField(_CustomFieldsBase):
    """
    Tests for the inventory custom field type.

    Spec test cases:
      INV-1  – Create event with inventory field (POST /api/projects/)
      INV-2  – Inventory field validation on publish (missing title → 400)
      INV-3  – Inventory field validation on publish (0 options → 400)
      INV-4  – Inventory field validation on publish (missing available_amount → 400)
      INV-5  – Inventory field validation on publish (missing max_amount_per_guest → 400)
      INV-6  – Inventory field accepted in draft (missing numeric fields OK)
      INV-7  – Edit inventory field via PATCH
      INV-8  – Answer-lock on inventory field title
      INV-9  – Answer-lock on inventory option title
      INV-10 – available_amount and max_amount_per_guest remain mutable with answers
      INV-11 – 5-field limit includes inventory
      INV-12 – GET response includes available_amount, max_amount_per_guest on options
    """

    def _create_inventory_field(
        self, title="Meal tickets", order=0, options=None, label=None
    ):
        """Helper: create an inventory RegistrationField on self.er."""
        if label is None:
            if not hasattr(self, "_label_counter"):
                self._label_counter = {}
            count = self._label_counter.get("Inventory", 0) + 1
            self._label_counter["Inventory"] = count
            label = f"Inventory {count}"
        field = RegistrationField.objects.create(
            registration_config=self.er,
            field_type="inventory",
            order=order,
            is_required=False,
            label=label,
            settings={"title": title, "description": ""},
        )
        if options:
            for opt in options:
                RegistrationFieldOption.objects.create(field=field, **opt)
        return field

    # ── INV-1: Create event with inventory field ─────────────────────────────

    @tag("custom_fields", "inventory")
    def test_create_inventory_field_via_patch(self):
        """INV-1 — PATCH creates inventory field with options persisting capacity values."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "inventory",
                        "order": 0,
                        "is_required": True,
                        "label": "Inventory 1",
                        "settings": {
                            "title": "Meal tickets",
                            "description": "Choose your meal.",
                        },
                        "options": [
                            {
                                "title": "Vegetarian",
                                "order": 0,
                                "available_amount": 50,
                                "max_amount_per_guest": 2,
                            },
                            {
                                "title": "Standard",
                                "order": 1,
                                "available_amount": 100,
                                "max_amount_per_guest": 3,
                            },
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field = RegistrationField.objects.get(
            registration_config=self.er, field_type="inventory"
        )
        self.assertEqual(field.settings["title"], "Meal tickets")
        self.assertEqual(field.options.count(), 2)

        veg = field.options.get(title="Vegetarian")
        self.assertEqual(veg.available_amount, 50)
        self.assertEqual(veg.max_amount_per_guest, 2)

    # ── INV-2: Missing title on publish → 400 ────────────────────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_missing_title_on_publish_rejected(self):
        """INV-2 — inventory field without title rejected when publishing."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "inventory",
                        "order": 0,
                        "label": "Inventory 1",
                        "settings": {"title": "", "description": ""},
                        "options": [
                            {
                                "title": "Option A",
                                "order": 0,
                                "available_amount": 10,
                                "max_amount_per_guest": 1,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── INV-3: No options on publish → 400 ───────────────────────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_no_options_on_publish_rejected(self):
        """INV-3 — inventory field with 0 options rejected when publishing."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "inventory",
                        "order": 0,
                        "label": "Inventory 1",
                        "settings": {"title": "Meals", "description": ""},
                        "options": [],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── INV-4: Missing available_amount on publish → 400 ─────────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_missing_available_amount_on_publish_rejected(self):
        """INV-4 — inventory option without available_amount rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "inventory",
                        "order": 0,
                        "label": "Inventory 1",
                        "settings": {"title": "Meals"},
                        "options": [
                            {
                                "title": "Option A",
                                "order": 0,
                                "max_amount_per_guest": 2,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── INV-5: Missing max_amount_per_guest on publish → 400 ─────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_missing_max_per_guest_on_publish_rejected(self):
        """INV-5 — inventory option without max_amount_per_guest rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "inventory",
                        "order": 0,
                        "label": "Inventory 1",
                        "settings": {"title": "Meals"},
                        "options": [
                            {
                                "title": "Option A",
                                "order": 0,
                                "available_amount": 10,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── INV-6: Draft mode skips publish validation ────────────────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_accepted_in_draft_without_numeric_fields(self):
        """INV-6 — inventory field with no options / numeric fields accepted on draft."""
        # Create a draft project + config for this test.
        from datetime import timedelta

        from organization.models import ProjectStatus

        project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active_inv_draft",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        from climateconnect_api.models import Language
        from django.utils import timezone

        lang, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )
        draft_event = Project.objects.create(
            name="Draft Inventory Event",
            url_slug="draft-inventory-event",
            is_active=True,
            is_draft=True,
            status=project_status,
            language=lang,
            project_type="EV",
            start_date=timezone.now() + timedelta(days=10),
            end_date=timezone.now() + timedelta(days=60),
        )
        from organization.models.event_registration import (
            EventRegistrationConfig,
            RegistrationStatus,
        )

        draft_er = EventRegistrationConfig.objects.create(
            project=draft_event,
            status=RegistrationStatus.OPEN,
            is_draft=True,
        )
        ProjectMember.objects.create(
            user=self.organiser, project=draft_event, role=self.admin_role
        )
        from django.urls import reverse

        draft_url = reverse(
            "organization:edit-registration-config",
            kwargs={"url_slug": draft_event.url_slug},
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            draft_url,
            {
                "fields": [
                    {
                        "field_type": "inventory",
                        "order": 0,
                        "label": "Inventory 1",
                        "settings": {"title": "", "description": ""},
                        "options": [],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            RegistrationField.objects.filter(
                registration_config=draft_er, field_type="inventory"
            ).count(),
            1,
        )

    # ── INV-7: Edit inventory field via PATCH ─────────────────────────────────

    @tag("custom_fields", "inventory")
    def test_edit_inventory_field_updates_options(self):
        """INV-7 — PATCH updates inventory settings and syncs options correctly."""
        field = self._create_inventory_field(
            options=[
                {
                    "title": "Veg",
                    "order": 0,
                    "available_amount": 10,
                    "max_amount_per_guest": 1,
                },
                {
                    "title": "Standard",
                    "order": 1,
                    "available_amount": 20,
                    "max_amount_per_guest": 2,
                },
            ]
        )
        keep_opt = field.options.get(title="Veg")
        drop_opt = field.options.get(title="Standard")

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Inventory 2",
                        "settings": {"title": "Updated Meals"},
                        "options": [
                            {
                                "id": keep_opt.id,
                                "title": "Veg",
                                "order": 0,
                                "available_amount": 15,
                                "max_amount_per_guest": 2,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field.refresh_from_db()
        self.assertEqual(field.settings["title"], "Updated Meals")
        keep_opt.refresh_from_db()
        self.assertEqual(keep_opt.available_amount, 15)
        self.assertFalse(
            RegistrationFieldOption.objects.filter(id=drop_opt.id).exists()
        )

    # ── INV-8: Answer-lock on inventory field title ───────────────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_title_change_rejected_when_has_answers(self):
        """INV-8 — changing inventory field title rejected when field has answers."""
        field = self._create_inventory_field(
            title="Meals",
            options=[
                {
                    "title": "Veg",
                    "order": 0,
                    "available_amount": 10,
                    "max_amount_per_guest": 1,
                }
            ],
        )
        option = field.options.first()
        registrant = User.objects.create_user(
            username="registrant_inv8", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration, field=field, value_option=option
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Inventory 2",
                        "settings": {"title": "Changed Meals"},
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── INV-9: Answer-lock on inventory option title ──────────────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_option_title_change_rejected_when_has_answers(self):
        """INV-9 — changing inventory option title rejected when option has answers."""
        field = self._create_inventory_field(
            title="Meals",
            options=[
                {
                    "title": "Veg",
                    "order": 0,
                    "available_amount": 10,
                    "max_amount_per_guest": 1,
                }
            ],
        )
        option = field.options.first()
        registrant = User.objects.create_user(
            username="registrant_inv9", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration, field=field, value_option=option
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Inventory 2",
                        "options": [
                            {
                                "id": option.id,
                                "title": "Plant-based",
                                "order": 0,
                                "available_amount": 10,
                                "max_amount_per_guest": 1,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── INV-10: Capacity values mutable even with answers ─────────────────────

    @tag("custom_fields", "inventory")
    def test_inventory_capacity_values_mutable_when_has_answers(self):
        """INV-10 — available_amount and max_amount_per_guest can be changed with answers."""
        field = self._create_inventory_field(
            title="Meals",
            options=[
                {
                    "title": "Veg",
                    "order": 0,
                    "available_amount": 10,
                    "max_amount_per_guest": 1,
                }
            ],
        )
        option = field.options.first()
        registrant = User.objects.create_user(
            username="registrant_inv10", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration, field=field, value_option=option
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Inventory 2",
                        "options": [
                            {
                                "id": option.id,
                                "title": "Veg",
                                "order": 0,
                                "available_amount": 99,
                                "max_amount_per_guest": 5,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        option.refresh_from_db()
        self.assertEqual(option.available_amount, 99)
        self.assertEqual(option.max_amount_per_guest, 5)

    # ── INV-11: 10-field limit includes inventory ─────────────────────────────

    @tag("custom_fields", "inventory")
    def test_eleven_fields_including_inventory_rejected(self):
        """INV-11 — 11th field (inventory) triggers 400 same as other types."""
        self.client.login(username="organiser_cf", password="testpassword")
        fields = [
            {
                "field_type": "checkbox",
                "order": i,
                "label": f"Checkbox {i + 1}",
                "settings": {"description": "<p>x</p>"},
            }
            for i in range(15)
        ] + [
            {
                "field_type": "inventory",
                "order": 15,
                "label": "Inventory 1",
                "settings": {"title": "Extra"},
                "options": [{"title": "A", "order": 0}],
            }
        ]
        response = self.client.patch(
            self.draft_patch_url,
            {"fields": fields},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── INV-12: GET response includes capacity fields on options ──────────────

    @tag("custom_fields", "inventory")
    def test_get_response_includes_capacity_fields(self):
        """INV-12 — project detail response includes available_amount and max_amount_per_guest."""
        self._create_inventory_field(
            title="Meal tickets",
            options=[
                {
                    "title": "Vegetarian",
                    "order": 0,
                    "available_amount": 50,
                    "max_amount_per_guest": 2,
                }
            ],
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(self.patch_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        inv_field = next(
            f for f in response.data["fields"] if f["field_type"] == "inventory"
        )
        self.assertEqual(inv_field["settings"]["title"], "Meal tickets")
        opt = inv_field["options"][0]
        self.assertEqual(opt["available_amount"], 50)
        self.assertEqual(opt["max_amount_per_guest"], 2)


# ---------------------------------------------------------------------------
# Label validation tests
# ---------------------------------------------------------------------------


class TestRegistrationFieldLabel(_CustomFieldsBase):
    """
    Tests for the registration field label feature.

    Spec test cases:
      - Create field with label → persists correctly
      - Create field without label → 400
      - Empty label rejected → 400
      - Label max length enforced → 400
      - Label uniqueness enforced → 400
      - Label round-trip (GET returns same label)
      - Edit field label via PATCH
      - Label mutable with answers (no answer-lock)
    """

    def setUp(self):
        super().setUp()
        Location.objects.get_or_create(
            city="Test City",
            country="Testland",
            defaults={"name": "Test City, Testland", "place_id": 9999},
        )

    def _create_field(
        self, field_type="checkbox", order=0, settings=None, options=None, label=None
    ):
        if label is None:
            type_names = {
                "checkbox": "Checkbox",
                "option_select": "Option Select",
                "inventory": "Inventory",
            }
            label = f"{type_names.get(field_type, field_type)} {order + 1}"
        if settings is None:
            settings = (
                {"description": "<p>Test</p>"} if field_type == "checkbox" else {}
            )
        field = RegistrationField.objects.create(
            registration_config=self.er,
            field_type=field_type,
            order=order,
            is_required=False,
            label=label,
            settings=settings,
        )
        if options:
            for opt in options:
                RegistrationFieldOption.objects.create(field=field, **opt)
        return field

    # ── Create field with label → persists ──────────────────────────────────

    @tag("custom_fields", "label")
    def test_create_field_with_label_persists(self):
        """Field created with a label stores it correctly."""
        field = self._create_field(label="My Checkbox")
        field.refresh_from_db()
        self.assertEqual(field.label, "My Checkbox")

    # ── POST: create field with label ───────────────────────────────────────

    @tag("custom_fields", "label")
    def test_create_event_with_label_via_post(self):
        """POST /api/projects/ accepts label in nested field; persists correctly."""
        self.client.login(username="organiser_cf", password="testpassword")
        data = {
            "name": "Label Test Event",
            "status": self.project_status.id,
            "short_description": "A short description",
            "collaborators_welcome": False,
            "team_members": [],
            "sectors": [],
            "loc": {
                "place_id": 9999,
                "country": "Testland",
                "city": "Test City",
                "name": "Test City",
                "type": "city",
                "lon": 13.0,
                "lat": 52.0,
                "osm_id": "12345",
            },
            "image": _make_black_image_b64(),
            "source_language": self.default_language.language_code,
            "translations": {},
            "project_type": {
                "name": "Event",
                "original_name": "Event",
                "help_text": "Your Project will show up in the Event calendar",
                "icon": "",
                "type_id": "event",
            },
            "hubName": None,
            "end_date": "2099-08-01T20:00:00Z",
            "start_date": "2026-07-01T10:00:00Z",
            "registration_config": {
                "max_participants": 50,
                "registration_end_date": "2026-07-31T23:59:00Z",
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "is_required": True,
                        "label": "Terms consent",
                        "settings": {"description": "<p>I agree to the terms.</p>"},
                    },
                ],
            },
        }
        url = reverse("organization:create-project-api")
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        project = Project.objects.get(url_slug=response.data["url_slug"])
        er = EventRegistrationConfig.objects.get(project=project)
        field = RegistrationField.objects.get(registration_config=er)
        self.assertEqual(field.label, "Terms consent")

    # ── POST: omit label → 400 ─────────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_create_event_without_label_rejected_via_post(self):
        """POST /api/projects/ without label returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        data = {
            "name": "No Label Event",
            "status": self.project_status.id,
            "short_description": "A short description",
            "collaborators_welcome": False,
            "team_members": [],
            "sectors": [],
            "loc": {
                "place_id": 9999,
                "country": "Testland",
                "city": "Test City",
                "name": "Test City",
                "type": "city",
                "lon": 13.0,
                "lat": 52.0,
                "osm_id": "12345",
            },
            "image": _make_black_image_b64(),
            "source_language": self.default_language.language_code,
            "translations": {},
            "project_type": {
                "name": "Event",
                "original_name": "Event",
                "help_text": "Your Project will show up in the Event calendar",
                "icon": "",
                "type_id": "event",
            },
            "hubName": None,
            "end_date": "2099-08-01T20:00:00Z",
            "start_date": "2026-07-01T10:00:00Z",
            "registration_config": {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "settings": {"description": "<p>Test</p>"},
                    }
                ],
            },
        }
        url = reverse("organization:create-project-api")
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── PATCH: omit label → 400 ────────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_patch_without_label_rejected(self):
        """PATCH /registration-config/ without label returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Empty label rejected ────────────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_empty_label_rejected(self):
        """Sending label: '' returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "",
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Blank label rejected ────────────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_blank_label_rejected(self):
        """Sending label: '   ' (whitespace only) returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "   ",
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Label max length enforced ───────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_label_max_length_enforced(self):
        """Sending label > 30 chars returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "A" * 31,
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Label exactly 30 chars accepted ─────────────────────────────────────

    @tag("custom_fields", "label")
    def test_label_exactly_30_chars_accepted(self):
        """Sending label with exactly 30 chars is accepted."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "A" * 30,
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ── Label uniqueness enforced ───────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_duplicate_label_rejected(self):
        """Two fields with the same label in one config returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Same label",
                        "settings": {"description": "<p>A</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 1,
                        "label": "Same label",
                        "settings": {"description": "<p>B</p>"},
                    },
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Label uniqueness case-insensitive ───────────────────────────────────

    @tag("custom_fields", "label")
    def test_duplicate_label_case_insensitive_rejected(self):
        """Two fields with labels differing only by case return 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "My Field",
                        "settings": {"description": "<p>A</p>"},
                    },
                    {
                        "field_type": "checkbox",
                        "order": 1,
                        "label": "my field",
                        "settings": {"description": "<p>B</p>"},
                    },
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Label unique across existing + new fields ───────────────────────────

    @tag("custom_fields", "label")
    def test_label_unique_with_existing_fields(self):
        """New field with label matching an existing field's label returns 400."""
        self._create_field(label="Existing Label", order=0)
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Existing Label",
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Label round-trip ────────────────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_label_round_trip_in_response(self):
        """GET response returns the same label that was sent on create."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "checkbox",
                        "order": 0,
                        "label": "Consent checkbox",
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["fields"][0]["label"], "Consent checkbox")

    # ── Edit field label ────────────────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_edit_field_label_via_patch(self):
        """PATCH updates label on an existing field."""
        field = self._create_field(label="Old Label", order=0)
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "New Label",
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field.refresh_from_db()
        self.assertEqual(field.label, "New Label")

    # ── Label mutable with answers ──────────────────────────────────────────

    @tag("custom_fields", "label")
    def test_label_mutable_when_field_has_answers(self):
        """Changing label on a field with existing answers succeeds (no answer-lock)."""
        field = self._create_field(label="Original", order=0)
        registrant = User.objects.create_user(
            username="registrant_label", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration, field=field, value_boolean=True
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Updated Label",
                        "is_required": True,
                        "settings": {"description": "<p>Test</p>"},
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field.refresh_from_db()
        self.assertEqual(field.label, "Updated Label")


# ---------------------------------------------------------------------------
# Time Slot Select field type
# ---------------------------------------------------------------------------


class TestTimeSlotField(_CustomFieldsBase):
    """
    Tests for the time_slot_select custom field type.

    Spec test cases:
      TS-1  – Create event with time slot field (POST /api/projects/)
      TS-2  – Time slot field validation on publish (missing title → 400)
      TS-3  – Time slot field validation on publish (0 options → 400)
      TS-4  – Time slot field validation on publish (missing start_time → 400)
      TS-5  – Time slot field validation on publish (missing end_time → 400)
      TS-6  – Time slot field validation on publish (end_time ≤ start_time → 400)
      TS-7  – Time slot field validation on publish (start_time in past → 400)
      TS-8  – Time slot field accepted in draft (missing datetime fields OK)
      TS-9  – Edit time slot field via PATCH
      TS-10 – Answer-lock on time slot field title
      TS-11 – Answer-lock on time slot option start_time
      TS-12 – Answer-lock on time slot option end_time
      TS-13 – available_amount remains mutable with answers
      TS-14 – 5-field limit includes time slot
      TS-15 – GET response includes start_time, end_time, remaining_amount on options
      TS-16 – Null available_amount accepted (unlimited capacity)
      TS-17 – available_amount < 1 rejected on publish
    """

    def _create_time_slot_field(
        self,
        title="Pickup slot",
        order=0,
        options=None,
        label=None,
        description="",
    ):
        """Helper: create a time_slot_select RegistrationField on self.er."""
        if label is None:
            if not hasattr(self, "_label_counter"):
                self._label_counter = {}
            count = self._label_counter.get("Time Slot Select", 0) + 1
            self._label_counter["Time Slot Select"] = count
            label = f"Time Slot Select {count}"
        field = RegistrationField.objects.create(
            registration_config=self.er,
            field_type="time_slot_select",
            order=order,
            is_required=False,
            label=label,
            settings={"title": title, "description": description},
        )
        if options:
            for opt in options:
                RegistrationFieldOption.objects.create(field=field, **opt)
        return field

    # ── TS-1: Create time slot field via PATCH ────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_create_time_slot_field_via_patch(self):
        """TS-1 — PATCH creates time_slot_select field with options persisting datetime values."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "is_required": True,
                        "label": "Pickup Slot",
                        "settings": {
                            "title": "Pick your preferred time slot",
                            "description": "Choose when to pick up.",
                        },
                        "options": [
                            {
                                "order": 0,
                                "start_time": "2099-08-01T10:00:00Z",
                                "end_time": "2099-08-01T12:00:00Z",
                                "available_amount": 20,
                            },
                            {
                                "order": 1,
                                "start_time": "2099-08-01T14:00:00Z",
                                "end_time": "2099-08-01T16:00:00Z",
                            },
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field = RegistrationField.objects.get(
            registration_config=self.er, field_type="time_slot_select"
        )
        self.assertEqual(field.settings["title"], "Pick your preferred time slot")
        self.assertEqual(field.options.count(), 2)
        opt0 = field.options.get(order=0)
        self.assertIsNotNone(opt0.start_time)
        self.assertIsNotNone(opt0.end_time)
        self.assertEqual(opt0.available_amount, 20)
        opt1 = field.options.get(order=1)
        self.assertIsNone(opt1.available_amount)

    # ── TS-2: Missing title on publish → 400 ─────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_missing_title_on_publish_rejected(self):
        """TS-2 — time slot field without title rejected when publishing."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "", "description": ""},
                        "options": [
                            {
                                "order": 0,
                                "start_time": "2099-08-01T10:00:00Z",
                                "end_time": "2099-08-01T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── TS-3: 0 options on publish → 400 ─────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_no_options_on_publish_rejected(self):
        """TS-3 — time slot with 0 options rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── TS-4: Missing start_time → 400 ───────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_missing_start_time_on_publish_rejected(self):
        """TS-4 — time slot option without start_time rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "order": 0,
                                "end_time": "2099-08-01T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── TS-5: Missing end_time → 400 ─────────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_missing_end_time_on_publish_rejected(self):
        """TS-5 — time slot option without end_time rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "order": 0,
                                "start_time": "2099-08-01T10:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── TS-6: end_time ≤ start_time → 400 ────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_end_time_before_start_time_rejected(self):
        """TS-6 — end_time before start_time rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "order": 0,
                                "start_time": "2099-08-01T14:00:00Z",
                                "end_time": "2099-08-01T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── TS-7: start_time in past → 400 ───────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_start_time_in_past_rejected_on_publish(self):
        """TS-7 — start_time in the past rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "order": 0,
                                "start_time": "2020-01-01T10:00:00Z",
                                "end_time": "2020-01-01T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── TS-8: Draft skips validation ──────────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_accepted_on_draft_with_missing_fields(self):
        """TS-8 — time slot with 0 options and missing datetimes accepted in draft mode."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.draft_patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": ""},
                        "options": [],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ── TS-9: Edit time slot field via PATCH ──────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_edit_time_slot_field_via_patch(self):
        """TS-9 — PATCH updates time slot settings and options correctly."""
        field = self._create_time_slot_field(
            title="Original Title",
            options=[
                {
                    "title": "",
                    "order": 0,
                    "start_time": timezone.now() + timedelta(days=10),
                    "end_time": timezone.now() + timedelta(days=10, hours=2),
                    "available_amount": 10,
                }
            ],
        )
        option = field.options.first()

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {
                            "title": "Updated Title",
                            "description": "New desc",
                        },
                        "options": [
                            {
                                "id": option.id,
                                "title": "",
                                "order": 0,
                                "start_time": "2099-08-02T10:00:00Z",
                                "end_time": "2099-08-02T12:00:00Z",
                                "available_amount": 25,
                            },
                            {
                                "order": 1,
                                "start_time": "2099-08-02T14:00:00Z",
                                "end_time": "2099-08-02T16:00:00Z",
                            },
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        field.refresh_from_db()
        self.assertEqual(field.settings["title"], "Updated Title")
        self.assertEqual(field.options.count(), 2)

    # ── TS-10: Answer-lock on field title ─────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_title_change_rejected_when_has_answers(self):
        """TS-10 — changing time slot field title rejected when field has answers."""
        field = self._create_time_slot_field(title="Original Title")
        option = field.options.create(
            title="",
            order=0,
            start_time=timezone.now() + timedelta(days=10),
            end_time=timezone.now() + timedelta(days=10, hours=2),
        )
        registrant = User.objects.create_user(
            username="registrant_ts10", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration,
            field=field,
            value_option=option,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Changed Title"},
                        "options": [
                            {
                                "id": option.id,
                                "title": "",
                                "order": 0,
                                "start_time": "2099-08-01T10:00:00Z",
                                "end_time": "2099-08-01T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── TS-11: Answer-lock on option start_time ──────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_start_time_change_rejected_when_has_answers(self):
        """TS-11 — changing start_time on a time slot option with answers is rejected."""
        field = self._create_time_slot_field(title="Pickup slot")
        option = field.options.create(
            title="",
            order=0,
            start_time=timezone.now() + timedelta(days=10),
            end_time=timezone.now() + timedelta(days=10, hours=2),
        )
        registrant = User.objects.create_user(
            username="registrant_ts11", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration,
            field=field,
            value_option=option,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "id": option.id,
                                "title": "",
                                "order": 0,
                                "start_time": "2099-08-15T10:00:00Z",
                                "end_time": "2099-08-01T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── TS-12: Answer-lock on option end_time ─────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_end_time_change_rejected_when_has_answers(self):
        """TS-12 — changing end_time on a time slot option with answers is rejected."""
        field = self._create_time_slot_field(title="Pickup slot")
        option = field.options.create(
            title="",
            order=0,
            start_time=timezone.now() + timedelta(days=10),
            end_time=timezone.now() + timedelta(days=10, hours=2),
        )
        registrant = User.objects.create_user(
            username="registrant_ts12", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration,
            field=field,
            value_option=option,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "id": option.id,
                                "title": "",
                                "order": 0,
                                "start_time": "2099-08-01T10:00:00Z",
                                "end_time": "2099-08-01T14:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── TS-13: available_amount mutable with answers ──────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_available_amount_mutable_with_answers(self):
        """TS-13 — changing available_amount on a time slot option with answers succeeds."""
        field = self._create_time_slot_field(title="Pickup slot")
        option = field.options.create(
            title="",
            order=0,
            start_time=timezone.now() + timedelta(days=10),
            end_time=timezone.now() + timedelta(days=10, hours=2),
            available_amount=10,
        )
        registrant = User.objects.create_user(
            username="registrant_ts13", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration,
            field=field,
            value_option=option,
        )

        self.client.login(username="organiser_cf", password="testpassword")

        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "id": field.id,
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "id": option.id,
                                "title": "",
                                "order": 0,
                                "start_time": option.start_time.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "end_time": option.end_time.isoformat().replace(
                                    "+00:00", "Z"
                                ),
                                "available_amount": 50,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        option.refresh_from_db()
        self.assertEqual(option.available_amount, 50)

    # ── TS-14: 10-field limit includes time slot ──────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_ten_field_limit_includes_time_slot(self):
        """TS-14 — attempting to add an 11th field (including time slot) returns 400."""
        self.client.login(username="organiser_cf", password="testpassword")
        fields = [
            {
                "field_type": "checkbox",
                "order": i,
                "label": f"Checkbox {i + 1}",
                "settings": {"description": "<p>Test</p>"},
            }
            for i in range(15)
        ]
        fields.append(
            {
                "field_type": "time_slot_select",
                "order": 15,
                "label": "Time Slot 1",
                "settings": {"title": "Pickup slot"},
                "options": [],
            }
        )
        response = self.client.patch(
            self.patch_url,
            {"fields": fields},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fields", response.data)

    # ── TS-15: GET response shape ─────────────────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_get_response_includes_time_slot_fields(self):
        """TS-15 — GET response includes start_time, end_time, remaining_amount."""
        now = timezone.now()
        field = self._create_time_slot_field(
            title="Pickup slot",
            options=[
                {
                    "title": "",
                    "order": 0,
                    "start_time": now + timedelta(days=10, hours=10),
                    "end_time": now + timedelta(days=10, hours=12),
                    "available_amount": 20,
                },
                {
                    "title": "",
                    "order": 1,
                    "start_time": now + timedelta(days=10, hours=14),
                    "end_time": now + timedelta(days=10, hours=16),
                    "available_amount": None,
                },
            ],
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(self.patch_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        returned_field = next(f for f in response.data["fields"] if f["id"] == field.id)
        self.assertEqual(returned_field["field_type"], "time_slot_select")
        self.assertEqual(returned_field["settings"]["title"], "Pickup slot")
        self.assertEqual(len(returned_field["options"]), 2)

        opt0 = returned_field["options"][0]
        self.assertIsNotNone(opt0["start_time"])
        self.assertIsNotNone(opt0["end_time"])
        self.assertEqual(opt0["available_amount"], 20)
        self.assertEqual(opt0["remaining_amount"], 20)
        self.assertEqual(opt0["title"], "")

        opt1 = returned_field["options"][1]
        self.assertIsNone(opt1["available_amount"])
        self.assertIsNone(opt1["remaining_amount"])

    # ── TS-16: Null available_amount accepted ─────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_null_available_amount_accepted(self):
        """TS-16 — time slot option with null available_amount is accepted on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "order": 0,
                                "start_time": "2099-08-01T10:00:00Z",
                                "end_time": "2099-08-01T12:00:00Z",
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ── TS-17: available_amount < 1 rejected ──────────────────────────────────

    @tag("custom_fields", "time_slot")
    def test_time_slot_available_amount_below_one_rejected(self):
        """TS-17 — available_amount < 1 rejected on publish."""
        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(
            self.patch_url,
            {
                "fields": [
                    {
                        "field_type": "time_slot_select",
                        "order": 0,
                        "label": "Time Slot 1",
                        "settings": {"title": "Pickup slot"},
                        "options": [
                            {
                                "order": 0,
                                "start_time": "2099-08-01T10:00:00Z",
                                "end_time": "2099-08-01T12:00:00Z",
                                "available_amount": 0,
                            }
                        ],
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ── TS-18: remaining_amount reflects booked count ─────────────────────────

    @tag("custom_fields", "time_slot")
    def test_remaining_amount_reflects_booked_count(self):
        """TS-18 — remaining_amount = available_amount - active registrations."""
        field = self._create_time_slot_field(title="Pickup slot")
        option = field.options.create(
            title="",
            order=0,
            start_time=timezone.now() + timedelta(days=10),
            end_time=timezone.now() + timedelta(days=10, hours=2),
            available_amount=5,
        )
        registrant = User.objects.create_user(
            username="registrant_ts18", password="testpassword"
        )
        registration = EventRegistration.objects.create(
            user=registrant, registration_config=self.er
        )
        RegistrationFieldAnswer.objects.create(
            registration=registration,
            field=field,
            value_option=option,
        )

        self.client.login(username="organiser_cf", password="testpassword")
        response = self.client.patch(self.patch_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        returned_field = next(f for f in response.data["fields"] if f["id"] == field.id)
        opt_data = next(o for o in returned_field["options"] if o["id"] == option.id)
        self.assertEqual(opt_data["remaining_amount"], 4)

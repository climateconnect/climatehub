import io
import unittest
from base64 import b64encode

from django.contrib.auth.models import User
from django.test import tag
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language, Role
from location.models import Location, LocationTranslation
from organization.models import (
    Organization,
    Project,
    ProjectMember,
    ProjectParents,
    ProjectSectorMapping,
    ProjectStatus,
    Sector,
)

# set this at lowest to 4
INITIAL_PROJECT_COUNT = 4


@unittest.skip("Temporarily disabled: see CI failure #57660401767")
class TestCreateProjectsViews(APITestCase):
    def setUp(self):
        self.url = reverse("organization:create-project-api")

        projectStatus_active = ProjectStatus.objects.create(
            name="active",
            name_de_translation="aktiv",
            has_end_date=False,
            has_start_date=False,
        )

        self.proejcts = [
            Project.objects.create(
                name=f"Test Project {i}",
                description=f"Test Project {i} Description",
                url_slug=f"test-project-{i}",
                is_active=True,
                status=projectStatus_active,
            )
            for i in range(1, INITIAL_PROJECT_COUNT + 1)
        ]

        self.user = User.objects.create_user(
            username="testuser",
            password="testpassword",
        )

        Location.objects.create(
            name="Test Location", city="Berlin", country="Germany", place_id=1
        )

        self.default_language = Language.objects.get(language_code="en")

        self.default_location_data = {
            "place_id": 1,
            "country": "Germany",
            "name": "Test Location",
            "type": "type",
            "lon": 13.4050,
            "lat": 52.5200,
        }
        image = Image.new("RGB", (10, 10), "black")
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        self.image = "data:image/png;base64," + b64encode(buffered.getvalue()).decode(
            "utf-8"
        )

        self.default_project_type_data = {
            "name": "Project",
            "original_name": "Project",
            "help_text": "Not an Idea or Event? Click here.",
            "icon": "",
            "type_id": "project",
        }

        self.default_project_data = {
            "name": "Test Project",
            "status": ProjectStatus.objects.first().id,
            "short_description": "Test Project Short Description",
            "collaborators_welcome": True,
            "team_members": [],
            "description": "Test Project Description",
            "url_slug": "test-project",
            "project_tags": [],
            "loc": self.default_location_data,
            "image": self.image,
            "source_language": self.default_language.language_code,
            "translations": {},
            "project_type": self.default_project_type_data,
            "hubName": "null",
        }

        self.sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

    def test_post_project_declines_if_not_authenticated(self):
        response = self.client.post(self.url, self.default_project_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @tag("projects")
    def test_post_project_without_sector(self):
        self.client.login(username="testuser", password="testpassword")
        response = self.client.post(self.url, self.default_project_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            0,
        )

    @tag("sectors", "projects")
    def test_post_project_with_one_sector_as_array(self):
        self.client.login(username="testuser", password="testpassword")
        self.default_project_data["sectors"] = [self.sectors[0].key]

        response = self.client.post(self.url, self.default_project_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            1,
        )

    @tag("sectors", "projects")
    def test_post_project_with_one_sector_as_string(self):
        self.client.login(username="testuser", password="testpassword")
        self.default_project_data["sectors"] = self.sectors[0].key

        response = self.client.post(self.url, self.default_project_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            1,
        )

    @tag("sectors", "projects")
    def test_post_project_with_two_sector_list(self):
        self.client.login(username="testuser", password="testpassword")
        self.default_project_data["sectors"] = [
            self.sectors[0].key,
            self.sectors[1].key,
        ]

        response = self.client.post(self.url, self.default_project_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            2,
        )

    @tag("sectors", "projects")
    def test_post_project_with_two_sector_comma_seperated(self):
        self.client.login(username="testuser", password="testpassword")
        self.default_project_data[
            "sectors"
        ] = f"{self.sectors[0].key},{self.sectors[1].key}"

        response = self.client.post(self.url, self.default_project_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            2,
        )

    @tag("sectors", "projects")
    def test_post_project_with_two_sector_dublicated(self):
        self.client.login(username="testuser", password="testpassword")
        self.default_project_data[
            "sectors"
        ] = f"{self.sectors[0].key},{self.sectors[0].key}"

        response = self.client.post(self.url, self.default_project_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            1,
        )

    @tag("sectors", "projects")
    def test_post_project_with_sectors_will_keep_the_correct_ordering(self):
        self.client.login(username="testuser", password="testpassword")
        self.default_project_data["sectors"] = ",".join([s.key for s in self.sectors])

        response = self.client.post(self.url, self.default_project_data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mappings = ProjectSectorMapping.objects.filter(
            project__url_slug=self.default_project_data["url_slug"]
        )
        self.assertEqual(len(self.sectors), mappings.count())
        n = len(self.sectors)
        for i, mapping in enumerate(mappings):
            expected_order = n - i
            self.assertEqual(expected_order, mapping.order)


class TestProjectApi(APITestCase):
    def setUp(self):
        self.url_slug = "test-project"
        self.url = reverse(
            "organization:project-api-view", kwargs={"url_slug": "test-project"}
        )
        self.edit_view_url = self.url + "?" + "edit_view"

        self.projectStatus_active = ProjectStatus.objects.create(
            name="active",
            name_de_translation="aktiv",
            has_end_date=False,
            has_start_date=False,
        )
        self.default_language = Language.objects.get(language_code="en")

        self.project = Project.objects.create(
            name="Test Project",
            description="Test Project Description",
            url_slug=self.url_slug,
            is_active=True,
            status=self.projectStatus_active,
            language=self.default_language,
        )
        self.decoy_project = Project.objects.create(
            name="decoy",
            description="decoy desc",
            url_slug="decoy",
            is_active=True,
            status=self.projectStatus_active,
        )

        self.user = User.objects.create_user(
            username="testuser",
            password="testpassword",
        )

        self.role = Role.objects.create(
            name="Admin",
            role_type=Role.ALL_TYPE,
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role=self.role,
        )
        ProjectParents.objects.create(
            project=self.project,
            parent_user=self.user,
        )

    def _login(self):
        self.client.login(username="testuser", password="testpassword")

    def _create_organization(self, suffix):
        return Organization.objects.create(
            name=f"{suffix} Organization",
            url_slug=f"{suffix}-organization",
            language=self.default_language,
        )

    def _set_parent_organization(self, organization):
        project_parents = self.project.project_parent.get()
        project_parents.parent_organization = organization
        project_parents.save()
        return project_parents

    @tag("projects")
    def test_get_project_by_url_slug(self):
        response = self.client.get(self.url)
        res = response.json()

        self.assertIsNotNone(res)
        self.assertContains(response, "Test Project")
        self.assertNotContains(response, "decoy")

    @tag("projects", "location")
    def test_get_project_by_url_slug_returns_translated_location_name(self):
        location = Location.objects.create(
            name="Munich",
            city="Munich",
            country="Germany",
        )
        LocationTranslation.objects.create(
            location=location,
            language=Language.objects.get(language_code="de"),
            name_translation="München",
        )
        self.project.loc = location
        self.project.save()

        response = self.client.get(self.url, HTTP_ACCEPT_LANGUAGE="de")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["location"], "München")

    @tag("projects", "location")
    def test_get_project_by_url_slug_falls_back_to_english_location_name(self):
        location = Location.objects.create(
            name="Cologne",
            city="Cologne",
            country="Germany",
        )
        self.project.loc = location
        self.project.save()

        response = self.client.get(self.url, HTTP_ACCEPT_LANGUAGE="de")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["location"], "Cologne")

    @tag("sectors", "projects")
    def test_get_project_by_url_slug_includes_sector(self):
        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )
        self.sector_decoy = Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="test_sector_decoy",
        )

        ProjectSectorMapping.objects.create(sector=self.sector, project=self.project)
        ProjectSectorMapping.objects.create(
            sector=self.sector_decoy, project=self.decoy_project
        )

        response = self.client.get(self.url)
        res = response.json()

        self.assertIsNotNone(res)
        self.assertContains(response, "Test Project")
        self.assertContains(response, "Test Sector")
        self.assertNotContains(response, "decoy")

    @tag("sectors", "projects")
    def test_get_project_edit_view_by_url_slug_includes_sector(self):
        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )
        self.sector_decoy = Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="test_sector_decoy",
        )

        ProjectSectorMapping.objects.create(sector=self.sector, project=self.project)
        ProjectSectorMapping.objects.create(
            sector=self.sector_decoy, project=self.decoy_project
        )

        response = self.client.get(self.edit_view_url)
        res = response.json()

        self.assertIsNotNone(res)
        self.assertContains(response, "Test Project")
        self.assertContains(response, "Test Sector")
        self.assertNotContains(response, "decoy")

    @tag("sectors", "projects")
    def test_get_project_by_url_slug_includes_sector_correctly_sorted(self):
        N = 4
        self.sectors = [
            Sector.objects.create(
                name=f"Test Sector{i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(N)
        ]
        ordering = {self.sectors[i].key: i + 1 for i in range(N)}

        for sector in self.sectors:
            ProjectSectorMapping.objects.create(
                sector=sector, project=self.project, order=ordering[sector.key]
            )

        response = self.client.get(self.url)
        res_view = response.json().get("sectors", None)

        response_edit = self.client.get(self.edit_view_url)
        res_edit = response_edit.json().get("sectors", None)

        for res in [res_view, res_edit]:
            self.assertIsNotNone(res)
            for item in res:
                sector = item.get("sector", None)
                order = item.get("order", None)

                self.assertIsNotNone(sector)
                self.assertIsNotNone(order)

                key = sector["key"]
                order = int(order)
                expected_order = ordering[key]

                self.assertIsNotNone(expected_order)
                self.assertEqual(order, expected_order)

    @tag("sectors", "projects")
    def test_patch_project_adding_first_sector(self):
        self._login()

        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )

        data = {"sectors": [self.sector.key]}

        self.client.patch(self.url, data, format="json")
        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            1,
        )
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug, sector__key=self.sector.key
            ).count(),
            1,
        )

    @tag("sectors", "projects")
    def test_patch_project_adding_another_sectors(self):
        self._login()

        self.sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(2)
        ]
        ProjectSectorMapping.objects.create(
            sector=self.sectors[0], project=self.project
        )

        data = {"sectors": [self.sectors[0].key, self.sectors[1].key]}

        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            2,
        )
        for sector in self.sectors:
            self.assertEqual(
                ProjectSectorMapping.objects.filter(
                    project__url_slug=self.project.url_slug, sector__key=sector.key
                ).count(),
                1,
            )

    @tag("sectors", "projects")
    def test_patch_project_adding_multiple_sectors(self):
        self._login()

        self.other_project = Project.objects.create(
            name="Other Project",
            description="Other Project Description",
            url_slug="other-project",
            is_active=True,
            status=self.projectStatus_active,
            language=self.default_language,
        )
        self.other_url = self.url.replace(
            self.project.url_slug, self.other_project.url_slug
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.other_project,
            role=self.role,
        )

        self.sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(4)
        ]
        ProjectSectorMapping.objects.create(
            sector=self.sectors[0], project=self.other_project
        )
        ProjectSectorMapping.objects.create(
            sector=self.sectors[3], project=self.decoy_project
        )

        data = {
            "sectors": [
                self.sectors[0].key,
                self.sectors[1].key,
                self.sectors[2].key,
            ],
        }
        data_other = {
            "sectors": [
                self.sectors[0].key,
                self.sectors[1].key,
                self.sectors[3].key,
            ],
        }

        response = self.client.patch(self.url, data, format="json")
        response_other = self.client.patch(self.other_url, data_other, format="json")

        self.assertContains(response, "successfully updated")
        self.assertContains(response_other, "successfully updated")

        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            3,
        )
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.other_project.url_slug
            ).count(),
            3,
        )

        for sector in self.sectors[:3]:
            self.assertEqual(
                ProjectSectorMapping.objects.filter(
                    project__url_slug=self.project.url_slug, sector__key=sector.key
                ).count(),
                1,
            )

        for sector in [self.sectors[0], self.sectors[1], self.sectors[3]]:
            self.assertEqual(
                ProjectSectorMapping.objects.filter(
                    project__url_slug=self.other_project.url_slug,
                    sector__key=sector.key,
                ).count(),
                1,
            )

    @tag("sectors", "projects")
    def test_patch_project_removing_sector(self):
        self._login()
        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )
        ProjectSectorMapping.objects.create(sector=self.sector, project=self.project)
        data = {"sectors": []}

        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            0,
        )

    @tag("sectors", "projects")
    def test_patch_project_ordering_of_sectors_correctly_assigned(self):
        self._login()

        self.sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(4)
        ]
        ProjectSectorMapping.objects.create(
            sector=self.sectors[0], project=self.project, order=1
        )

        data = {
            "sectors": [self.sectors[3].key, self.sectors[2].key, self.sectors[1].key]
        }

        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            3,
        )

        for i, sector in enumerate(self.sectors[1:]):
            mappings = ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug, sector__key=sector.key
            )
            self.assertEqual(mappings.count(), 1)
            mapping = mappings[0]
            self.assertEqual(mapping.order, i + 1)

    @tag("sectors", "projects")
    def test_patch_project_reordering_of_sectors(self):
        self._login()

        N = 4
        self.sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(N)
        ]

        for i, sector in enumerate(self.sectors):
            ProjectSectorMapping.objects.create(
                sector=sector, project=self.project, order=i
            )

        data = {
            "sectors": [self.sectors[N - i - 1].key for i in range(N)]
            + [s.key for s in self.sectors],
        }

        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            N,
        )

        for i, sector in enumerate(self.sectors):
            mapping = ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug, sector__key=sector.key
            ).first()
            self.assertEqual(mapping.order, i + 1)

    @tag("sectors", "projects")
    def test_delete_project_sector(self):
        self._login()
        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )
        ProjectSectorMapping.objects.create(sector=self.sector, project=self.project)
        data = {"sectors": []}

        response = self.client.delete(self.url, data, format="json")

        self.assertContains(response, "successfully deleted")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            0,
        )

    @tag("projects")
    def test_get_project_includes_is_online_field(self):
        response = self.client.get(self.url)
        res = response.json()

        self.assertIn("is_online", res)

    @tag("projects")
    def test_get_project_is_online_defaults_to_false(self):
        response = self.client.get(self.url)
        res = response.json()

        self.assertFalse(res["is_online"])

    @tag("projects")
    def test_get_project_is_online_true_when_set(self):
        self.project.is_online = True
        self.project.save()

        response = self.client.get(self.url)
        res = response.json()

        self.assertTrue(res["is_online"])

    @tag("projects")
    def test_patch_project_set_is_online_to_true(self):
        self._login()
        data = {"is_online": True}

        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.project.refresh_from_db()
        self.assertTrue(self.project.is_online)

    @tag("projects")
    def test_patch_project_set_is_online_to_false(self):
        self.project.is_online = True
        self.project.save()
        self._login()
        data = {"is_online": False}

        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.project.refresh_from_db()
        self.assertFalse(self.project.is_online)

    @tag("projects")
    def test_patch_project_without_is_online_does_not_change_default(self):
        self._login()
        data = {"website": "https://example.com"}

        response = self.client.patch(self.url, data, format="json")

        self.assertContains(response, "successfully updated")
        self.project.refresh_from_db()
        self.assertFalse(self.project.is_online)

    @tag("projects")
    def test_get_project_edit_view_includes_is_online_field(self):
        response = self.client.get(self.edit_view_url)
        res = response.json()

        self.assertIn("is_online", res)

    @tag("projects")
    def test_patch_project_keeps_organization_owner_when_is_personal_project_flag_is_stale(self):
        self._login()
        organization = self._create_organization("owner-stale-flag")
        project_parents = self._set_parent_organization(organization)

        response = self.client.patch(
            self.url,
            {"name": "Updated Project Name", "is_personal_project": True},
            format="json",
        )

        self.assertContains(response, "successfully updated")
        project_parents.refresh_from_db()
        self.assertEqual(project_parents.parent_organization, organization)
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "Updated Project Name")

    @tag("projects")
    def test_patch_project_explicitly_clears_parent_organization(self):
        self._login()
        organization = self._create_organization("owner-clear")
        project_parents = self._set_parent_organization(organization)

        response = self.client.patch(
            self.url,
            {"parent_organization": None},
            format="json",
        )

        self.assertContains(response, "successfully updated")
        project_parents.refresh_from_db()
        self.assertIsNone(project_parents.parent_organization)

    @tag("projects")
    def test_patch_project_rejects_invalid_parent_organization_id(self):
        self._login()
        project_parents = self._set_parent_organization(
            self._create_organization("existing-invalid-id")
        )

        response = self.client.patch(
            self.url,
            {"parent_organization": 999999},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent_organization", response.json())
        project_parents.refresh_from_db()
        self.assertIsNotNone(project_parents.parent_organization)

    @tag("projects")
    def test_patch_project_updates_parent_organization_with_valid_id(self):
        self._login()
        original_organization = self._create_organization("owner-original")
        replacement_organization = self._create_organization("owner-replacement")
        project_parents = self._set_parent_organization(original_organization)

        response = self.client.patch(
            self.url,
            {"parent_organization": replacement_organization.id},
            format="json",
        )

        self.assertContains(response, "successfully updated")
        project_parents.refresh_from_db()
        self.assertEqual(project_parents.parent_organization, replacement_organization)

import io
import unittest
from base64 import b64encode
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.test import TestCase, tag
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language, Role
from hubs.models.hub import Hub
from location.models import Location, LocationTranslation
from organization.models import (
    Project,
    ProjectMember,
    ProjectSectorMapping,
    ProjectStatus,
    Sector,
)

# set this at lowest to 4
INITIAL_PROJECT_COUNT = 4


class TestProjectsListView(APITestCase):
    # -----------------------------------------------------
    # setUp code for each test
    def setUp(self):
        self.url = reverse("organization:list-projects")

        projectStatus_active = ProjectStatus.objects.create(
            name="active",
            name_de_translation="aktiv",
            has_end_date=False,
            has_start_date=False,
        )

        self.projects = [
            Project.objects.create(
                name=f"Test Project {i}",
                description=f"Test Project {i} Description",
                url_slug=f"test-project-{i}",
                is_active=True,
                status=projectStatus_active,
            )
            for i in range(1, INITIAL_PROJECT_COUNT + 1)
        ]

    # -----------------------------------------------------
    # Tests for the ProjectsList API

    @tag("projects")
    def test_get_projects_list_url_resolves_corretly(self):
        self.assertEqual(self.url, "/api/projects/")

    @tag("projects")
    def test_get_projects_list_url_reachable(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/json")

    @tag("projects")
    def test_get_projects_lists_content(self):
        # arrange

        # act
        response = self.client.get(self.url)
        results = response.json().get("results", None)

        for i in range(1, INITIAL_PROJECT_COUNT + 1):
            self.assertContains(response, f"Test Project {i}")

        # assert
        self.assertIsNotNone(results)
        self.assertEqual(len(results), INITIAL_PROJECT_COUNT)

    @tag("sectors", "projects")
    def test_get_projects_lists_content_filtered_by_a_single_sector(self):
        # arranging
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

        projects = self.projects

        # testing size >1, =1 and =0 for the result length
        ProjectSectorMapping.objects.create(sector=sectors[0], project=projects[0])
        ProjectSectorMapping.objects.create(sector=sectors[0], project=projects[1])
        ProjectSectorMapping.objects.create(sector=sectors[1], project=projects[2])
        # sector 3 will not be connected to any project

        # act
        response_1 = self.client.get(self.url + "?sectors=" + sectors[0].name)
        response_2 = self.client.get(self.url + "?sectors=" + sectors[1].name)
        response_3 = self.client.get(self.url + "?sectors=" + sectors[2].name)

        results_1 = response_1.json().get("results", None)
        results_2 = response_2.json().get("results", None)
        results_3 = response_3.json().get("results", None)

        # assert
        self.assertIsNotNone(results_1)
        self.assertEqual(len(results_1), 2)
        self.assertContains(response_1, f"Test Project {1}")
        self.assertContains(response_1, f"Test Project {2}")

        self.assertIsNotNone(results_2)
        self.assertEqual(len(results_2), 1)
        self.assertContains(response_2, f"Test Project {3}")

        self.assertIsNotNone(results_3)
        self.assertEqual(len(results_3), 0)

    @tag("sectors", "projects")
    def test_get_projects_lists_content_filtered_by_two_sectors(self):
        # arranging
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

        projects = self.projects

        ProjectSectorMapping.objects.create(sector=sectors[0], project=projects[0])
        ProjectSectorMapping.objects.create(sector=sectors[0], project=projects[1])
        ProjectSectorMapping.objects.create(sector=sectors[1], project=projects[2])

        testcases = [
            {
                "url": "sectors={},{}".format(sectors[0].name, sectors[1].name),
                "expected": [
                    projects[0].url_slug,
                    projects[1].url_slug,
                    projects[2].url_slug,
                ],
            },
            {
                "url": "sectors={},{}".format(sectors[0].name, sectors[2].name),
                "expected": [
                    projects[0].url_slug,
                    projects[1].url_slug,
                ],
            },
            {
                "url": "sectors={},{}".format(sectors[1].name, sectors[2].name),
                "expected": [
                    projects[2].url_slug,
                ],
            },
        ]

        # act
        responses = [
            self.client.get(self.url + "?" + testcase["url"]) for testcase in testcases
        ]

        # assert
        for i, response in enumerate(responses):
            results = response.json().get("results", None)

            self.assertIsNotNone(results)
            self.assertEqual(len(results), len(testcases[i]["expected"]))

            for project_slug in testcases[i]["expected"]:
                self.assertContains(response, project_slug)

    @tag("sectors", "projects")
    def test_get_projects_lists_content_filtered_by_sector_hub(self):
        # arrange
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

        projects = self.projects
        ## mapping projects to sectors
        ## testing number of projects per sector: 2, 1 and 0 (testing a loop)
        ProjectSectorMapping.objects.create(sector=sectors[0], project=projects[0])
        ProjectSectorMapping.objects.create(sector=sectors[0], project=projects[1])
        ProjectSectorMapping.objects.create(sector=sectors[1], project=projects[2])

        # linking sectors to sector hubs, to query projects by sector hubs
        self.sector_hubs = [
            Hub.objects.create(
                name="Test sector Hub {}".format(i),
                url_slug="test-hub-{}".format(i),
                hub_type=Hub.SECTOR_HUB_TYPE,
            )
            for i in range(3)
        ]
        for i in range(3):
            self.sector_hubs[i].sectors.add(sectors[i])

        self.decoy_hub = Hub.objects.create(
            name="Decoy Hub",
            url_slug="decoy-hub",
            hub_type=Hub.LOCATION_HUB_TYPE,
        )

        testcases = [
            # test query by a single sector hub
            {
                "url": "hub={}".format(self.sector_hubs[0].url_slug),
                "expected": [
                    projects[0].url_slug,
                    projects[1].url_slug,
                ],
            },
            {
                "url": "hub={}".format(self.sector_hubs[1].url_slug),
                "expected": [
                    projects[2].url_slug,
                ],
            },
            {
                "url": "hub={}".format(self.sector_hubs[2].url_slug),
                "expected": [],
            },
            {
                "url": "hub={}".format(self.decoy_hub.url_slug),
                "expected": [],
            },
        ]

        # act
        responses = [
            self.client.get(self.url + "?" + testcases[i]["url"]) for i in range(3)
        ]

        # assert
        for i, response in enumerate(responses):
            results = response.json().get("results", None)

            self.assertIsNotNone(results)
            self.assertEqual(len(results), len(testcases[i]["expected"]))

            for project_slug in testcases[i]["expected"]:
                self.assertContains(response, project_slug)
        pass

    @tag("sectors", "projects")
    def test_get_project_sector_ordering(self):
        # arrange
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

        projects = self.projects
        ## mapping projects to sectors
        ## Setup orderings for sector 0
        ordering_0 = [
            (0, 1),
            (1, 2),
            (2, 3),
        ]
        for x, y in ordering_0:
            ProjectSectorMapping.objects.create(
                project=projects[0], sector=sectors[x], order=y
            )

        ## Setup orderings for sector 1
        ordering_1 = [
            (2, 1),
            (1, 2),
            (0, 3),
        ]
        for x, y in ordering_1:
            ProjectSectorMapping.objects.create(
                project=projects[1], sector=sectors[x], order=y
            )

        # act
        response = self.client.get(self.url + "?sectors=" + sectors[0].name)
        result = response.json().get("results", None)
        self.assertIsNotNone(result)

        project_0 = None
        project_1 = None

        for _project in result:
            if _project["url_slug"] == self.projects[0].url_slug:
                project_0 = _project
            if _project["url_slug"] == self.projects[1].url_slug:
                project_1 = _project

        # assert
        self.assertIsNotNone(project_0)
        self.assertIsNotNone(project_1)

        sectors_0 = project_0.get("sectors", None)
        sectors_1 = project_1.get("sectors", None)

        self.assertIsNotNone(sectors_0)
        self.assertIsNotNone(sectors_1)

        self.assertEqual(len(sectors_0), 3)
        self.assertEqual(len(sectors_1), 3)

        for i, (x, y) in enumerate(ordering_0):
            self.assertEqual(
                sectors_0[i]["sector"]["key"],
                sectors[x].key,
            )
            self.assertEqual(sectors_0[i]["order"], y)

        for i, (x, y) in enumerate(ordering_1):
            self.assertEqual(sectors_1[i]["sector"]["key"], sectors[x].key)
            self.assertEqual(sectors_1[i]["order"], y)


@unittest.skip("Temporarily disabled: see CI failure #57660401767")
class TestCreateProjectsViews(APITestCase):
    # -----------------------------------------------------
    # setUp code for each test
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

        # Get the language that was created globally
        self.default_language = Language.objects.get(language_code="en")

        self.default_location_data = {
            "place_id": 1,
            "country": "Germany",
            "name": "Test Location",
            "type": "type",
            "lon": 13.4050,
            "lat": 52.5200,
        }
        # create a dummy black image
        image = Image.new("RGB", (10, 10), "black")
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        self.image = "data:image/png;base64," + b64encode(buffered.getvalue()).decode(
            "utf-8"
        )

        # TODO: broooooo, why -__-
        # we need to change the api asap to just accept the 'project_type'
        # and not the whole object ...
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
            "sectors": [],
            "loc": self.default_location_data,
            "image": self.image,
            "source_language": self.default_language.language_code,
            "translations": {},
            "project_type": self.default_project_type_data,
            "hubName": "null",
        }

        # creating dummy sectors

        self.sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

    def test_post_project_declines_if_not_authenticated(self):
        # arrange

        # act
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @tag("projects")
    def test_post_project_without_sector(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        # act
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            0,
        )
        pass

    @tag("sectors", "projects")
    def test_post_project_with_one_sector_as_array(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        self.default_project_data["sectors"] = [self.sectors[0].key]

        # act
        self.client.login(username="testuser", password="testpassword")
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            1,
        )

        pass

    @tag("sectors", "projects")
    def test_post_project_with_one_sector_as_string(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")
        self.default_project_data["sectors"] = self.sectors[0].key

        # act
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            1,
        )

        pass

    @tag("sectors", "projects")
    def test_post_project_with_two_sector_list(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        self.default_project_data["sectors"] = [
            self.sectors[0].key,
            self.sectors[1].key,
        ]

        # act
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            2,
        )

        pass

    @tag("sectors", "projects")
    def test_post_project_with_two_sector_comma_seperated(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        self.default_project_data[
            "sectors"
        ] = f"{self.sectors[0].key},{self.sectors[1].key}"

        # act
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            2,
        )

        pass

    @tag("sectors", "projects")
    def test_post_project_with_two_sector_dublicated(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        self.default_project_data[
            "sectors"
        ] = f"{self.sectors[0].key},{self.sectors[0].key}"

        # act
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.default_project_data["url_slug"]
            ).count(),
            1,
        )

        pass

    @tag("sectors", "projects")
    def test_post_project_with_sectors_will_keep_the_correct_ordering(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        self.default_project_data["sectors"] = ",".join([s.key for s in self.sectors])

        # act
        response = self.client.post(self.url, self.default_project_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mappings = ProjectSectorMapping.objects.filter(
            project__url_slug=self.default_project_data["url_slug"]
        )
        self.assertEqual(len(self.sectors), mappings.count())
        n = len(self.sectors)
        for i, mapping in enumerate(mappings):
            expected_order = n - i
            self.assertEqual(expected_order, mapping.order)
        pass


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

        # Get the language that was created globally
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

    @tag("projects")
    def test_get_project_by_url_slug(self):
        # arrange

        # act
        response = self.client.get(self.url)
        res = response.json()

        # assert
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
        # arrange
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

        # act
        response = self.client.get(self.url)
        res = response.json()

        # assert
        self.assertIsNotNone(res)
        self.assertContains(response, "Test Project")
        self.assertContains(response, "Test Sector")
        self.assertNotContains(response, "decoy")

    @tag("sectors", "projects")
    def test_get_project_edit_view_by_url_slug_includes_sector(self):
        # arrange
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

        # act
        response = self.client.get(self.edit_view_url)
        res = response.json()

        # assert
        self.assertIsNotNone(res)
        self.assertContains(response, "Test Project")
        self.assertContains(response, "Test Sector")
        self.assertNotContains(response, "decoy")

    @tag("sectors", "projects")
    def test_get_project_by_url_slug_includes_sector_correctly_sorted(self):
        # arrange
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

        # act
        response = self.client.get(self.url)
        res_view = response.json().get("sectors", None)

        response_edit = self.client.get(self.edit_view_url)
        res_edit = response_edit.json().get("sectors", None)

        # assert
        ## perform it for both results, as the ordering should be the same on both views
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
        # arrange
        self.client.login(username="testuser", password="testpassword")

        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )

        data = {
            "sectors": [self.sector.key],
        }

        # act
        self.client.patch(self.url, data, format="json")
        response = self.client.patch(self.url, data, format="json")

        # assert
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
        # arrange
        self.client.login(username="testuser", password="testpassword")

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

        data = {
            "sectors": [self.sectors[0].key, self.sectors[1].key],
        }

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert
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
        # arrange
        self.client.login(username="testuser", password="testpassword")

        ## set up another project with the same user as an admin
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

        # act
        response = self.client.patch(self.url, data, format="json")
        response_other = self.client.patch(self.other_url, data_other, format="json")

        # assert
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
        # arrange
        self.client.login(username="testuser", password="testpassword")

        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )
        ProjectSectorMapping.objects.create(sector=self.sector, project=self.project)

        data = {
            "sectors": [],
        }

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            0,
        )

    @tag("sectors", "projects")
    def test_patch_project_ordering_of_sectors_correctly_assigned(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

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

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert
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
        # arrange
        self.client.login(username="testuser", password="testpassword")

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

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert
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
        # arrange
        self.client.login(username="testuser", password="testpassword")
        self.sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sector DE",
            key="test_sector",
        )
        ProjectSectorMapping.objects.create(sector=self.sector, project=self.project)
        data = {
            "sectors": [],
        }

        # act
        response = self.client.delete(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully deleted")
        self.assertEqual(
            ProjectSectorMapping.objects.filter(
                project__url_slug=self.project.url_slug
            ).count(),
            0,
        )

    # -------------------------------------------------------
    # Tests for the is_online field

    @tag("projects")
    def test_get_project_includes_is_online_field(self):
        # act
        response = self.client.get(self.url)
        res = response.json()

        # assert
        self.assertIn("is_online", res)

    @tag("projects")
    def test_get_project_is_online_defaults_to_false(self):
        # act
        response = self.client.get(self.url)
        res = response.json()

        # assert
        self.assertFalse(res["is_online"])

    @tag("projects")
    def test_get_project_is_online_true_when_set(self):
        # arrange
        self.project.is_online = True
        self.project.save()

        # act
        response = self.client.get(self.url)
        res = response.json()

        # assert
        self.assertTrue(res["is_online"])

    @tag("projects")
    def test_patch_project_set_is_online_to_true(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")
        data = {"is_online": True}

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.project.refresh_from_db()
        self.assertTrue(self.project.is_online)

    @tag("projects")
    def test_patch_project_set_is_online_to_false(self):
        # arrange
        self.project.is_online = True
        self.project.save()
        self.client.login(username="testuser", password="testpassword")
        data = {"is_online": False}

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.project.refresh_from_db()
        self.assertFalse(self.project.is_online)

    @tag("projects")
    def test_patch_project_without_is_online_does_not_change_default(self):
        # arrange — project starts with is_online=False (default)
        self.client.login(username="testuser", password="testpassword")
        data = {"website": "https://example.com"}

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.project.refresh_from_db()
        self.assertFalse(self.project.is_online)

    @tag("projects")
    def test_get_project_edit_view_includes_is_online_field(self):
        # act
        response = self.client.get(self.edit_view_url)
        res = response.json()

        # assert
        self.assertIn("is_online", res)


class ProjectLocationHubFilterTest(TestCase):
    """
    Test case for filtering projects by location hubs.
    Tests the code in project_views.py that handles filtering projects by location hubs
    with aggregated geometry.
    """

    def setUp(self):
        """
        Set up test data for each test method.
        Creates locations, hubs, and projects for testing.

        Test data structure:
        - 1 Hub "Erlangen" with 3 locations: Erlangen, Bubenreuth, Spardorf
        - 12 Projects total:
          - 3 with exact hub locations (Erlangen, Bubenreuth, Spardorf)
          - 3 with addresses in Erlangen, Bubenreuth, Spardorf
          - 1 inactive project (is_active=False)
          - 1 draft project (is_draft=True)
          - 2 in Nürnberg (location + address) - negative test cases
          - 2 in Paris (location + address) - negative test cases
        """
        self.url = reverse("organization:list-projects")

        # Create language (required for projects)
        self.language = Language.objects.get(language_code="en")

        # Create project status (required for projects)
        self.project_status = ProjectStatus.objects.create(
            name="active",
            name_de_translation="aktiv",
            has_end_date=False,
            has_start_date=False,
        )

        # ===== Hub Locations (3 locations for Erlangen Hub) =====
        # Erlangen city (general area)
        self.location_erlangen = Location.objects.create(
            name="Erlangen, Germany",
            city="Erlangen",
            country="Germany",
            centre_point=Point(11.0050, 49.5975),  # Erlangen coordinates
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (10.95, 49.55),
                        (11.06, 49.55),
                        (11.06, 49.64),
                        (10.95, 49.64),
                        (10.95, 49.55),
                    )
                )
            ),
        )

        # Bubenreuth (suburb/village north of Erlangen)
        self.location_bubenreuth = Location.objects.create(
            name="Bubenreuth, Germany",
            city="Bubenreuth",
            country="Germany",
            centre_point=Point(11.0200, 49.6300),  # Bubenreuth coordinates
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (11.00, 49.62),
                        (11.04, 49.62),
                        (11.04, 49.64),
                        (11.00, 49.64),
                        (11.00, 49.62),
                    )
                )
            ),
        )

        # Spardorf (suburb/village east of Erlangen)
        self.location_spardorf = Location.objects.create(
            name="Spardorf, Germany",
            city="Spardorf",
            country="Germany",
            centre_point=Point(11.0600, 49.5900),  # Spardorf coordinates
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (11.05, 49.58),
                        (11.07, 49.58),
                        (11.07, 49.60),
                        (11.05, 49.60),
                        (11.05, 49.58),
                    )
                )
            ),
        )

        # ===== Hub for Erlangen with 3 locations =====
        self.hub_erlangen = Hub.objects.create(
            name="Erlangen Hub",
            url_slug="erlangen-hub",
            hub_type=Hub.LOCATION_HUB_TYPE,
            image="/media/hub_images/default.jpg",
        )
        self.hub_erlangen.location.add(self.location_erlangen)
        self.hub_erlangen.location.add(self.location_bubenreuth)
        self.hub_erlangen.location.add(self.location_spardorf)

        # ===== Address Locations within hub area =====
        # Addresses within Erlangen, Bubenreuth, Spardorf
        self.location_erlangen_address = Location.objects.create(
            name="Goethestraße 1, Erlangen, Germany",
            city="Erlangen",
            country="Germany",
            centre_point=Point(11.0020, 49.5985),  # Address in Erlangen
            multi_polygon=None,
        )

        self.location_bubenreuth_address = Location.objects.create(
            name="Bussardstraße 21, Bubenreuth, Germany",
            city="Bubenreuth",
            country="Germany",
            centre_point=Point(11.0210, 49.6310),  # Address in Bubenreuth
            multi_polygon=None,
        )

        self.location_spardorf_address = Location.objects.create(
            name="Eisenstraße, Spardorf, Germany",
            city="Spardorf",
            country="Germany",
            centre_point=Point(11.0610, 49.5910),  # Address in Spardorf
            multi_polygon=None,
        )

        # ===== Negative Test Locations (Nuremberg & Paris) =====
        # Nuremberg city location
        self.location_nuremberg = Location.objects.create(
            name="Nuremberg, Germany",
            city="Nuremberg",
            country="Germany",
            centre_point=Point(11.0767, 49.4521),  # Nuremberg coordinates
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (10.95, 49.40),
                        (11.20, 49.40),
                        (11.20, 49.50),
                        (10.95, 49.50),
                        (10.95, 49.40),
                    )
                )
            ),
        )

        # Nuremberg address
        self.location_nuremberg_address = Location.objects.create(
            name="Narrenschiff, Plobenhofstraße 1-9, Nuremberg, Germany",
            city="Nuremberg",
            country="Germany",
            centre_point=Point(11.0780, 49.4530),  # Address in Nuremberg
            multi_polygon=None,
        )

        # Paris city location
        self.location_paris = Location.objects.create(
            name="Paris, France",
            city="Paris",
            country="France",
            centre_point=Point(2.3522, 48.8566),  # Paris coordinates
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (2.20, 48.80),
                        (2.50, 48.80),
                        (2.50, 49.00),
                        (2.20, 49.00),
                        (2.20, 48.80),
                    )
                )
            ),
        )

        # Paris address
        self.location_paris_address = Location.objects.create(
            name="Hotel de Ville, 5 Rue de Lobau, Paris, France",
            city="Paris",
            country="France",
            centre_point=Point(2.3530, 48.8570),  # Address in Paris
            multi_polygon=None,
        )

        # ===== Create 12 Projects =====
        # Projects with exact hub locations (3 projects)
        self.project_erlangen_location = Project.objects.create(
            name="Erlangen Location Project",
            description="Project with Erlangen location",
            short_description="Erlangen location",
            url_slug="erlangen-location-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_erlangen,
        )

        self.project_bubenreuth_location = Project.objects.create(
            name="Bubenreuth Location Project",
            description="Project with Bubenreuth location",
            short_description="Bubenreuth location",
            url_slug="bubenreuth-location-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_bubenreuth,
        )

        self.project_spardorf_location = Project.objects.create(
            name="Spardorf Location Project",
            description="Project with Spardorf location",
            short_description="Spardorf location",
            url_slug="spardorf-location-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_spardorf,
        )

        # Projects with addresses in hub locations (3 projects)
        self.project_erlangen_address = Project.objects.create(
            name="Erlangen Address Project",
            description="Project with address in Erlangen",
            short_description="Erlangen address",
            url_slug="erlangen-address-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_erlangen_address,
        )

        self.project_bubenreuth_address = Project.objects.create(
            name="Bubenreuth Address Project",
            description="Project with address in Bubenreuth",
            short_description="Bubenreuth address",
            url_slug="bubenreuth-address-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_bubenreuth_address,
        )

        self.project_spardorf_address = Project.objects.create(
            name="Spardorf Address Project",
            description="Project with address in Spardorf",
            short_description="Spardorf address",
            url_slug="spardorf-address-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_spardorf_address,
        )

        # Inactive project
        self.project_erlangen_inactive = Project.objects.create(
            name="Erlangen Inactive Project",
            description="Inactive project in Erlangen",
            short_description="Erlangen inactive",
            url_slug="erlangen-inactive-project",
            is_active=False,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_erlangen_address,
        )

        # Draft project
        self.project_erlangen_draft = Project.objects.create(
            name="Erlangen Draft Project",
            description="Draft project in Erlangen",
            short_description="Erlangen draft",
            url_slug="erlangen-draft-project",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.language,
            loc=self.location_erlangen_address,
        )

        # Negative test projects - Nuremberg
        self.project_nuremberg_location = Project.objects.create(
            name="Nuremberg Location Project",
            description="Project in Nuremberg location",
            short_description="Nuremberg location",
            url_slug="nuremberg-location-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_nuremberg,
        )

        self.project_nuremberg_address = Project.objects.create(
            name="Nuremberg Address Project",
            description="Project with address in Nuremberg",
            short_description="Nuremberg address",
            url_slug="nuremberg-address-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_nuremberg_address,
        )

        # Negative test projects - Paris
        self.project_paris_location = Project.objects.create(
            name="Paris Location Project",
            description="Project in Paris location",
            short_description="Paris location",
            url_slug="paris-location-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_paris,
        )

        self.project_paris_address = Project.objects.create(
            name="Paris Address Project",
            description="Project with address in Paris",
            short_description="Paris address",
            url_slug="paris-address-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            loc=self.location_paris_address,
        )

    @tag("location_hub", "projects")
    def test_filter_projects_by_multi_location_hub(self):
        """
        Test filtering projects by the Erlangen hub with 3 locations.
        Should return all 6 active, non-draft projects within Erlangen, Bubenreuth, and Spardorf.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        project_slugs = [p["url_slug"] for p in results]

        self.assertIn("erlangen-location-project", project_slugs)
        self.assertIn("bubenreuth-location-project", project_slugs)
        self.assertIn("spardorf-location-project", project_slugs)
        self.assertIn("erlangen-address-project", project_slugs)
        self.assertIn("bubenreuth-address-project", project_slugs)
        self.assertIn("spardorf-address-project", project_slugs)

        self.assertEqual(len(results), 6)

        self.assertNotIn("nuremberg-location-project", project_slugs)
        self.assertNotIn("nuremberg-address-project", project_slugs)
        self.assertNotIn("paris-location-project", project_slugs)
        self.assertNotIn("paris-address-project", project_slugs)

    @tag("location_hub", "projects")
    def test_aggregated_geometry_with_multiple_hub_locations(self):
        """
        Test the aggregated geometry functionality (Union of geometries).
        Verifies that projects within any of the 3 hub locations are returned.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        project_slugs = [p["url_slug"] for p in results]

        self.assertIn("erlangen-location-project", project_slugs)
        self.assertIn("bubenreuth-location-project", project_slugs)
        self.assertIn("spardorf-location-project", project_slugs)

        self.assertIn("erlangen-address-project", project_slugs)
        self.assertIn("bubenreuth-address-project", project_slugs)
        self.assertIn("spardorf-address-project", project_slugs)

    @tag("location_hub", "projects")
    def test_filter_projects_by_hub_filters_by_country(self):
        """
        Test that location hub filtering correctly filters by country first.
        Paris projects should not appear even though we have 12 total projects.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        for project in results:
            project_obj = Project.objects.get(url_slug=project["url_slug"])
            self.assertEqual(project_obj.loc.country, "Germany")

        project_slugs = [p["url_slug"] for p in results]
        self.assertNotIn("paris-location-project", project_slugs)
        self.assertNotIn("paris-address-project", project_slugs)

    @tag("location_hub", "projects")
    def test_filter_excludes_projects_outside_hub_geometry(self):
        """
        Test that projects outside the hub's geometry are excluded.
        Nuremberg projects should not be included even though they're in Germany.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        project_slugs = [p["url_slug"] for p in results]

        self.assertNotIn("nuremberg-location-project", project_slugs)
        self.assertNotIn("nuremberg-address-project", project_slugs)

        self.assertEqual(len(results), 6)

    @tag("location_hub", "projects")
    def test_filter_projects_by_nonexistent_hub(self):
        """
        Test filtering by a hub that doesn't exist.
        Should return no results.
        """
        response = self.client.get(self.url, {"hub": "nonexistent-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 0)

    @tag("location_hub", "projects")
    def test_filter_projects_without_hub_parameter(self):
        """
        Test that without hub parameter, all active, non-draft projects are returned.
        Should return 10 projects (12 total - 1 inactive - 1 draft).
        """
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        self.assertEqual(len(results), 10)

        project_slugs = [p["url_slug"] for p in results]
        self.assertNotIn("erlangen-inactive-project", project_slugs)
        self.assertNotIn("erlangen-draft-project", project_slugs)

    @tag("location_hub", "projects")
    def test_address_locations_within_hub_geometry(self):
        """
        Test that address-based locations (null multi_polygon) are correctly matched.
        All 3 address projects should be included as their centre_points are within
        the hub's aggregated geometry.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        project_slugs = [p["url_slug"] for p in results]

        self.assertIn("erlangen-address-project", project_slugs)
        self.assertIn("bubenreuth-address-project", project_slugs)
        self.assertIn("spardorf-address-project", project_slugs)

        for slug in [
            "erlangen-address-project",
            "bubenreuth-address-project",
            "spardorf-address-project",
        ]:
            project = Project.objects.get(url_slug=slug)
            self.assertIsNone(project.loc.multi_polygon)

    @tag("location_hub", "projects")
    def test_projects_annotated_with_distance(self):
        """
        Test that projects within a hub are annotated with distance.
        All 6 projects should be returned with distance annotation.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        self.assertEqual(len(results), 6)

        project_slugs = [p["url_slug"] for p in results]
        for expected_slug in [
            "erlangen-location-project",
            "bubenreuth-location-project",
            "spardorf-location-project",
            "erlangen-address-project",
            "bubenreuth-address-project",
            "spardorf-address-project",
        ]:
            self.assertIn(expected_slug, project_slugs)

    @tag("location_hub", "projects")
    def test_distinct_results_when_multiple_filters_match(self):
        """
        Test that results are distinct even when a project matches multiple filter criteria.
        Tests the .distinct() call in the code.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        project_ids = [p["id"] for p in results]
        self.assertEqual(
            len(project_ids),
            len(set(project_ids)),
            "Results should be distinct (no duplicates)",
        )

        self.assertEqual(len(project_ids), 6)

    @tag("location_hub", "projects")
    def test_location_hub_filter_with_draft_projects(self):
        """
        Test that draft projects are not included in location hub filtering.
        We have a draft project in Erlangen that should be excluded.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        project_slugs = [p["url_slug"] for p in results]
        self.assertNotIn("erlangen-draft-project", project_slugs)

        self.assertEqual(len(results), 6)

    @tag("location_hub", "projects")
    def test_location_hub_filter_with_inactive_projects(self):
        """
        Test that inactive projects are not included in location hub filtering.
        We have an inactive project in Erlangen that should be excluded.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        project_slugs = [p["url_slug"] for p in results]
        self.assertNotIn("erlangen-inactive-project", project_slugs)

        self.assertEqual(len(results), 6)


class SimilarProjectsHubFilterTest(APITestCase):
    """
    Test case for filtering similar projects by hub context.
    Verifies that the SimilarProjects endpoint respects the ?hub= query parameter.
    """

    def setUp(self):
        self.status, _ = ProjectStatus.objects.get_or_create(
            name="active",
            defaults={
                "name_de_translation": "aktiv",
                "has_end_date": False,
                "has_start_date": False,
            },
        )
        self.language = Language.objects.get(language_code="en")

        self.sector_a, _ = Sector.objects.get_or_create(
            key="test_sim_energy",
            defaults={"name": "Energy", "name_de_translation": "Energie"},
        )
        self.sector_b, _ = Sector.objects.get_or_create(
            key="test_sim_transport",
            defaults={"name": "Transport", "name_de_translation": "Verkehr"},
        )

        self.hub_energy, _ = Hub.objects.get_or_create(
            url_slug="test-sim-energy-hub",
            defaults={
                "name": "Energy Hub",
                "hub_type": Hub.SECTOR_HUB_TYPE,
            },
        )
        self.hub_energy.sectors.add(self.sector_a)

        self.hub_transport, _ = Hub.objects.get_or_create(
            url_slug="test-sim-transport-hub",
            defaults={
                "name": "Transport Hub",
                "hub_type": Hub.SECTOR_HUB_TYPE,
            },
        )
        self.hub_transport.sectors.add(self.sector_b)

        self.hub_custom, _ = Hub.objects.get_or_create(
            url_slug="test-sim-custom-hub",
            defaults={
                "name": "Custom Hub",
                "hub_type": Hub.CUSTOM_HUB_TYPE,
            },
        )

        self.project_source, _ = Project.objects.get_or_create(
            url_slug="test-sim-source-project",
            defaults={
                "name": "Source Project",
                "description": "Source",
                "is_active": True,
                "is_draft": False,
                "status": self.status,
                "language": self.language,
            },
        )

        self.project_energy, _ = Project.objects.get_or_create(
            url_slug="test-sim-energy-project",
            defaults={
                "name": "Energy Project",
                "description": "Energy",
                "is_active": True,
                "is_draft": False,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        ProjectSectorMapping.objects.get_or_create(
            project=self.project_energy, sector=self.sector_a
        )

        self.project_transport, _ = Project.objects.get_or_create(
            url_slug="test-sim-transport-project",
            defaults={
                "name": "Transport Project",
                "description": "Transport",
                "is_active": True,
                "is_draft": False,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        ProjectSectorMapping.objects.get_or_create(
            project=self.project_transport, sector=self.sector_b
        )

        self.project_custom, _ = Project.objects.get_or_create(
            url_slug="test-sim-custom-project",
            defaults={
                "name": "Custom Project",
                "description": "Custom",
                "is_active": True,
                "is_draft": False,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        self.project_custom.related_hubs.add(self.hub_custom)

        self.project_draft, _ = Project.objects.get_or_create(
            url_slug="test-sim-draft-project",
            defaults={
                "name": "Draft Project",
                "description": "Draft",
                "is_active": True,
                "is_draft": True,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        self.project_draft.related_hubs.add(self.hub_custom)

        self.project_inactive, _ = Project.objects.get_or_create(
            url_slug="test-sim-inactive-project",
            defaults={
                "name": "Inactive Project",
                "description": "Inactive",
                "is_active": False,
                "is_draft": False,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        self.project_inactive.related_hubs.add(self.hub_custom)

        self.all_candidate_slugs = [
            "test-sim-energy-project",
            "test-sim-transport-project",
            "test-sim-custom-project",
        ]

    def _url(self, slug="test-sim-source-project"):
        return reverse("organization:similar-projects", kwargs={"url_slug": slug})

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_no_hub_returns_all_candidates(self, mock_similar):
        mock_similar.return_value = self.all_candidate_slugs
        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        result_slugs = [p["url_slug"] for p in results]
        self.assertEqual(len(results), 3)
        for slug in self.all_candidate_slugs:
            self.assertIn(slug, result_slugs)

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_sector_hub_restricts_similarity_pool_to_hub(self, mock_similar):
        mock_similar.return_value = ["test-sim-energy-project"]
        response = self.client.get(self._url(), {"hub": "test-sim-energy-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        result_slugs = [p["url_slug"] for p in results]
        self.assertEqual(len(results), 1)
        self.assertIn("test-sim-energy-project", result_slugs)

        call_kwargs = mock_similar.call_args
        self.assertIn("target_projects", call_kwargs.kwargs)
        candidate_ids = list(
            call_kwargs.kwargs["target_projects"].values_list("url_slug", flat=True)
        )
        self.assertIn("test-sim-energy-project", candidate_ids)
        self.assertIn("test-sim-source-project", candidate_ids)
        self.assertNotIn("test-sim-transport-project", candidate_ids)

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_invalid_hub_returns_unfiltered(self, mock_similar):
        mock_similar.return_value = self.all_candidate_slugs
        response = self.client.get(self._url(), {"hub": "nonexistent-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 3)

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_custom_hub_restricts_similarity_pool_to_hub(self, mock_similar):
        mock_similar.return_value = ["test-sim-custom-project"]
        response = self.client.get(self._url(), {"hub": "test-sim-custom-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        result_slugs = [p["url_slug"] for p in results]
        self.assertEqual(len(results), 1)
        self.assertIn("test-sim-custom-project", result_slugs)

        call_kwargs = mock_similar.call_args
        candidate_ids = list(
            call_kwargs.kwargs["target_projects"].values_list("url_slug", flat=True)
        )
        self.assertIn("test-sim-custom-project", candidate_ids)
        self.assertNotIn("test-sim-energy-project", candidate_ids)
        self.assertNotIn("test-sim-transport-project", candidate_ids)

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_custom_hub_excludes_draft_and_inactive_from_pool(self, mock_similar):
        mock_similar.return_value = ["test-sim-custom-project"]
        response = self.client.get(self._url(), {"hub": "test-sim-custom-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        result_slugs = [p["url_slug"] for p in results]
        self.assertNotIn("test-sim-draft-project", result_slugs)
        self.assertNotIn("test-sim-inactive-project", result_slugs)

        call_kwargs = mock_similar.call_args
        candidate_ids = list(
            call_kwargs.kwargs["target_projects"].values_list("url_slug", flat=True)
        )
        self.assertNotIn("test-sim-draft-project", candidate_ids)
        self.assertNotIn("test-sim-inactive-project", candidate_ids)

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_sector_hub_returns_only_matching_sector_projects(self, mock_similar):
        mock_similar.return_value = ["test-sim-transport-project"]
        response = self.client.get(self._url(), {"hub": "test-sim-transport-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url_slug"], "test-sim-transport-project")

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_sub_hub_includes_parent_hub_projects(self, mock_similar):
        parent_hub, _ = Hub.objects.update_or_create(
            url_slug="test-sim-parent-hub",
            defaults={
                "name": "Parent Hub",
                "hub_type": Hub.CUSTOM_HUB_TYPE,
            },
        )
        child_hub, _ = Hub.objects.update_or_create(
            url_slug="test-sim-child-hub",
            defaults={
                "name": "Child Hub",
                "hub_type": Hub.CUSTOM_HUB_TYPE,
                "parent_hub": parent_hub,
            },
        )

        project_both, _ = Project.objects.get_or_create(
            url_slug="test-sim-both-hubs-project",
            defaults={
                "name": "Both Hubs Project",
                "description": "Both",
                "is_active": True,
                "is_draft": False,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        project_both.related_hubs.add(child_hub, parent_hub)

        project_parent_only, _ = Project.objects.get_or_create(
            url_slug="test-sim-parent-only-project",
            defaults={
                "name": "Parent Only Project",
                "description": "Parent Only",
                "is_active": True,
                "is_draft": False,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        project_parent_only.related_hubs.add(parent_hub)

        project_child_only, _ = Project.objects.get_or_create(
            url_slug="test-sim-child-only-project",
            defaults={
                "name": "Child Only Project",
                "description": "Child Only",
                "is_active": True,
                "is_draft": False,
                "rating": 80,
                "status": self.status,
                "language": self.language,
            },
        )
        project_child_only.related_hubs.add(child_hub)

        mock_similar.return_value = [
            "test-sim-both-hubs-project",
            "test-sim-parent-only-project",
            "test-sim-child-only-project",
        ]
        response = self.client.get(self._url(), {"hub": "test-sim-child-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertTrue(len(results) > 0)

        call_kwargs = mock_similar.call_args
        candidate_ids = list(
            call_kwargs.kwargs["target_projects"].values_list("url_slug", flat=True)
        )
        self.assertIn("test-sim-both-hubs-project", candidate_ids)
        self.assertNotIn("test-sim-parent-only-project", candidate_ids)
        self.assertNotIn("test-sim-child-only-project", candidate_ids)

    @tag("similar_projects", "projects")
    @patch("organization.views.project_views.get_similar_projects")
    def test_empty_candidates_with_hub_returns_empty(self, mock_similar):
        mock_similar.return_value = []
        response = self.client.get(self._url(), {"hub": "test-sim-energy-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 0)

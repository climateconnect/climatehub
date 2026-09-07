from unittest.mock import patch

from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.test import TestCase, tag
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language
from hubs.models.hub import Hub
from location.models import Location
from organization.models import Project, ProjectSectorMapping, ProjectStatus, Sector

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
        response = self.client.get(self.url)
        results = response.json().get("results", None)

        for i in range(1, INITIAL_PROJECT_COUNT + 1):
            self.assertContains(response, f"Test Project {i}")

        self.assertIsNotNone(results)
        self.assertEqual(len(results), INITIAL_PROJECT_COUNT)

    @tag("sectors", "projects")
    def test_get_projects_lists_content_filtered_by_a_single_sector(self):
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

        response_1 = self.client.get(self.url + "?sectors=" + sectors[0].name)
        response_2 = self.client.get(self.url + "?sectors=" + sectors[1].name)
        response_3 = self.client.get(self.url + "?sectors=" + sectors[2].name)

        results_1 = response_1.json().get("results", None)
        results_2 = response_2.json().get("results", None)
        results_3 = response_3.json().get("results", None)

        self.assertIsNotNone(results_1)
        self.assertEqual(len(results_1), 2)
        self.assertContains(response_1, "Test Project 1")
        self.assertContains(response_1, "Test Project 2")

        self.assertIsNotNone(results_2)
        self.assertEqual(len(results_2), 1)
        self.assertContains(response_2, "Test Project 3")

        self.assertIsNotNone(results_3)
        self.assertEqual(len(results_3), 0)

    @tag("sectors", "projects")
    def test_get_projects_lists_content_filtered_by_two_sectors(self):
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
                "expected": [projects[2].url_slug],
            },
        ]

        responses = [
            self.client.get(self.url + "?" + testcase["url"]) for testcase in testcases
        ]

        for i, response in enumerate(responses):
            results = response.json().get("results", None)

            self.assertIsNotNone(results)
            self.assertEqual(len(results), len(testcases[i]["expected"]))

            for project_slug in testcases[i]["expected"]:
                self.assertContains(response, project_slug)

    @tag("sectors", "projects")
    def test_get_projects_lists_content_filtered_by_sector_hub(self):
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
            {
                "url": "hub={}".format(self.sector_hubs[0].url_slug),
                "expected": [projects[0].url_slug, projects[1].url_slug],
            },
            {
                "url": "hub={}".format(self.sector_hubs[1].url_slug),
                "expected": [projects[2].url_slug],
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

        responses = [
            self.client.get(self.url + "?" + testcases[i]["url"]) for i in range(3)
        ]

        for i, response in enumerate(responses):
            results = response.json().get("results", None)

            self.assertIsNotNone(results)
            self.assertEqual(len(results), len(testcases[i]["expected"]))

            for project_slug in testcases[i]["expected"]:
                self.assertContains(response, project_slug)

    @tag("sectors", "projects")
    def test_get_project_sector_ordering(self):
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

        projects = self.projects
        ordering_0 = [(0, 1), (1, 2), (2, 3)]
        for x, y in ordering_0:
            ProjectSectorMapping.objects.create(
                project=projects[0], sector=sectors[x], order=y
            )

        ordering_1 = [(2, 1), (1, 2), (0, 3)]
        for x, y in ordering_1:
            ProjectSectorMapping.objects.create(
                project=projects[1], sector=sectors[x], order=y
            )

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

        self.assertIsNotNone(project_0)
        self.assertIsNotNone(project_1)

        sectors_0 = project_0.get("sectors", None)
        sectors_1 = project_1.get("sectors", None)

        self.assertIsNotNone(sectors_0)
        self.assertIsNotNone(sectors_1)

        self.assertEqual(len(sectors_0), 3)
        self.assertEqual(len(sectors_1), 3)

        for i, (x, y) in enumerate(ordering_0):
            self.assertEqual(sectors_0[i]["sector"]["key"], sectors[x].key)
            self.assertEqual(sectors_0[i]["order"], y)

        for i, (x, y) in enumerate(ordering_1):
            self.assertEqual(sectors_1[i]["sector"]["key"], sectors[x].key)
            self.assertEqual(sectors_1[i]["order"], y)


class ProjectLocationHubFilterTest(TestCase):
    """
    Test case for filtering projects by location hubs.
    Tests the code in project_views.py that handles filtering projects by location hubs
    with aggregated geometry.
    """

    def setUp(self):
        self.url = reverse("organization:list-projects")
        self.language = Language.objects.get(language_code="en")
        self.project_status = ProjectStatus.objects.create(
            name="active",
            name_de_translation="aktiv",
            has_end_date=False,
            has_start_date=False,
        )

        self.location_erlangen = Location.objects.create(
            name="Erlangen, Germany",
            city="Erlangen",
            country="Germany",
            centre_point=Point(11.0050, 49.5975),
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
        self.location_bubenreuth = Location.objects.create(
            name="Bubenreuth, Germany",
            city="Bubenreuth",
            country="Germany",
            centre_point=Point(11.0200, 49.6300),
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
        self.location_spardorf = Location.objects.create(
            name="Spardorf, Germany",
            city="Spardorf",
            country="Germany",
            centre_point=Point(11.0600, 49.5900),
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

        self.hub_erlangen = Hub.objects.create(
            name="Erlangen Hub",
            url_slug="erlangen-hub",
            hub_type=Hub.LOCATION_HUB_TYPE,
            image="/media/hub_images/default.jpg",
        )
        self.hub_erlangen.location.add(self.location_erlangen)
        self.hub_erlangen.location.add(self.location_bubenreuth)
        self.hub_erlangen.location.add(self.location_spardorf)

        self.location_erlangen_address = Location.objects.create(
            name="Goethestraße 1, Erlangen, Germany",
            city="Erlangen",
            country="Germany",
            centre_point=Point(11.0020, 49.5985),
            multi_polygon=None,
        )
        self.location_bubenreuth_address = Location.objects.create(
            name="Bussardstraße 21, Bubenreuth, Germany",
            city="Bubenreuth",
            country="Germany",
            centre_point=Point(11.0210, 49.6310),
            multi_polygon=None,
        )
        self.location_spardorf_address = Location.objects.create(
            name="Eisenstraße, Spardorf, Germany",
            city="Spardorf",
            country="Germany",
            centre_point=Point(11.0610, 49.5910),
            multi_polygon=None,
        )

        self.location_nuremberg = Location.objects.create(
            name="Nuremberg, Germany",
            city="Nuremberg",
            country="Germany",
            centre_point=Point(11.0767, 49.4521),
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
        self.location_nuremberg_address = Location.objects.create(
            name="Narrenschiff, Plobenhofstraße 1-9, Nuremberg, Germany",
            city="Nuremberg",
            country="Germany",
            centre_point=Point(11.0780, 49.4530),
            multi_polygon=None,
        )
        self.location_paris = Location.objects.create(
            name="Paris, France",
            city="Paris",
            country="France",
            centre_point=Point(2.3522, 48.8566),
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
        self.location_paris_address = Location.objects.create(
            name="Hotel de Ville, 5 Rue de Lobau, Paris, France",
            city="Paris",
            country="France",
            centre_point=Point(2.3530, 48.8570),
            multi_polygon=None,
        )

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
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        project_slugs = [p["url_slug"] for p in results]

        self.assertNotIn("nuremberg-location-project", project_slugs)
        self.assertNotIn("nuremberg-address-project", project_slugs)
        self.assertEqual(len(results), 6)

    @tag("location_hub", "projects")
    def test_filter_projects_by_nonexistent_hub(self):
        response = self.client.get(self.url, {"hub": "nonexistent-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 0)

    @tag("location_hub", "projects")
    def test_filter_projects_without_hub_parameter(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        self.assertEqual(len(results), 10)

        project_slugs = [p["url_slug"] for p in results]
        self.assertNotIn("erlangen-inactive-project", project_slugs)
        self.assertNotIn("erlangen-draft-project", project_slugs)

    @tag("location_hub", "projects")
    def test_address_locations_within_hub_geometry(self):
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
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        project_ids = [p["id"] for p in results]
        self.assertEqual(len(project_ids), len(set(project_ids)))
        self.assertEqual(len(project_ids), 6)

    @tag("location_hub", "projects")
    def test_location_hub_filter_with_draft_projects(self):
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        project_slugs = [p["url_slug"] for p in results]
        self.assertNotIn("erlangen-draft-project", project_slugs)
        self.assertEqual(len(results), 6)

    @tag("location_hub", "projects")
    def test_location_hub_filter_with_inactive_projects(self):
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

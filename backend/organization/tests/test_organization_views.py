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

from climateconnect_api.models import Language, Role, UserProfile
from hubs.models import Hub
from location.models import Location, LocationTranslation
from organization.models import (
    Organization,
    OrganizationMember,
    OrganizationSectorMapping,
    OrganizationTranslation,
    Sector,
)
from organization.utility.organization import create_organization_translation

NUMBER_OF_ORGANIZATIONS = 5


class TestListOrganizationsAPIView(APITestCase):
    def setUp(self):
        self.url = reverse("organization:list-organizations-api-view")
        self.organizations = [
            Organization.objects.create(
                name=f"Test Organization {i}",
                url_slug=f"test-organization-{i}",
            )
            for i in range(NUMBER_OF_ORGANIZATIONS)
        ]

    @tag("organizations")
    def test_get_organizations(self):
        # arrange

        # act
        response = self.client.get(self.url)
        res = response.json()

        data = res.get("results", [])

        # assert
        self.assertIsNotNone(res)
        self.assertEqual(len(data), NUMBER_OF_ORGANIZATIONS)

    @tag("organizations", "sectors")
    def test_get_organizations_filtered_by_sector(self):
        # arrange
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

        # testing >1, =1 and no sector
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[0],
            sector=sectors[0],
        )
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[1],
            sector=sectors[0],
        )
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[2],
            sector=sectors[1],
        )

        # act
        response_1 = self.client.get(self.url + "?sectors=" + sectors[0].key)
        response_2 = self.client.get(self.url + "?sectors=" + sectors[1].key)
        response_3 = self.client.get(self.url + "?sectors=" + sectors[2].key)

        results_1 = response_1.json().get("results", None)
        results_2 = response_2.json().get("results", None)
        results_3 = response_3.json().get("results", None)

        # assert
        self.assertIsNotNone(results_1)
        self.assertEqual(len(results_1), 2)
        self.assertContains(response_1, f"Test Organization {0}")
        self.assertContains(response_1, f"Test Organization {1}")

        self.assertIsNotNone(results_2)
        self.assertEqual(len(results_2), 1)
        self.assertContains(response_2, f"Test Organization {2}")

        self.assertIsNotNone(results_3)
        self.assertEqual(len(results_3), 0)

    @tag("organizations", "sectors")
    def test_get_organizations_filtered_by_two_sectors(self):
        # arrange
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(3)
        ]

        # testing >1, =1 and no sector
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[0],
            sector=sectors[0],
        )
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[1],
            sector=sectors[0],
        )
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[2],
            sector=sectors[1],
        )

        testcases = [
            {
                "url": "sectors={},{}".format(sectors[0].key, sectors[1].key),
                "expected": [
                    self.organizations[0].url_slug,
                    self.organizations[1].url_slug,
                    self.organizations[2].url_slug,
                ],
            },
            {
                "url": "sectors={},{}".format(sectors[0].key, sectors[2].key),
                "expected": [
                    self.organizations[0].url_slug,
                    self.organizations[1].url_slug,
                ],
            },
            {
                "url": "sectors={},{}".format(sectors[1].key, sectors[2].key),
                "expected": [
                    self.organizations[2].url_slug,
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

            for slugs in testcases[i]["expected"]:
                self.assertContains(response, slugs)

    @tag("organizations", "sectors")
    def test_get_organizations_with_correct_ordering(self):
        # arrange
        N = 4
        org = self.organizations[0]
        sectors = [
            Sector.objects.create(
                name=f"Test Sector Name {i}",
                name_de_translation=f"Test Sector Name {i} DE",
                key=f"test_sector_{i}",
            )
            for i in range(4)
        ]
        ordering = {sectors[i].key: i + 1 for i in range(N)}

        for sector in sectors:
            OrganizationSectorMapping.objects.create(
                sector=sector, organization=org, order=ordering[sector.key]
            )

        # act
        response = self.client.get(self.url)
        results = response.json().get("results", None)

        # assert
        self.assertIsNotNone(results)

        ## find the correct org that should be tested
        res_org = None
        for o in results:
            if "url_slug" in o and o["url_slug"] == org.url_slug:
                res_org = o

        self.assertIsNotNone(res_org)

        sectors = res_org.get("sectors", None)
        self.assertIsNotNone(sectors)

        for item in sectors:
            sector = item.get("sector", None)
            order = item.get("order", None)

            self.assertIsNotNone(sector)
            self.assertIsNotNone(order)

            key = sector["key"]
            order = int(order)
            expected_order = ordering[key]

            self.assertIsNotNone(expected_order)
            self.assertEqual(order, expected_order)

    @tag("organizations", "hubs", "sectors")
    def test_get_organizations_filtered_by_sector_hub(self):
        # arrange
        sector = Sector.objects.create(
            name="Test Sector Hub",
            name_de_translation="Test Sektor Hub DE",
            key="test_sector_hub",
        )

        hub = Hub.objects.create(
            name="Test Hub",
            url_slug="test-hub",
            hub_type=Hub.SECTOR_HUB_TYPE,
        )
        hub.sectors.add(sector)

        OrganizationSectorMapping.objects.create(
            organization=self.organizations[0], sector=sector
        )
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[1], sector=sector
        )
        OrganizationSectorMapping.objects.create(
            organization=self.organizations[2], sector=sector
        )

        # act
        response = self.client.get(self.url + "?hub={}".format(hub.url_slug))
        results = response.json().get("results", None)

        # assert
        self.assertIsNotNone(results)
        self.assertEqual(len(results), 3)
        for i, organization in enumerate(self.organizations):
            if i < 3:
                self.assertContains(response, organization.name)
                self.assertContains(response, organization.url_slug)
            else:
                self.assertNotContains(response, organization.name)
                self.assertNotContains(response, organization.url_slug)


@unittest.skip("Temporarily disabled: see CI failure #57660401767")
class TestCreateOrganizationView(APITestCase):
    def setUp(self):
        self.url_slug = "test-organization"
        self.url = reverse(
            "organization:create-organization-api-view",
        )

        self.user = User.objects.create_user(
            username="testuser",
            password="testpassword",
        )

        # Use German language created by test_runner
        self.default_language = Language.objects.get(language_code="de")

        Location.objects.create(
            name="Test Location", city="Berlin", country="Germany", place_id=1
        )

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

        self.deafault_organization = {
            "name": "Test Organization",
            "url_slug": self.url_slug,
            "team_members": [],
            "location": self.default_location_data,
            "image": self.image,
            "organization_tags": [],
            "sectors": "",
            "translations": {},
            "source_language": self.default_language.language_code,
            "short_description": "This is a test organization.",
        }

    @tag("organization")
    def test_post_organization_declines_if_not_authenticated(self):
        # arrange

        # act
        response = self.client.post(
            self.url, data=self.deafault_organization, format="json"
        )

        # assert
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @tag("organization")
    def test_post_organization_without_sector(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        # act
        response = self.client.post(self.url, self.deafault_organization, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"]
            ).count(),
            0,
        )

    @tag("organization", "sectors")
    def test_post_organization_with_sector_as_array(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sektor DE",
            key="test_sector",
        )

        # create a dummy sector
        Sector.objects.create(
            name="Dummy Sector",
            name_de_translation="Dummy Sektor DE",
            key="dummy_sector",
        )

        organization_data = self.deafault_organization
        organization_data["sectors"] = [sector.key]

        # act
        response = self.client.post(self.url, data=organization_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
            ).count(),
            1,
        )
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
                sector=sector,
            ).count(),
            1,
        )

    @tag("organization", "sectors")
    def test_post_organization_with_sector_as_string(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        sector = Sector.objects.create(
            name="Test Sector",
            name_de_translation="Test Sektor DE",
            key="test_sector",
        )

        # create a dummy sector
        Sector.objects.create(
            name="Dummy Sector",
            name_de_translation="Dummy Sektor DE",
            key="dummy_sector",
        )

        organization_data = self.deafault_organization
        organization_data["sectors"] = sector.key

        # act
        response = self.client.post(self.url, data=organization_data, format="json")

        # assert
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
            ).count(),
            1,
        )
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
                sector=sector,
            ).count(),
            1,
        )

    @tag("organization", "sectors")
    def test_post_organization_with_two_sectors_as_array(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        sectors = [
            Sector.objects.create(
                name="Test Sector {}".format(i),
                name_de_translation="Test Sektor DE {}".format(i),
                key="test_sector {}".format(i),
            )
            for i in range(2)
        ]

        # create a dummy sector
        Sector.objects.create(
            name="Dummy Sector",
            name_de_translation="Dummy Sektor DE",
            key="dummy_sector",
        )

        organization_data = self.deafault_organization
        organization_data["sectors"] = [s.key for s in sectors]

        # act
        self.client.post(self.url, data=organization_data, format="json")

        # assert
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
            ).count(),
            2,
        )
        for sector in sectors:
            self.assertEqual(
                OrganizationSectorMapping.objects.filter(
                    organization__url_slug=self.deafault_organization["url_slug"],
                    sector=sector,
                ).count(),
                1,
            )

    @tag("organization", "sectors")
    def test_post_organization_with_two_sectors_as_string(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        sectors = [
            Sector.objects.create(
                name="Test Sector {}".format(i),
                name_de_translation="Test Sektor DE {}".format(i),
                key="test_sector {}".format(i),
            )
            for i in range(2)
        ]

        # create a dummy sector
        Sector.objects.create(
            name="Dummy Sector",
            name_de_translation="Dummy Sektor DE",
            key="dummy_sector",
        )

        organization_data = self.deafault_organization
        organization_data["sectors"] = ",".join([s.key for s in sectors])

        # act
        self.client.post(self.url, data=organization_data, format="json")

        # assert
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
            ).count(),
            2,
        )
        for sector in sectors:
            self.assertEqual(
                OrganizationSectorMapping.objects.filter(
                    organization__url_slug=self.deafault_organization["url_slug"],
                    sector=sector,
                ).count(),
                1,
            )

    @tag("organization", "sectors")
    def test_post_organization_with_sectors_correctly_ordered(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        N = 4
        sectors = [
            Sector.objects.create(
                name="Test Sector {}".format(i),
                name_de_translation="Test Sektor DE {}".format(i),
                key="test_sector {}".format(i),
            )
            for i in range(N)
        ]

        organization_data = self.deafault_organization
        organization_data["sectors"] = [s.key for s in sectors]
        ordering = {s.key: len(sectors) - i for i, s in enumerate(sectors)}

        # act
        self.client.post(self.url, data=organization_data, format="json")

        # assert
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
            ).count(),
            N,
        )
        for sector in sectors:
            mapping = OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.deafault_organization["url_slug"],
                sector=sector,
            )
            self.assertEqual(mapping.count(), 1)
            self.assertEqual(mapping.first().order, ordering[sector.key])


class TestOrganizationAPIView(APITestCase):
    # test get & test get edit-view
    # test get & get edit-view (with sector [1, 2])
    # test patch sector ==> check mapping
    def setUp(self):
        self.url_slug = "test-organization"
        self.url = reverse(
            "organization:organization-api-view",
            kwargs={"url_slug": self.url_slug},
        )
        self.edit_view_url = self.url + "?" + "edit_view"

        self.user = User.objects.create_user(
            username="testuser",
            password="testpassword",
            id=1,
        )
        self.user_decoy = User.objects.create_user(
            username="decoy",
            password="decoy",
            id=2,
        )
        UserProfile.objects.create(user=self.user)
        UserProfile.objects.create(user=self.user_decoy)

        self.role = Role.objects.create(
            name="Admin",
            role_type=Role.ALL_TYPE,
        )

        # Use German language created by test_runner
        self.default_language = Language.objects.get(language_code="de")

        self.org = Organization.objects.create(
            name=f"Test Organization",
            url_slug=f"test-organization",
            language=self.default_language,
        )
        self.org_decoy = Organization.objects.create(
            name=f"Decoy Organization",
            url_slug=f"decoy-organization",
            language=self.default_language,
        )

        OrganizationMember.objects.create(
            user=self.user, organization=self.org, role=self.role
        )
        OrganizationMember.objects.create(
            user=self.user_decoy, organization=self.org_decoy, role=self.role
        )

    @tag("organiztaion")
    def test_get_organization_by_url_slug(self):
        # arrange

        # act
        response = self.client.get(self.url)
        res = response.json()

        # assert
        self.assertIsNotNone(res)
        self.assertContains(response, self.org.name)
        self.assertNotContains(response, self.org_decoy.name)
        pass

    @tag("organization", "location")
    def test_get_organization_by_url_slug_returns_translated_location_name(self):
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
        self.org.location = location
        self.org.save()

        response = self.client.get(self.url, HTTP_ACCEPT_LANGUAGE="de")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["location"], "München")

    @tag("organization", "translations")
    def test_get_organization_view_uses_request_language_translations(self):
        # arrange
        self.org.language = Language.objects.get(language_code="en")
        self.org.name = "Original Name"
        self.org.short_description = "Original short description"
        self.org.about = "Original about"
        self.org.get_involved = "Original get involved"
        self.org.save()

        OrganizationTranslation.objects.create(
            organization=self.org,
            language=Language.objects.get(language_code="de"),
            name_translation="Uebersetzter Name",
            short_description_translation="Uebersetzte Kurzbeschreibung",
            about_translation="Uebersetztes About",
            get_involved_translation="Uebersetztes Mitmachen",
        )

        # act
        response = self.client.get(self.url, HTTP_ACCEPT_LANGUAGE="de")
        data = response.json()

        # assert
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(data["name"], "Uebersetzter Name")
        self.assertEqual(data["short_description"], "Uebersetzte Kurzbeschreibung")
        self.assertEqual(data["about"], "Uebersetztes About")
        self.assertEqual(data["get_involved"], "Uebersetztes Mitmachen")

    @tag("organization", "translations")
    def test_get_organization_edit_view_uses_source_language_values(self):
        # arrange
        self.org.language = Language.objects.get(language_code="en")
        self.org.name = "Original Name"
        self.org.short_description = "Original short description"
        self.org.about = "Original about"
        self.org.get_involved = "Original get involved"
        self.org.save()

        OrganizationTranslation.objects.create(
            organization=self.org,
            language=Language.objects.get(language_code="de"),
            name_translation="Uebersetzter Name",
            short_description_translation="Uebersetzte Kurzbeschreibung",
            about_translation="Uebersetztes About",
            get_involved_translation="Uebersetztes Mitmachen",
        )

        # act
        response = self.client.get(self.edit_view_url, HTTP_ACCEPT_LANGUAGE="de")
        data = response.json()

        # assert
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(data["name"], "Original Name")
        self.assertEqual(data["short_description"], "Original short description")
        self.assertEqual(data["about"], "Original about")
        self.assertEqual(data["get_involved"], "Original get involved")

    @tag("organiztaion", "sectors")
    def test_get_organization_by_url_slug_includes_sectors(self):
        # arrange
        sector = Sector.objects.create(
            name="Test Sector", name_de_translation="Test Sector DE", key="test_sector"
        )
        sector_decoy = Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="decoy_sector",
        )

        OrganizationSectorMapping.objects.create(sector=sector, organization=self.org)
        OrganizationSectorMapping.objects.create(
            sector=sector_decoy, organization=self.org_decoy
        )

        # act
        response = self.client.get(self.url)
        res = response.json()

        # assert
        self.assertIsNotNone(res)
        self.assertContains(response, self.org.name)
        self.assertContains(response, sector.name)
        self.assertNotContains(response, "decoy")
        pass

    @tag("organiztaion", "sectors")
    def test_get_organization_edit_view_by_url_slug_includes_sectors(self):
        # arrange
        sector = Sector.objects.create(
            name="Test Sector", name_de_translation="Test Sector DE", key="test_sector"
        )
        sector_decoy = Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="decoy_sector",
        )

        OrganizationSectorMapping.objects.create(sector=sector, organization=self.org)
        OrganizationSectorMapping.objects.create(
            sector=sector_decoy, organization=self.org_decoy
        )

        # act
        response = self.client.get(self.edit_view_url)
        res = response.json()

        # assert
        self.assertIsNotNone(res)
        self.assertContains(response, self.org.name)
        self.assertContains(response, sector.name)
        self.assertNotContains(response, "decoy")
        pass

    @tag("organization", "sectors")
    def test_get_organization_includes_sectors_correctly_ordered(self):
        # arrange
        N = 4
        sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(N)
        ]
        ordering = {sectors[i].key: N - i for i in range(N)}

        for sector in sectors:
            OrganizationSectorMapping.objects.create(
                sector=sector, organization=self.org, order=ordering[sector.key]
            )
        # act
        response = self.client.get(self.url)
        res_view = response.json().get("sectors", None)

        response_edit = self.client.get(self.edit_view_url)
        res_edit = response_edit.json().get("sectors", None)

        # assert
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

    @tag("organization", "sectors")
    def test_patch_organization_adding_first_sector(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")
        sector = Sector.objects.create(
            name="Test Sector", name_de_translation="Test Sector DE", key="test_sector"
        )
        Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="decoy_sector",
        )

        data = {"sectors": [sector.key]}

        # act
        self.client.patch(self.url, data, format="json")
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug,
            ).count(),
            1,
        )
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug, sector__key=sector.key
            ).count(),
            1,
        )

    @tag("organization", "sectors")
    def test_patch_organization_adding_multiple_sectors(self):
        self.client.login(username="testuser", password="testpassword")
        sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(4)
        ]
        Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="decoy_sector",
        )

        data = {"sectors": [s.key for s in sectors]}

        # act
        self.client.patch(self.url, data, format="json")
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug,
            ).count(),
            len(sectors),
        )
        for s in sectors:
            self.assertEqual(
                OrganizationSectorMapping.objects.filter(
                    organization__url_slug=self.org.url_slug, sector__key=s.key
                ).count(),
                1,
            )

    @tag("organization", "sectors")
    def test_patch_organization_adding_another_sector(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")
        sector = Sector.objects.create(
            name="Test Sector", name_de_translation="Test Sector DE", key="test_sector"
        )
        sector_other = Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="decoy_sector",
        )

        OrganizationSectorMapping.objects.create(
            organization=self.org, sector=sector_other
        )

        data = {"sectors": [sector.key, sector_other.key]}

        # act
        self.client.patch(self.url, data, format="json")
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug,
            ).count(),
            2,
        )
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug, sector__key=sector.key
            ).count(),
            1,
        )
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug, sector__key=sector_other.key
            ).count(),
            1,
        )

    @tag("organization", "sectors")
    def test_patch_organization_removing_sector(self):
        # TODO:
        # arrange
        self.client.login(username="testuser", password="testpassword")
        sector = Sector.objects.create(
            name="Test Sector", name_de_translation="Test Sector DE", key="test_sector"
        )
        sector_other = Sector.objects.create(
            name="Test Sector decoy",
            name_de_translation="Test Sector DE decoy",
            key="decoy_sector",
        )

        OrganizationSectorMapping.objects.create(organization=self.org, sector=sector)
        OrganizationSectorMapping.objects.create(
            organization=self.org, sector=sector_other
        )
        OrganizationSectorMapping.objects.create(
            organization=self.org_decoy, sector=sector
        )

        data = {"sectors": []}

        # act
        response = self.client.patch(self.url, data, format="json")

        # assert

        self.assertContains(response, "successfully updated")
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug,
            ).count(),
            0,
        )

        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org_decoy.url_slug,
            ).count(),
            1,
        )

        pass

    @tag("organization", "sectors")
    def test_patch_organization_ordering_of_sectors_correctly_assigned(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")
        N = 4
        sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(N)
        ]

        OrganizationSectorMapping.objects.create(
            organization=self.org, sector=sectors[0], order=1
        )

        ordering = {s.key: N - i - 1 for i, s in enumerate(sectors[1:])}
        data = {"sectors": [s.key for s in sectors[1:]]}

        # act
        self.client.patch(self.url, data, format="json")
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug,
            ).count(),
            3,
        )

        for sector in sectors[1:]:
            mapping = OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug, sector=sector
            )
            self.assertEqual(mapping.count(), 1)
            self.assertEqual(mapping.first().order, ordering[sector.key])

    @tag("organization", "sectors")
    def test_patch_organization_reordering_of_sectors(self):
        # arrange
        self.client.login(username="testuser", password="testpassword")

        N = 4
        sectors = [
            Sector.objects.create(
                name=f"Test Sector {i}",
                name_de_translation=f"Test Sector DE {i}",
                key=f"test_sector_{i}",
            )
            for i in range(N)
        ]
        for i, sector in enumerate(sectors):
            OrganizationSectorMapping.objects.create(
                organization=self.org, sector=sector, order=i + 1
            )
        ordering = {s.key: i + 1 for i, s in enumerate(sectors)}
        data = {"sectors": [s.key for s in sectors]}
        data["sectors"].reverse()
        data["sectors"] += [s.key for s in sectors]  # adding obsolete duplicates

        # act
        self.client.patch(self.url, data, format="json")
        response = self.client.patch(self.url, data, format="json")

        # assert
        self.assertContains(response, "successfully updated")
        self.assertEqual(
            OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug,
            ).count(),
            N,
        )

        for sector in sectors:
            mapping = OrganizationSectorMapping.objects.filter(
                organization__url_slug=self.org.url_slug, sector=sector
            ).first()
            self.assertIsNotNone(mapping)
            self.assertEqual(mapping.order, ordering[sector.key])


class TestCreateOrganizationTranslation(APITestCase):
    @tag("organization", "translations")
    def test_create_organization_translation_persists_get_involved(self):
        # arrange
        org = Organization.objects.create(
            name="Source Org",
            url_slug="source-org",
            language=Language.objects.get(language_code="en"),
        )
        target_language = Language.objects.get(language_code="de")

        texts = {
            "name": "Source Org",
            "short_description": "Short",
            "about": "About",
            "get_involved": "How to help",
        }

        # act
        create_organization_translation(
            organization=org,
            language=target_language,
            texts=texts,
            is_manual_translation=False,
        )
        translation = OrganizationTranslation.objects.get(
            organization=org,
            language=target_language,
        )

        # assert
        self.assertEqual(translation.get_involved_translation, "How to help")


class OrganizationLocationHubFilterTest(TestCase):
    """
    Test case for filtering organizations by location hubs.
    Tests the code in organization_views.py that handles filtering organizations
    by location hubs with aggregated geometry.
    """

    def setUp(self):
        """
        Set up test data for each test method.
        Creates locations, hubs, and organizations for testing.

        Test data structure:
        - 1 Hub "Erlangen" with 3 locations: Erlangen, Bubenreuth, Spardorf
        - 10 Organizations total:
          - 3 with exact hub locations (Erlangen, Bubenreuth, Spardorf)
          - 3 with addresses in Erlangen, Bubenreuth, Spardorf
          - 2 in Nürnberg (location + address) - negative test cases
          - 2 in Paris (location + address) - negative test cases
        """
        self.url = reverse("organization:list-organizations-api-view")

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

        self.location_nuremberg_address = Location.objects.create(
            name="Narrenschiff, Plobenhofstraße 1-9, Nuremberg, Germany",
            city="Nuremberg",
            country="Germany",
            centre_point=Point(11.0780, 49.4530),  # Address in Nuremberg
            multi_polygon=None,
        )

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

        self.location_paris_address = Location.objects.create(
            name="Hotel de Ville, 5 Rue de Lobau, Paris, France",
            city="Paris",
            country="France",
            centre_point=Point(2.3530, 48.8570),  # Address in Paris
            multi_polygon=None,
        )

        # ===== Create 10 Organizations =====
        # Organizations with exact hub locations (3)
        self.org_erlangen_location = Organization.objects.create(
            name="Erlangen Location Org",
            url_slug="erlangen-location-org",
            location=self.location_erlangen,
        )

        self.org_bubenreuth_location = Organization.objects.create(
            name="Bubenreuth Location Org",
            url_slug="bubenreuth-location-org",
            location=self.location_bubenreuth,
        )

        self.org_spardorf_location = Organization.objects.create(
            name="Spardorf Location Org",
            url_slug="spardorf-location-org",
            location=self.location_spardorf,
        )

        # Organizations with addresses in hub locations (3)
        self.org_erlangen_address = Organization.objects.create(
            name="Erlangen Address Org",
            url_slug="erlangen-address-org",
            location=self.location_erlangen_address,
        )

        self.org_bubenreuth_address = Organization.objects.create(
            name="Bubenreuth Address Org",
            url_slug="bubenreuth-address-org",
            location=self.location_bubenreuth_address,
        )

        self.org_spardorf_address = Organization.objects.create(
            name="Spardorf Address Org",
            url_slug="spardorf-address-org",
            location=self.location_spardorf_address,
        )

        # Negative test organizations - Nuremberg
        self.org_nuremberg_location = Organization.objects.create(
            name="Nuremberg Location Org",
            url_slug="nuremberg-location-org",
            location=self.location_nuremberg,
        )

        self.org_nuremberg_address = Organization.objects.create(
            name="Nuremberg Address Org",
            url_slug="nuremberg-address-org",
            location=self.location_nuremberg_address,
        )

        # Negative test organizations - Paris
        self.org_paris_location = Organization.objects.create(
            name="Paris Location Org",
            url_slug="paris-location-org",
            location=self.location_paris,
        )

        self.org_paris_address = Organization.objects.create(
            name="Paris Address Org",
            url_slug="paris-address-org",
            location=self.location_paris_address,
        )

    @tag("location_hub", "organizations")
    def test_filter_organizations_by_multi_location_hub(self):
        """
        Test filtering organizations by the Erlangen hub with 3 locations.
        Should return all 6 organizations within Erlangen, Bubenreuth, and Spardorf.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        org_slugs = [o["url_slug"] for o in results]

        self.assertIn("erlangen-location-org", org_slugs)
        self.assertIn("bubenreuth-location-org", org_slugs)
        self.assertIn("spardorf-location-org", org_slugs)
        self.assertIn("erlangen-address-org", org_slugs)
        self.assertIn("bubenreuth-address-org", org_slugs)
        self.assertIn("spardorf-address-org", org_slugs)

        self.assertEqual(len(results), 6)

        self.assertNotIn("nuremberg-location-org", org_slugs)
        self.assertNotIn("nuremberg-address-org", org_slugs)
        self.assertNotIn("paris-location-org", org_slugs)
        self.assertNotIn("paris-address-org", org_slugs)

    @tag("location_hub", "organizations")
    def test_aggregated_geometry_with_multiple_hub_locations(self):
        """
        Test the aggregated geometry functionality (Union of geometries).
        Verifies that organizations within any of the 3 hub locations are returned.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        org_slugs = [o["url_slug"] for o in results]

        self.assertIn("erlangen-location-org", org_slugs)
        self.assertIn("bubenreuth-location-org", org_slugs)
        self.assertIn("spardorf-location-org", org_slugs)

        self.assertIn("erlangen-address-org", org_slugs)
        self.assertIn("bubenreuth-address-org", org_slugs)
        self.assertIn("spardorf-address-org", org_slugs)

    @tag("location_hub", "organizations")
    def test_filter_organizations_by_hub_filters_by_country(self):
        """
        Test that location hub filtering correctly filters by country first.
        Paris organizations should not appear.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        for org in results:
            org_obj = Organization.objects.get(url_slug=org["url_slug"])
            self.assertEqual(org_obj.location.country, "Germany")

        org_slugs = [o["url_slug"] for o in results]
        self.assertNotIn("paris-location-org", org_slugs)
        self.assertNotIn("paris-address-org", org_slugs)

    @tag("location_hub", "organizations")
    def test_filter_excludes_organizations_outside_hub_geometry(self):
        """
        Test that organizations outside the hub's geometry are excluded.
        Nuremberg organizations should not be included even though they're in Germany.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        org_slugs = [o["url_slug"] for o in results]

        self.assertNotIn("nuremberg-location-org", org_slugs)
        self.assertNotIn("nuremberg-address-org", org_slugs)

        self.assertEqual(len(results), 6)

    @tag("location_hub", "organizations")
    def test_filter_organizations_by_nonexistent_hub(self):
        """
        Test filtering by a hub that doesn't exist.
        Should return no results.
        """
        response = self.client.get(self.url, {"hub": "nonexistent-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 0)

    @tag("location_hub", "organizations")
    def test_filter_organizations_without_hub_parameter(self):
        """
        Test that without hub parameter, all organizations are returned.
        Should return all 10 organizations.
        """
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        self.assertEqual(len(results), 10)

    @tag("location_hub", "organizations")
    def test_address_locations_within_hub_geometry(self):
        """
        Test that address-based locations (null multi_polygon) are correctly matched.
        All 3 address organizations should be included as their centre_points are within
        the hub's aggregated geometry.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        org_slugs = [o["url_slug"] for o in results]

        self.assertIn("erlangen-address-org", org_slugs)
        self.assertIn("bubenreuth-address-org", org_slugs)
        self.assertIn("spardorf-address-org", org_slugs)

        for slug in [
            "erlangen-address-org",
            "bubenreuth-address-org",
            "spardorf-address-org",
        ]:
            org = Organization.objects.get(url_slug=slug)
            self.assertIsNone(org.location.multi_polygon)

    @tag("location_hub", "organizations")
    def test_distinct_results_when_multiple_filters_match(self):
        """
        Test that results are distinct even when an organization matches multiple filter criteria.
        Tests the .distinct() call in the code.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        org_ids = [o["id"] for o in results]
        self.assertEqual(
            len(org_ids),
            len(set(org_ids)),
            "Results should be distinct (no duplicates)",
        )

        self.assertEqual(len(org_ids), 6)


class TestListOrganizationsAPIViewPost(APITestCase):
    def setUp(self):
        self.url = reverse("organization:list-organizations-api-view")
        self.organizations = [
            Organization.objects.create(
                name=f"Test Organization {i}",
                url_slug=f"test-organization-{i}",
            )
            for i in range(NUMBER_OF_ORGANIZATIONS)
        ]

    @tag("organizations")
    def test_post_with_location_body_returns_200(self):
        # Regression test: the frontend sends the location object in the POST
        # body for location search. The endpoint must accept POST (not 405)
        # and fall back to the client-supplied location when OSM lookup fails.
        location_body = {
            "place_id": "abc123",
            "geojson": {"type": "Point", "coordinates": [11.0, 49.0]},
            "osm_id": 123,
            "osm_type": "node",
            "lat": 49.0,
            "lon": 11.0,
        }

        with patch(
            "organization.views.organization_views.get_location_with_range"
        ) as mock_loc:
            mock_loc.return_value = {
                "location": Point(11.0, 49.0),
                "radius": 0,
                "country": "Germany",
            }
            response = self.client.post(self.url, location_body, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), NUMBER_OF_ORGANIZATIONS)

    @tag("organizations")
    def test_post_without_location_body_returns_200(self):
        # A plain POST without a location object should still work like GET.
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), NUMBER_OF_ORGANIZATIONS)

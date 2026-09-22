from django.db.models.signals import post_save
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language
from location.models import Location, LocationTranslation
from location.signals import find_location_translations


class TestGetLocationView(APITestCase):
    def setUp(self):
        post_save.disconnect(find_location_translations, sender=Location)
        self.url = reverse("location:get-location")
        self.language_de = Language.objects.get(language_code="de")

    def tearDown(self):
        post_save.connect(find_location_translations, sender=Location)

    def test_get_location_uses_osm_composite_when_both_osm_and_place_are_provided(self):
        place_match = Location.objects.create(
            name="Place Match",
            city="Berlin",
            country="Germany",
            place_id=123,
            osm_id=999,
            osm_type="R",
            osm_class="legacy",
        )
        osm_match = Location.objects.create(
            name="OSM Match",
            city="Berlin",
            country="Germany",
            place_id=456,
            osm_id=62422,
            osm_type="R",
            osm_class="boundary",
        )

        response = self.client.post(
            self.url,
            {
                "place_id": 123,
                "osm_id": 62422,
                "osm_type": "relation",
                "osm_class": "boundary",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], osm_match.name)
        self.assertNotEqual(response.data["name"], place_match.name)

    def test_get_location_returns_newest_for_duplicate_osm_composite(self):
        older = Location.objects.create(
            name="Berlin Older",
            city="Berlin",
            country="Germany",
            place_id=100,
            osm_id=62422,
            osm_type="R",
            osm_class="boundary",
        )
        newer = Location.objects.create(
            name="Berlin Newer",
            city="Berlin",
            country="Germany",
            place_id=101,
            osm_id=62422,
            osm_type="R",
            osm_class="boundary",
        )

        response = self.client.post(
            self.url,
            {
                "osm_id": 62422,
                "osm_type": "relation",
                "osm_class": "boundary",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], newer.name)
        self.assertNotEqual(response.data["name"], older.name)

    def test_get_location_returns_translated_name_for_accept_language(self):
        location = Location.objects.create(
            name="Munich",
            city="Munich",
            country="Germany",
            place_id=123,
            osm_id=62422,
            osm_type="R",
            osm_class="boundary",
        )
        LocationTranslation.objects.create(
            location=location,
            language=self.language_de,
            name_translation="München",
        )

        response = self.client.post(
            self.url,
            {
                "osm_id": 62422,
                "osm_type": "relation",
                "osm_class": "boundary",
            },
            format="json",
            HTTP_ACCEPT_LANGUAGE="de",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "München")

    def test_get_location_falls_back_to_english_when_translation_missing(self):
        location = Location.objects.create(
            name="Cologne",
            city="Cologne",
            country="Germany",
            place_id=124,
            osm_id=62423,
            osm_type="R",
            osm_class="boundary",
        )

        response = self.client.post(
            self.url,
            {
                "osm_id": 62423,
                "osm_type": "relation",
                "osm_class": "boundary",
            },
            format="json",
            HTTP_ACCEPT_LANGUAGE="de",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], location.name)

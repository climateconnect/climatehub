from unittest.mock import Mock, patch

import requests
from celery.exceptions import Retry
from django.db.models.signals import post_save
from django.test import TestCase, override_settings

from climateconnect_api.models.language import Language
from location.models import Location, LocationTranslation
from location.signals import find_location_translations
from location.tasks import fetch_and_create_location_translations

# Mock-Data for Nominatim API responses
NOMINATIM_RESPONSE_DATA_EN = [
    {
        "address": {"city": "Erlangen", "state": "Bavaria", "country": "Germany"},
        "localname": "Erlangen, Bavaria, Germany",
    }
]

NOMINATIM_RESPONSE_DATA_DE = [
    {
        "address": {"city": "Erlangen", "state": "Bayern", "country": "Deutschland"},
        "localname": "Erlangen, Bayern, Deutschland",
    }
]

NOMINATIM_RESPONSE_DATA_EN_NO_LOCALNAME = [
    {
        "address": {"city": "Erlangen", "state": "Bavaria", "country": "Germany"},
    }
]

NOMINATIM_RESPONSE_DATA_DE_NO_LOCALNAME = [
    {
        "address": {"city": "Erlangen", "state": "Bayern", "country": "Deutschland"},
    }
]

MOCK_NOMINATIM_NOT_FOUND_RESPONSE = []


@override_settings(
    NOMINATIM_LOOKUP_URL="http://mock.nominatim.test/lookup",
    CUSTOM_USER_AGENT="Test-Agent",
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class LocationTaskTest(TestCase):
    def setUp(self):
        post_save.disconnect(find_location_translations, sender=Location)

        # Use or create languages by code to avoid IntegrityError
        self.language_en, _ = Language.objects.get_or_create(language_code="en")
        self.language_de, _ = Language.objects.get_or_create(language_code="de")
        self.location = Location.objects.create(
            id=5,
            name="Original Location Name",
            city="Erlangen",
            country="Germany",
            osm_id=12345,
            osm_type="N",
        )
        self.loc_id = self.location.pk

    def tearDown(self):
        post_save.connect(find_location_translations, sender=Location)

    @patch("requests.get")
    def test_fetch_and_create_location_translations_success(self, mock_get):
        """
        tests translation creation after successful API call.
        """

        mock_response_en = Mock()
        mock_response_en.status_code = 200
        mock_response_en.json.return_value = NOMINATIM_RESPONSE_DATA_EN

        mock_response_de = Mock()
        mock_response_de.status_code = 200
        mock_response_de.json.return_value = NOMINATIM_RESPONSE_DATA_DE

        mock_get.return_value.json.side_effect = [
            NOMINATIM_RESPONSE_DATA_EN,
            NOMINATIM_RESPONSE_DATA_DE,
        ]

        fetch_and_create_location_translations(self.loc_id)

        self.assertEqual(LocationTranslation.objects.count(), 2)

        en_translation = LocationTranslation.objects.get(language=self.language_en)
        self.assertEqual(en_translation.name_translation, "Erlangen, Germany")
        self.assertEqual(en_translation.city_translation, "Erlangen")
        self.assertEqual(en_translation.country_translation, "Germany")
        self.assertEqual(en_translation.state_translation, "Bavaria")
        self.assertEqual(en_translation.language_id, self.language_en.id)
        self.assertEqual(en_translation.location_id, self.location.id)

        de_translation = LocationTranslation.objects.get(language=self.language_de)
        self.assertEqual(de_translation.name_translation, "Erlangen, Deutschland")
        self.assertEqual(de_translation.country_translation, "Deutschland")
        self.assertEqual(de_translation.city_translation, "Erlangen")
        self.assertEqual(de_translation.state_translation, "Bayern")
        self.assertEqual(de_translation.language_id, self.language_de.id)
        self.assertEqual(de_translation.location_id, self.location.id)

        self.assertEqual(mock_get.call_count, 2)

    @patch("location.tasks.logger")
    def test_fetch_and_create_location_translations_location_not_found(
        self, mock_logger
    ):
        """
        tests that the task cleanly aborts when the Location is missing
        """

        fetch_and_create_location_translations(9999)

        mock_logger.error.assert_called_once_with(
            "location with ID 9999 does not exist anymore. Aborting task."
        )
        self.assertEqual(LocationTranslation.objects.count(), 0)

    @patch("location.tasks.logger")
    @patch("requests.get")
    def test_fetch_and_create_location_translations_api_failure_retries(
        self, mock_get, mock_logger
    ):
        """tests that the task retries on API failure (HTTP 500)."""

        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
            "500 Server Error"
        )
        mock_get.return_value = mock_response

        # Bei bind=True Tasks muss man den Task selbst mocken
        with patch.object(
            fetch_and_create_location_translations, "retry", side_effect=Retry()
        ) as mock_retry:
            with self.assertRaises(Retry):
                fetch_and_create_location_translations(self.loc_id)

            mock_retry.assert_called_once()

    @patch("location.tasks.logger")
    def test_fetch_and_create_location_translations_api_resolution_error_retries(
        self, mock_logger
    ):
        """
        tests that a real NameResolutionError (ConnectionError) triggers a Celery retry
        """
        with patch("requests.get") as mock_get:
            mock_get.side_effect = requests.exceptions.ConnectionError(
                "Simulated resolution failure"
            )

            with patch.object(
                fetch_and_create_location_translations, "retry", side_effect=Retry()
            ) as mock_retry:
                with self.assertRaises(Retry):
                    fetch_and_create_location_translations(self.loc_id)

                mock_retry.assert_called_once()

            self.assertEqual(LocationTranslation.objects.count(), 0)

    @patch("requests.get")
    @patch("location.tasks.logger")
    def test_fetch_and_create_location_translations_existing_translation(
        self, mock_logger, mock_get
    ):
        """
        tests if existing translations are handled gracefully (with IntegrityError)
        """

        LocationTranslation.objects.create(
            location=self.location,
            language=self.language_de,
            name_translation="existing",
            city_translation="existing",
            country_translation="existing",
        )

        mock_get.return_value.json.side_effect = [
            NOMINATIM_RESPONSE_DATA_EN,  # should pass
            NOMINATIM_RESPONSE_DATA_DE,  # should fail
        ]

        fetch_and_create_location_translations(self.loc_id)

        self.assertEqual(LocationTranslation.objects.count(), 2)
        self.assertTrue(
            any(
                "already exists" in call[0][0]
                for call in mock_logger.debug.call_args_list
            )
        )

    @patch("requests.get")
    def test_fetch_and_create_location_translations_localname_missing(self, mock_get):
        """
        Tests the fallback behavior when "localname" is missing from the
        Nominatim response. This triggers format_location_name which should
        produce a string name.
        """

        mock_get.return_value.json.side_effect = [
            NOMINATIM_RESPONSE_DATA_EN_NO_LOCALNAME,
            NOMINATIM_RESPONSE_DATA_DE_NO_LOCALNAME,
        ]

        fetch_and_create_location_translations(self.loc_id)

        self.assertEqual(LocationTranslation.objects.count(), 2)

        en_translation = LocationTranslation.objects.get(language=self.language_en)
        self.assertIsInstance(
            en_translation.name_translation,
            str,
            "name_translation should be a string, not a dict",
        )
        self.assertGreater(len(en_translation.name_translation), 0)
        self.assertEqual(en_translation.city_translation, "Erlangen")
        self.assertEqual(en_translation.country_translation, "Germany")
        self.assertEqual(en_translation.state_translation, "Bavaria")

        de_translation = LocationTranslation.objects.get(language=self.language_de)
        self.assertIsInstance(
            de_translation.name_translation,
            str,
            "name_translation should be a string, not a dict",
        )
        self.assertGreater(len(de_translation.name_translation), 0)
        self.assertEqual(de_translation.city_translation, "Erlangen")
        self.assertEqual(de_translation.country_translation, "Deutschland")
        self.assertEqual(de_translation.state_translation, "Bayern")

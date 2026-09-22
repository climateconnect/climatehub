from unittest.mock import MagicMock, patch

import requests
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon, Point, Polygon
from django.db.models.signals import post_save
from django.test import TestCase, override_settings

from climateconnect_api.models.language import Language
from location.models import Location, LocationTranslation
from location.signals import find_location_translations
from location.utility import (
    _get_newest_location_by_osm_composite,
    _osm_type_char,
    format_exact_location_name,
    format_location_name,
    get_global_location,
    get_language_code_from_context,
    get_location,
    get_location_with_range,
    get_translated_exact_location_name,
    get_translated_location_name,
)


class TestFormatLocationName(TestCase):
    def test_country_location(self):
        """
        Test formatting when the location is a country.
        """
        location = {
            "type": "administrative",
            "address": {"country": "Canada", "country_code": "ca"},
            "display_name": "Canada",
        }
        expected_result = {
            "country": "Canada",
            "city": "",
            "state": "",
            "name": "Canada",
        }
        result = format_location_name(location)
        self.assertEqual(expected_result, result)

    def test_city_location(self):
        """
        Test formatting when the location is a city.
        """
        location = {
            "type": "city",
            "address": {
                "city": "City-Sample",
                "state": "State-Sample",
                "country": "Country-Sample",
            },
            "display_name": "Display-Name-Sample",
        }
        expected_result = {
            "city": "City-Sample",
            "state": "State-Sample",
            "country": "Country-Sample",
            "name": "City-Sample, Country-Sample",
        }
        result = format_location_name(location)
        self.assertEqual(expected_result, result)

    def test_location_with_hamlet(self):
        """
        Test formatting when the location is a hamlet.
        """
        location = {
            "type": "hamlet",
            "addresstype": "hamlet",
            "class": "place",
            "name": "Hamlet-Sample",
            "address": {
                "hamlet": "Hamlet-Sample",
                "town": "Town-Sample",
                "county": "County-Sample",
                "state": "State-Sample",
                "country": "Country-Sample",
            },
            "display_name": "Display-Name-Sample",
        }
        expected_result = {
            "city": "Hamlet-Sample",
            "state": "State-Sample",
            "country": "Country-Sample",
            "name": "Hamlet-Sample, Town-Sample, Country-Sample",
        }
        result = format_location_name(location)
        self.assertEqual(expected_result, result)

    def test_location_with_hamlet_without_town(self):
        """
        Test formatting when the location is a hamlet without town.
        """
        location = {
            "type": "hamlet",
            "addresstype": "hamlet",
            "class": "place",
            "name": "Hamlet-Sample",
            "address": {
                "hamlet": "Hamlet-Sample",
                "county": "County-Sample",
                "state": "State-Sample",
                "country": "Country-Sample",
            },
            "display_name": "Display-Name-Sample",
        }
        expected_result = {
            "city": "Hamlet-Sample",
            "state": "State-Sample",
            "country": "Country-Sample",
            "name": "Hamlet-Sample, County-Sample, Country-Sample",
        }
        result = format_location_name(location)
        self.assertEqual(expected_result, result)

    def test_location_with_custom_name_mapping(self):
        """
        Test formatting when the name is overridden by the CUSTOM_NAME_MAPPINGS in utility.py.
        """
        location = {
            "type": "administrative",
            "addresstype": "state",
            "name": "Scotland",
            "address": {
                "state": "Scotland",
                "country": "United Kingdom",
                "country_code": "gb",
            },
            "display_name": "Scotland, United Kingdom",
        }
        expected_result = {
            "city": "Scotland (state)",
            "state": "Scotland",
            "country": "United Kingdom",
            "name": "Scotland",
        }
        result = format_location_name(location)
        self.assertEqual(expected_result, result)


class TestOsmTypeChar(TestCase):
    """Tests for the _osm_type_char function."""

    def test_relation_lowercase(self):
        self.assertEqual(_osm_type_char("relation"), "R")

    def test_way_lowercase(self):
        self.assertEqual(_osm_type_char("way"), "W")

    def test_node_lowercase(self):
        self.assertEqual(_osm_type_char("node"), "N")

    def test_single_char_lowercase(self):
        self.assertEqual(_osm_type_char("r"), "R")
        self.assertEqual(_osm_type_char("w"), "W")
        self.assertEqual(_osm_type_char("n"), "N")

    def test_single_char_uppercase(self):
        self.assertEqual(_osm_type_char("R"), "R")
        self.assertEqual(_osm_type_char("W"), "W")
        self.assertEqual(_osm_type_char("N"), "N")

    def test_none_input(self):
        self.assertIsNone(_osm_type_char(None))

    def test_unknown_value(self):
        self.assertIsNone(_osm_type_char("unknown"))


class TestGetLocation(TestCase):
    """Tests for the get_location function with OSM data."""

    def setUp(self):
        post_save.disconnect(find_location_translations, sender=Location)
        self.valid_location_object = {
            "place_id": 12345,
            "country": "Germany",
            "name": "Berlin",
            "type": "Point",
            "lon": "13.405",
            "lat": "52.52",
            "osm_id": 62422,
            "osm_type": "relation",
            "osm_class": "boundary",
            "osm_class_type": "administrative",
            "display_name": "Berlin, Germany",
            "geojson": {"type": "Point", "coordinates": [13.405, 52.52]},
        }

    def tearDown(self):
        post_save.connect(find_location_translations, sender=Location)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_osm_fields_saved_correctly(self):
        """Test that osm_id, osm_type, osm_class, osm_class_type and display_name are saved."""
        location = get_location(self.valid_location_object)

        self.assertEqual(location.osm_id, 62422)
        self.assertEqual(location.osm_type, "R")
        self.assertEqual(location.osm_class, "boundary")
        self.assertEqual(location.osm_class_type, "administrative")
        self.assertEqual(location.display_name, "Berlin, Germany")

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_osm_type_mapping_way(self):
        """Test that osm_type 'way' is correctly mapped to 'W'."""
        self.valid_location_object["osm_type"] = "way"
        location = get_location(self.valid_location_object)

        self.assertEqual(location.osm_type, "W")

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_osm_type_mapping_node(self):
        """Test that osm_type 'node' is correctly mapped to 'N'."""
        self.valid_location_object["osm_type"] = "node"
        location = get_location(self.valid_location_object)

        self.assertEqual(location.osm_type, "N")

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_osm_type_mapping_relation(self):
        """Test that osm_type 'relation' is correctly mapped to 'R'."""
        self.valid_location_object["osm_type"] = "relation"
        location = get_location(self.valid_location_object)

        self.assertEqual(location.osm_type, "R")

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_existing_location_returned(self):
        """Test that existing location is returned instead of creating a new one."""
        # Create first location
        location1 = get_location(self.valid_location_object)

        # Try to get same location again
        location2 = get_location(self.valid_location_object)

        self.assertEqual(location1.id, location2.id)
        self.assertEqual(Location.objects.filter(place_id=12345).count(), 1)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_optional_fields_default_to_empty_string(self):
        """Test that optional fields default to empty strings when not provided."""
        # Remove optional fields
        location_object = self.valid_location_object.copy()
        # city, state, place_name, exact_address are optional

        location = get_location(location_object)

        self.assertEqual(location.city, "")
        self.assertEqual(location.state, "")
        self.assertEqual(location.place_name, "")
        self.assertEqual(location.exact_address, "")

    def test_returns_newest_for_duplicate_osm_composite(self):
        """When duplicates exist for one OSM composite key, newest (highest id) is returned."""
        older = Location.objects.create(
            name="Berlin Older",
            city="Berlin",
            country="Germany",
            osm_id=62422,
            osm_type="R",
            osm_class="boundary",
            place_id=100,
        )
        newer = Location.objects.create(
            name="Berlin Newer",
            city="Berlin",
            country="Germany",
            osm_id=62422,
            osm_type="R",
            osm_class="boundary",
            place_id=101,
        )

        result = _get_newest_location_by_osm_composite(62422, "relation", "boundary")

        self.assertEqual(result.id, newer.id)
        self.assertNotEqual(result.id, older.id)

    def test_get_location_prefers_osm_composite_over_place_id(self):
        """OSM composite lookup must take precedence when both OSM and place_id are available."""
        Location.objects.create(
            name="Legacy Place Match",
            city="Berlin",
            country="Germany",
            place_id=12345,
            osm_id=1,
            osm_type="R",
            osm_class="old",
        )

        expected = Location.objects.create(
            name="OSM Match",
            city="Berlin",
            country="Germany",
            place_id=99999,
            osm_id=62422,
            osm_type="R",
            osm_class="boundary",
        )

        result = get_location(self.valid_location_object)
        self.assertEqual(result.id, expected.id)

    def test_global_location_has_synthetic_osm_fields(self):
        global_location = get_global_location()

        self.assertEqual(global_location.name, "Global")
        self.assertEqual(global_location.osm_id, -1)
        self.assertEqual(global_location.osm_type, "R")
        self.assertEqual(global_location.osm_class, "global")
        self.assertEqual(global_location.osm_class_type, "global")


@override_settings(
    LOCATION_SERVICE_BASE_URL="http://mock.location.test",
    CUSTOM_USER_AGENT="Test-Agent",
)
class TestGetLocationWithStrippedGeometry(TestCase):
    """
    Autocomplete responses no longer carry polygon coordinates (they are
    stripped before caching, see location.providers.strip_geometry). The full
    geometry must still reach the database, so get_location() re-fetches it
    from the provider when it creates a Location it has never seen before.
    """

    # A small square around Berlin — enough to become a real MultiPolygon.
    POLYGON = {
        "type": "Polygon",
        "coordinates": [
            [[13.0, 52.0], [14.0, 52.0], [14.0, 53.0], [13.0, 53.0], [13.0, 52.0]]
        ],
    }

    def setUp(self):
        post_save.disconnect(find_location_translations, sender=Location)
        self.stripped_location_object = {
            "place_id": 999111,
            "country": "Germany",
            "name": "Brandenburg",
            "type": "Polygon",
            "lon": "13.5",
            "lat": "52.5",
            "osm_id": 62504,
            "osm_type": "relation",
            "osm_class": "boundary",
            "osm_class_type": "administrative",
            "display_name": "Brandenburg, Germany",
            # This is what strip_geometry() leaves behind.
            "geojson": {"type": "Polygon", "coordinates": None},
        }

    def tearDown(self):
        post_save.connect(find_location_translations, sender=Location)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch("location.utility.requests.get")
    def test_polygon_is_refetched_and_stored(self, mock_get):
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: [{"geojson": self.POLYGON}],
        )

        location = get_location(self.stripped_location_object)

        mock_get.assert_called_once()
        # The looked-up object is the one the user picked.
        self.assertEqual(mock_get.call_args.kwargs["params"]["osm_ids"], "R62504")
        self.assertEqual(mock_get.call_args.kwargs["params"]["polygon_geojson"], 1)
        # ...and the real geometry landed in the DB, not a point.
        self.assertIsNotNone(location.multi_polygon)
        self.assertGreater(location.multi_polygon.area, 0)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch("location.utility.requests.get")
    def test_falls_back_to_point_when_lookup_fails(self, mock_get):
        # A failed geometry lookup must not block the user from saving.
        mock_get.side_effect = requests.RequestException("upstream down")

        location = get_location(self.stripped_location_object)

        self.assertIsNone(location.multi_polygon)
        self.assertIsNotNone(location.centre_point)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch("location.utility.requests.get")
    def test_no_lookup_for_a_point_geometry(self, mock_get):
        # Points keep their coordinates through stripping, so there is
        # nothing to re-fetch.
        point_object = {
            **self.stripped_location_object,
            "type": "Point",
            "geojson": {"type": "Point", "coordinates": [13.405, 52.52]},
        }

        get_location(point_object)

        mock_get.assert_not_called()

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    @patch("location.utility.requests.get")
    def test_no_lookup_when_location_already_exists(self, mock_get):
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: [{"geojson": self.POLYGON}]
        )
        existing = get_location(self.stripped_location_object)
        mock_get.reset_mock()

        again = get_location(self.stripped_location_object)

        # Resolved straight from the DB by OSM composite key — the geometry
        # lookup only ever costs us on first creation.
        self.assertEqual(again.id, existing.id)
        mock_get.assert_not_called()


class TestGetLocationWithRange(TestCase):
    """Tests for get_location_with_range, specifically the newest-record selection."""

    def setUp(self):
        post_save.disconnect(find_location_translations, sender=Location)

    def tearDown(self):
        post_save.connect(find_location_translations, sender=Location)

    def _make_location(
        self, name, country, place_id, osm_id=62422, osm_type="W", multi_polygon=None
    ):
        """Helper to create a Location with a centre_point geometry."""
        return Location.objects.create(
            name=name,
            city="Berlin",
            country=country,
            osm_id=osm_id,
            osm_type=osm_type,
            osm_class="boundary",
            place_id=place_id,
            centre_point=Point(13.4050, 52.5200),
            multi_polygon=multi_polygon,
        )

    def test_returns_newest_for_duplicate_osm_composite(self):
        """When multiple records share the same OSM composite key,
        get_location_with_range must use the newest (highest ID) record."""
        self._make_location("Berlin Older", "OldCountry", place_id=100)
        newer = self._make_location("Berlin Newer", "NewCountry", place_id=101)

        result = get_location_with_range(
            {"osm_id": 62422, "osm_type": "way", "osm_class": "boundary"}
        )

        self.assertEqual(result["country"], newer.country)

    def test_place_id_fallback_resolves_location(self):
        """When only place_id is provided (no OSM params), the existing
        location must still be resolved via the deprecated place_id path."""
        location = self._make_location("Berlin", "Germany", place_id=999)

        result = get_location_with_range({"place_id": 999})

        self.assertEqual(result["country"], location.country)

    def test_osm_id_and_type_fallback_without_osm_class(self):
        """When osm_id and osm_type are provided but osm_class is absent,
        the intermediate fallback must still resolve the correct location."""
        location = self._make_location("Berlin", "Germany", place_id=200)

        result = get_location_with_range({"osm_id": 62422, "osm_type": "way"})

        self.assertEqual(result["country"], location.country)

    def test_place_id_only_relation_uses_multi_polygon(self):
        """When resolved via place_id and the location is a Relation with a
        multi_polygon, get_location_with_range must use multi_polygon (not
        centre_point) even though osm_type was not in the query params."""
        poly = Polygon(((0, 0), (1, 0), (1, 1), (0, 1), (0, 0)))
        multi_poly = MultiPolygon(poly)
        self._make_location(
            "Berlin Relation",
            "Germany",
            place_id=777,
            osm_type="R",
            multi_polygon=multi_poly,
        )

        result = get_location_with_range({"place_id": 777})

        # The returned geometry must be the buffered multi_polygon, not a Point.
        # Note: .buffer() on a MultiPolygon may return a Polygon (when the buffer
        # collapses multiple rings into one), so we accept any area geometry here.

        self.assertIsInstance(result["location"], GEOSGeometry)
        self.assertNotIsInstance(result["location"], Point)


class TestGetTranslatedLocationName(TestCase):
    def setUp(self):
        from django.db.models.signals import post_save

        post_save.disconnect(find_location_translations, sender=Location)
        self.location = Location.objects.create(
            name="Munich",
            city="Munich",
            country="Germany",
            osm_id=62428,
            osm_type="R",
            osm_class="boundary",
            osm_class_type="administrative",
            display_name="Munich, Germany",
            is_formatted=True,
        )
        self.language_de, _ = Language.objects.get_or_create(
            language_code="de",
            defaults={"name": "German"},
        )
        LocationTranslation.objects.create(
            location=self.location,
            language=self.language_de,
            name_translation="München",
            city_translation="München",
            country_translation="Deutschland",
        )
        # Re-fetch with prefetch so translate_location is cached
        self.location = Location.objects.prefetch_related(
            "translate_location__language"
        ).get(pk=self.location.pk)

    def test_returns_translation_for_matching_language_code(self):
        """Exact language code match returns the translated name."""
        result = get_translated_location_name(self.location, "de")
        self.assertEqual(result, "München")

    def test_normalises_full_locale_to_primary_subtag(self):
        """'de-DE' should be normalised to 'de' and match the German translation."""
        result = get_translated_location_name(self.location, "de-DE")
        self.assertEqual(result, "München")

    def test_fallback_when_no_matching_language(self):
        """Falls back to location.name when no translation exists for the language."""
        result = get_translated_location_name(self.location, "fr")
        self.assertEqual(result, "Munich")

    def test_fallback_when_name_translation_is_empty(self):
        """Falls back to location.name when the translation record exists but name_translation is empty."""
        self.location.translate_location.filter(language=self.language_de).update(
            name_translation=""
        )
        location = Location.objects.prefetch_related(
            "translate_location__language"
        ).get(pk=self.location.pk)
        result = get_translated_location_name(location, "de")
        self.assertEqual(result, "Munich")

    def test_fallback_when_language_code_is_none(self):
        """Falls back to location.name when language_code is None."""
        result = get_translated_location_name(self.location, None)
        self.assertEqual(result, "Munich")

    def test_fallback_when_language_code_is_empty_string(self):
        """Falls back to location.name when language_code is an empty string."""
        result = get_translated_location_name(self.location, "")
        self.assertEqual(result, "Munich")


class TestGetLanguageCodeFromContext(TestCase):
    def _make_request(self, language_code):
        """Return a minimal mock request with LANGUAGE_CODE set."""

        class FakeRequest:
            LANGUAGE_CODE = language_code

        return FakeRequest()

    def test_returns_language_code_from_request(self):
        """Returns the request's LANGUAGE_CODE when present."""
        ctx = {"request": self._make_request("de")}
        self.assertEqual(get_language_code_from_context(ctx), "de")

    def test_returns_full_locale_from_request(self):
        """Returns the full locale string as-is (subtag normalisation is the caller's job)."""
        ctx = {"request": self._make_request("de-AT")}
        self.assertEqual(get_language_code_from_context(ctx), "de-AT")

    def test_falls_back_to_en_when_no_request(self):
        """Falls back to 'en' when context has no request key."""
        self.assertEqual(get_language_code_from_context({}), "en")

    def test_falls_back_to_en_when_context_is_none(self):
        """Falls back to 'en' when context itself is None."""
        self.assertEqual(get_language_code_from_context(None), "en")

    def test_falls_back_to_context_language_code_when_request_has_none(self):
        """Uses context['language_code'] when request.LANGUAGE_CODE is None."""
        ctx = {"request": self._make_request(None), "language_code": "fr"}
        self.assertEqual(get_language_code_from_context(ctx), "fr")

    def test_falls_back_to_en_when_all_sources_empty(self):
        """Falls back to 'en' when request.LANGUAGE_CODE and context language_code are both absent."""
        ctx = {"request": self._make_request(None)}
        self.assertEqual(get_language_code_from_context(ctx), "en")


class TestFormatExactLocationName(TestCase):
    """Unit tests for format_exact_location_name."""

    def test_place_address_city_country(self):
        """Full exact location: place + address + city + country."""
        result = format_exact_location_name(
            place_name="City Hall",
            exact_address="Main Street 1",
            city="Berlin",
            state="Berlin",
            country="Germany",
        )
        self.assertEqual(result, "City Hall, Main Street 1, Berlin, Germany")

    def test_place_and_city_only(self):
        """Place name with city and country but no address."""
        result = format_exact_location_name(
            place_name="Brandenburger Tor",
            exact_address="",
            city="Berlin",
            state="Berlin",
            country="Germany",
        )
        self.assertEqual(result, "Brandenburger Tor, Berlin, Germany")

    def test_address_and_city_only(self):
        """Street address with city and country but no named place."""
        result = format_exact_location_name(
            place_name="",
            exact_address="Unter den Linden 77",
            city="Berlin",
            state="Berlin",
            country="Germany",
        )
        self.assertEqual(result, "Unter den Linden 77, Berlin, Germany")

    def test_city_omitted_when_equals_place_name(self):
        """City is omitted from the tail when it matches place_name to avoid duplication."""
        result = format_exact_location_name(
            place_name="Berlin",
            exact_address="",
            city="Berlin",
            state="Berlin",
            country="Germany",
        )
        self.assertEqual(result, "Berlin, Germany")

    def test_custom_name_mapping_applied(self):
        """CUSTOM_NAME_MAPPINGS overrides are applied to the assembled name."""
        result = format_exact_location_name(
            place_name="Scotland (state)",
            exact_address="",
            city="",
            state="",
            country="Scotland",
        )
        self.assertEqual(result, "Scotland")

    def test_no_place_or_address_falls_back_to_city_country(self):
        """With no place_name or exact_address the result is just city, country."""
        result = format_exact_location_name(
            place_name="",
            exact_address="",
            city="Munich",
            state="Bavaria",
            country="Germany",
        )
        self.assertEqual(result, "Munich, Germany")

    def test_empty_inputs_return_empty_string(self):
        """All-empty inputs produce an empty string."""
        result = format_exact_location_name(
            place_name="",
            exact_address="",
            city="",
            state="",
            country="",
        )
        self.assertEqual(result, "")

    def test_map_state_as_country_codes_gb(self):
        """For GB locations the state (e.g. 'Scotland') is shown instead of 'United Kingdom'."""
        result = format_exact_location_name(
            place_name="Venue",
            exact_address="",
            city="Edinburgh",
            state="Scotland",
            country="United Kingdom",
        )
        self.assertEqual(result, "Venue, Edinburgh, Scotland")

    def test_map_state_as_country_codes_explicit_country_code(self):
        """Explicit country_code='gb' also triggers state substitution."""
        result = format_exact_location_name(
            place_name="",
            exact_address="",
            city="Edinburgh",
            state="Scotland",
            country="United Kingdom",
            country_code="gb",
        )
        self.assertEqual(result, "Edinburgh, Scotland")


class TestGetTranslatedExactLocationName(TestCase):
    """Integration tests for get_translated_exact_location_name."""

    def setUp(self):
        post_save.disconnect(find_location_translations, sender=Location)
        self.location = Location.objects.create(
            name="City Hall, Berlin, Germany",
            place_name="City Hall",
            exact_address="Rathausstraße 1",
            city="Berlin",
            state="Berlin",
            country="Germany",
            osm_id=99999,
            osm_type="N",
            osm_class="amenity",
            osm_class_type="city_hall",
            display_name="City Hall, Rathausstraße 1, Berlin, Germany",
            is_formatted=True,
        )
        self.language_de, _ = Language.objects.get_or_create(
            language_code="de",
            defaults={"name": "German"},
        )
        LocationTranslation.objects.create(
            location=self.location,
            language=self.language_de,
            name_translation="Rathaus, Rathausstraße 1, Berlin, Deutschland",
            city_translation="Berlin",
            country_translation="Deutschland",
        )
        self.location = Location.objects.prefetch_related(
            "translate_location__language"
        ).get(pk=self.location.pk)

    def tearDown(self):
        post_save.connect(find_location_translations, sender=Location)

    def test_translated_name_uses_translated_city_and_country(self):
        """German translation: translated city + country appear in the result."""
        result = get_translated_exact_location_name(self.location, "de")
        self.assertEqual(result, "City Hall, Rathausstraße 1, Berlin, Deutschland")

    def test_untranslated_language_falls_back_to_base_fields(self):
        """Unknown language code falls back to Location.city / Location.country."""
        result = get_translated_exact_location_name(self.location, "fr")
        self.assertEqual(result, "City Hall, Rathausstraße 1, Berlin, Germany")

    def test_none_language_falls_back_to_base_fields(self):
        """None language code uses the base Location fields."""
        result = get_translated_exact_location_name(self.location, None)
        self.assertEqual(result, "City Hall, Rathausstraße 1, Berlin, Germany")

    def test_location_without_place_name(self):
        """Location with only exact_address (no place_name) still works."""
        self.location.place_name = ""
        result = get_translated_exact_location_name(self.location, "de")
        self.assertEqual(result, "Rathausstraße 1, Berlin, Deutschland")

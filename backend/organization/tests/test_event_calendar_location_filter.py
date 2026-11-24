"""
Location (+ radius) filtering on the event calendar endpoints.

Spec: doc/spec/20261116_1005_event_calendar_location_filter.md

The event endpoints reuse the browse page location semantics via
``organization.utility.project.apply_location_filter``. Locations are created
in the DB so ``get_location_with_range`` resolves them without hitting the
upstream location service.
"""

from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

import requests
from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language
from hubs.models.hub import Hub
from location.models import Location
from organization.models import (
    Project,
    ProjectSectorMapping,
    ProjectStatus,
    Sector,
)
from organization.utility.ical_feed import canonicalize_query, sign_feed_token

FIXED_NOW = datetime(2026, 3, 1, 12, 0, 0, tzinfo=dt_timezone.utc)

ERLANGEN_OSM = {"osm_id": "1001", "osm_type": "relation", "osm_class": "boundary"}


class EventLocationFilterFixtures:
    def setUp(self):
        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.language, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )

        # The location users filter by (an OSM relation with a polygon).
        self.erlangen = Location.objects.create(
            name="Erlangen",
            city="Erlangen",
            country="Germany",
            osm_id=1001,
            osm_type="R",
            osm_class="boundary",
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
        # Event locations: a point inside Erlangen, one ~11 km south of the
        # Erlangen boundary (Nuremberg), and one in another country.
        loc_in_erlangen = Location.objects.create(
            name="Erlangen Schlossplatz",
            city="Erlangen",
            country="Germany",
            osm_id=2001,
            osm_type="N",
            osm_class="place",
            centre_point=Point(11.0040, 49.5980),
        )
        loc_nuremberg = Location.objects.create(
            name="Nuremberg",
            city="Nuremberg",
            country="Germany",
            osm_id=2002,
            osm_type="N",
            osm_class="place",
            centre_point=Point(11.0800, 49.4500),
        )
        loc_paris = Location.objects.create(
            name="Paris",
            city="Paris",
            country="France",
            osm_id=2003,
            osm_type="N",
            osm_class="place",
            centre_point=Point(2.3522, 48.8566),
        )

        # Nuremberg event starts first so ordering-by-distance vs
        # ordering-by-date is distinguishable.
        self.event_nuremberg = self._event("Nuremberg Event", loc_nuremberg, days=2)
        self.event_erlangen_1 = self._event("Erlangen Event 1", loc_in_erlangen, 5)
        self.event_erlangen_2 = self._event("Erlangen Event 2", loc_in_erlangen, 9)
        self.event_paris = self._event("Paris Event", loc_paris, days=3)

    def _event(self, name, loc, days):
        return Project.objects.create(
            name=name,
            url_slug=name.lower().replace(" ", "-"),
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            loc=loc,
            start_date=FIXED_NOW + timedelta(days=days),
            end_date=FIXED_NOW + timedelta(days=days, hours=2),
        )


class TestEventListLocationFilter(EventLocationFilterFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse("organization:list-events")

    def _names(self, params):
        response = self.client.get(self.url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        return [e["name"] for e in response.data["results"]]

    def test_without_location_returns_all_events(self):
        self.assertEqual(len(self._names({})), 4)

    def test_location_without_radius_returns_only_events_inside(self):
        names = self._names(ERLANGEN_OSM)
        self.assertEqual(names, ["Erlangen Event 1", "Erlangen Event 2"])

    def test_radius_includes_nearby_and_excludes_far_events(self):
        names = self._names({**ERLANGEN_OSM, "radius": "25"})
        self.assertIn("Nuremberg Event", names)
        self.assertNotIn("Paris Event", names)

    def test_small_radius_excludes_nearby_town(self):
        names = self._names({**ERLANGEN_OSM, "radius": "5"})
        self.assertNotIn("Nuremberg Event", names)

    def test_location_filter_keeps_chronological_order(self):
        names = self._names({**ERLANGEN_OSM, "radius": "25"})
        self.assertEqual(
            names, ["Nuremberg Event", "Erlangen Event 1", "Erlangen Event 2"]
        )

    def test_location_without_osm_class_uses_fallback_lookup(self):
        params = {"osm_id": "1001", "osm_type": "relation"}
        self.assertEqual(self._names(params), ["Erlangen Event 1", "Erlangen Event 2"])

    def test_location_and_sectors_do_not_duplicate_events(self):
        parent = Sector.objects.create(
            name="Loc Energy", name_de_translation="Loc Energie", key="loc_energy"
        )
        child = Sector.objects.create(
            name="Loc Solar",
            name_de_translation="Loc Solar",
            key="loc_solar",
            relates_to_sector=parent,
        )
        ProjectSectorMapping.objects.create(
            project=self.event_erlangen_1, sector=parent
        )
        ProjectSectorMapping.objects.create(project=self.event_erlangen_1, sector=child)

        names = self._names({**ERLANGEN_OSM, "sectors": "Loc Energy,Loc Solar"})
        self.assertEqual(names, ["Erlangen Event 1"])

    def test_location_combines_with_custom_hub(self):
        hub = Hub.objects.create(
            name="Custom",
            url_slug="custom-loc-hub",
            hub_type=Hub.CUSTOM_HUB_TYPE,
            segway_text="test",
        )
        self.event_erlangen_2.related_hubs.add(hub)
        self.event_paris.related_hubs.add(hub)

        names = self._names({**ERLANGEN_OSM, "hub": hub.url_slug})
        self.assertEqual(names, ["Erlangen Event 2"])

    @patch("location.utility.requests.get")
    def test_unresolvable_location_returns_400(self, mock_get):
        mock_get.return_value.status_code = 404
        mock_get.return_value.text = "not found"
        response = self.client.get(
            self.url, {"osm_id": "999999", "osm_type": "relation", "osm_class": "x"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["location"], ["Location could not be resolved."])

    @patch("location.utility.requests.get")
    def test_unresolvable_location_does_not_leak_upstream_details(self, mock_get):
        mock_get.return_value.status_code = 500
        mock_get.return_value.text = "SECRET-UPSTREAM-BODY"
        response = self.client.get(
            self.url, {"osm_id": "999999", "osm_type": "relation", "osm_class": "x"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("SECRET-UPSTREAM-BODY", response.content.decode())

    @patch("location.utility.requests.get")
    def test_upstream_connection_error_does_not_leak_service_url(self, mock_get):
        mock_get.side_effect = requests.ConnectionError(
            "Max retries exceeded with url: http://internal-nominatim:8080/lookup"
        )
        response = self.client.get(
            self.url, {"osm_id": "999999", "osm_type": "relation", "osm_class": "x"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("internal-nominatim", response.content.decode())

    @patch("location.utility.requests.get")
    def test_invalid_radius_returns_400_without_lookup(self, mock_get):
        for radius in ("abc", "", "-5", "nan", "inf", "25km"):
            with self.subTest(radius=radius):
                response = self.client.get(self.url, {**ERLANGEN_OSM, "radius": radius})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("radius", response.data)
        mock_get.assert_not_called()

    def test_decimal_and_zero_radius_are_accepted(self):
        self.assertIn(
            "Nuremberg Event", self._names({**ERLANGEN_OSM, "radius": "25.5"})
        )
        self.assertEqual(
            self._names({**ERLANGEN_OSM, "radius": "0"}),
            ["Erlangen Event 1", "Erlangen Event 2"],
        )

    def test_invalid_radius_without_location_is_ignored(self):
        self.assertEqual(len(self._names({"radius": "abc"})), 4)

    def test_location_is_resolved_once_per_request(self):
        # Note: /api/events/ has a pre-existing per-event N+1 in
        # ProjectStubSerializer (comment/like counts etc.), independent of the
        # location filter. Here we only assert the filter itself adds a
        # single location lookup, regardless of the number of results.
        self._event("Erlangen Event 3", self.event_erlangen_1.loc, 11)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(self.url, {**ERLANGEN_OSM, "radius": "25"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        location_lookups = [
            q for q in ctx.captured_queries if 'FROM "location_location"' in q["sql"]
        ]
        self.assertEqual(len(location_lookups), 1)


class TestEventCountsLocationFilter(EventLocationFilterFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse("organization:events-calendar-counts")
        self.base = {"year": 2026, "month": 3, "timezone": "UTC"}

    def _total(self, params):
        response = self.client.get(self.url, {**self.base, **params})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        return sum(item["count"] for item in response.data)

    def test_counts_respect_location(self):
        self.assertEqual(self._total({}), 4)
        self.assertEqual(self._total(ERLANGEN_OSM), 2)
        self.assertEqual(self._total({**ERLANGEN_OSM, "radius": "25"}), 3)

    @patch("location.utility.requests.get")
    def test_counts_unresolvable_location_returns_400(self, mock_get):
        mock_get.return_value.status_code = 404
        mock_get.return_value.text = "not found"
        response = self.client.get(
            self.url,
            {**self.base, "osm_id": "999999", "osm_type": "relation", "osm_class": "x"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("not found", response.content.decode())

    def test_counts_invalid_radius_returns_400(self):
        response = self.client.get(
            self.url, {**self.base, **ERLANGEN_OSM, "radius": "abc"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("radius", response.data)


class TestEventFeedLocationFilter(EventLocationFilterFixtures, APITestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse("organization:events-feed-ics")
        self.token_url = reverse("organization:event-feed-token")

    def _signed_get(self, params):
        token = sign_feed_token(canonicalize_query(params))
        return self.client.get(self.url, {**params, "token": token})

    def test_feed_applies_location_filter(self):
        response = self._signed_get(
            {**ERLANGEN_OSM, "radius": "25", "date": "2026-03-01"}
        )
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn("Erlangen Event 1", body)
        self.assertIn("Nuremberg Event", body)
        self.assertNotIn("Paris Event", body)

    def test_feed_description_mentions_location(self):
        response = self._signed_get(
            {**ERLANGEN_OSM, "radius": "25", "date": "2026-03-01"}
        )
        body = response.content.decode().replace("\r\n ", "")
        self.assertIn("location=Erlangen", body)
        self.assertIn("radius=25km", body)

    def test_location_params_are_covered_by_token(self):
        params = {**ERLANGEN_OSM, "date": "2026-03-01"}
        token = sign_feed_token(canonicalize_query(params))
        tampered = {**params, "osm_id": "2003", "token": token}
        response = self.client.get(self.url, tampered)
        self.assertEqual(response.status_code, 403)

    def test_token_endpoint_signs_location_params(self):
        response = self.client.post(
            self.token_url,
            {**ERLANGEN_OSM, "radius": "25", "date": "2026-03-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        url = response.json()["url"]
        for fragment in ("osm_id=1001", "osm_type=relation", "radius=25"):
            self.assertIn(fragment, url)

        query = url.split("?", 1)[1]
        feed_response = self.client.get(f"{self.url}?{query}")
        self.assertEqual(feed_response.status_code, 200)
        self.assertNotIn("Paris Event", feed_response.content.decode())

    def test_feed_with_signed_invalid_radius_returns_400(self):
        # The token endpoint signs whatever radius it gets, so the feed must
        # still reject an invalid one with a 400, not a 500.
        response = self._signed_get(
            {**ERLANGEN_OSM, "radius": "abc", "date": "2026-03-01"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content.decode(), "Invalid radius")

    @patch("location.utility.requests.get")
    def test_feed_with_unresolvable_location_returns_generic_400(self, mock_get):
        mock_get.return_value.status_code = 500
        mock_get.return_value.text = "SECRET-UPSTREAM-BODY"
        response = self._signed_get(
            {
                "osm_id": "999999",
                "osm_type": "relation",
                "osm_class": "x",
                "date": "2026-03-01",
            }
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content.decode(), "Invalid location")

    def test_existing_tokens_without_location_still_verify(self):
        response = self._signed_get({"date": "2026-03-01"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("Paris Event", response.content.decode())


class TestSharedLocationFilterErrors(APITestCase):
    """Browse and upcoming events share the helper: bad input is a 400, not a 500."""

    @patch("location.utility.requests.get")
    def test_invalid_radius_returns_400(self, mock_get):
        for url_name in ("organization:list-projects", "organization:events-upcoming"):
            for radius in ("abc", "-5", "nan"):
                with self.subTest(url_name=url_name, radius=radius):
                    response = self.client.get(
                        reverse(url_name), {**ERLANGEN_OSM, "radius": radius}
                    )
                    self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                    self.assertIn("radius", response.data)
        mock_get.assert_not_called()

    @patch("location.utility.requests.get")
    def test_browse_unresolvable_location_keeps_original_400(self, mock_get):
        mock_get.return_value.status_code = 404
        mock_get.return_value.text = "not found"
        response = self.client.get(
            reverse("organization:list-projects"),
            {"osm_id": "999999", "osm_type": "relation", "osm_class": "x"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn("location", response.data)

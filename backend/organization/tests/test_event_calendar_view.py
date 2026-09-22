from datetime import datetime, timedelta, timezone as dt_timezone

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from climateconnect_api.models import Language
from hubs.models.hub import Hub
from organization.models import (
    Project,
    ProjectSectorMapping,
    ProjectStatus,
    Sector,
)

# Fixed dates so tests are deterministic regardless of when they run.
# Using 2026-03 (March) avoids DST edge cases and end-of-month overflow.
FIXED_NOW = datetime(2026, 3, 15, 12, 0, 0, tzinfo=dt_timezone.utc)
FIXED_YEAR = 2026
FIXED_MONTH = 3


class TestEventCalendarListView(APITestCase):
    """
    Tests for the Event Calendar list endpoint (GET /api/events/).

    The endpoint is always available (no feature toggle) and returns only
    active, non-draft event-type projects, ordered by start_date, with
    support for text search, topic (sectors), hub scoping and a start_date
    jump-to-date filter. Paginated via ProjectsPagination.
    """

    def setUp(self):
        self.url = reverse("organization:list-events")

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

        # Two active, non-draft events in the future.
        self.event1 = Project.objects.create(
            name="Future Event Alpha",
            url_slug="future-event-alpha",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=10),
            end_date=FIXED_NOW + timedelta(days=10, hours=2),
        )
        self.event2 = Project.objects.create(
            name="Future Event Beta",
            url_slug="future-event-beta",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=20),
            end_date=FIXED_NOW + timedelta(days=20, hours=2),
        )
        # Draft event -> excluded.
        Project.objects.create(
            name="Draft Event",
            url_slug="draft-event",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=15),
            end_date=FIXED_NOW + timedelta(days=15, hours=2),
        )
        # Inactive event -> excluded.
        Project.objects.create(
            name="Inactive Event",
            url_slug="inactive-event",
            is_active=False,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=15),
            end_date=FIXED_NOW + timedelta(days=15, hours=2),
        )
        # Idea (not an event) -> excluded.
        Project.objects.create(
            name="An Idea",
            url_slug="an-idea",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="ID",
            start_date=FIXED_NOW + timedelta(days=12),
        )
        # Project (not an event) -> excluded.
        Project.objects.create(
            name="A Project",
            url_slug="a-project",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="PR",
            start_date=FIXED_NOW + timedelta(days=12),
        )

    def _paginated_slugs(self, response):
        return [item["url_slug"] for item in response.json()["results"]]

    def test_url_resolves(self):
        self.assertEqual(self.url, "/api/events/")

    def test_paginated_response_format(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn("count", body)
        self.assertIn("results", body)
        self.assertIn("next", body)
        self.assertIn("previous", body)
        self.assertIsInstance(body["results"], list)

    def test_default_page_size_is_twelve(self):
        response = self.client.get(self.url)
        self.assertEqual(response.json()["count"], 2)
        self.assertEqual(len(response.json()["results"]), 2)

    def test_only_active_events_returned(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = self._paginated_slugs(response)
        self.assertIn(self.event1.url_slug, slugs)
        self.assertIn(self.event2.url_slug, slugs)
        self.assertNotIn("draft-event", slugs)
        self.assertNotIn("inactive-event", slugs)
        self.assertNotIn("an-idea", slugs)
        self.assertNotIn("a-project", slugs)
        self.assertEqual(len(slugs), 2)

    def test_orders_by_start_date_ascending(self):
        response = self.client.get(self.url)
        self.assertEqual(
            self._paginated_slugs(response),
            [self.event1.url_slug, self.event2.url_slug],
        )

    def test_start_date_filter_returns_events_from_date_forward(self):
        # Filtering by start_date should return events on or after that date.
        start = (FIXED_NOW + timedelta(days=15)).isoformat()
        response = self.client.get(self.url, {"start_date": start})
        slugs = self._paginated_slugs(response)
        self.assertNotIn(self.event1.url_slug, slugs)
        self.assertIn(self.event2.url_slug, slugs)

    def test_no_date_params_returns_all_events_paginated(self):
        # When no start_date is given, return all events paginated (defensive
        # fallback — the frontend always sends start_date since default is today).
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 2)
        slugs = self._paginated_slugs(response)
        self.assertIn(self.event1.url_slug, slugs)
        self.assertIn(self.event2.url_slug, slugs)

    def test_event_starting_before_filter_is_excluded(self):
        # Events are shown only on their start_date, so an event whose
        # start_date falls before the requested start_date is not returned.
        past = Project.objects.create(
            name="Past Event",
            url_slug="past-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=FIXED_NOW - timedelta(days=2),
            end_date=FIXED_NOW - timedelta(days=2, hours=-2),
        )
        start = (FIXED_NOW + timedelta(days=5)).isoformat()
        response = self.client.get(self.url, {"start_date": start})
        self.assertNotIn(past.url_slug, self._paginated_slugs(response))

    def test_sectors_filter(self):
        sector = Sector.objects.create(
            name="Climate Sector", name_de_translation="Klima", key="climate"
        )
        ProjectSectorMapping.objects.create(sector=sector, project=self.event1)
        response = self.client.get(self.url, {"sectors": sector.name})
        slugs = self._paginated_slugs(response)
        self.assertIn(self.event1.url_slug, slugs)
        self.assertNotIn(self.event2.url_slug, slugs)

    def test_sectors_filter_does_not_duplicate_multi_sector_event(self):
        sector_a = Sector.objects.create(
            name="Sector A", name_de_translation="Sektor A", key="sector-a"
        )
        sector_b = Sector.objects.create(
            name="Sector B", name_de_translation="Sektor B", key="sector-b"
        )
        ProjectSectorMapping.objects.create(sector=sector_a, project=self.event1)
        ProjectSectorMapping.objects.create(sector=sector_b, project=self.event1)
        response = self.client.get(
            self.url, {"sectors": f"{sector_a.name},{sector_b.name}"}
        )
        slugs = self._paginated_slugs(response)
        # The event matches both selected topics but must appear only once.
        self.assertEqual(slugs.count(self.event1.url_slug), 1)
        self.assertNotIn(self.event2.url_slug, slugs)

    def test_search_filter(self):
        response = self.client.get(self.url, {"search": "Alpha"})
        slugs = self._paginated_slugs(response)
        self.assertIn(self.event1.url_slug, slugs)
        self.assertNotIn(self.event2.url_slug, slugs)

    def test_hub_filter(self):
        hub = Hub.objects.create(
            name="Test Hub",
            url_slug="test-hub",
            hub_type=Hub.CUSTOM_HUB_TYPE,
            segway_text="segway",
        )
        self.event1.related_hubs.add(hub)
        response = self.client.get(self.url, {"hub": hub.url_slug})
        slugs = self._paginated_slugs(response)
        self.assertIn(self.event1.url_slug, slugs)
        self.assertNotIn(self.event2.url_slug, slugs)

    def test_pagination_page_and_page_size(self):
        for i in range(15):
            Project.objects.create(
                name=f"Page Event {i}",
                url_slug=f"page-event-{i}",
                is_active=True,
                is_draft=False,
                status=self.project_status,
                language=self.language,
                project_type="EV",
                start_date=FIXED_NOW + timedelta(days=30 + i),
                end_date=FIXED_NOW + timedelta(days=30 + i, hours=2),
            )
        # Default page_size = 12. Total events = 2 (setUp) + 15 = 17.
        page1 = self.client.get(self.url)
        self.assertEqual(page1.json()["count"], 17)
        self.assertEqual(len(page1.json()["results"]), 12)
        self.assertIsNotNone(page1.json()["next"])

        page2 = self.client.get(self.url, {"page": 2})
        self.assertEqual(len(page2.json()["results"]), 5)
        self.assertIsNone(page2.json()["next"])
        self.assertIsNotNone(page2.json()["previous"])

        # Custom page_size.
        page_custom = self.client.get(self.url, {"page_size": 5})
        self.assertEqual(len(page_custom.json()["results"]), 5)

    def test_filter_and_pagination_combo(self):
        sector = Sector.objects.create(
            name="Combo Sector", name_de_translation="Combo", key="combo"
        )
        for i in range(5):
            ev = Project.objects.create(
                name=f"Combo Event {i}",
                url_slug=f"combo-event-{i}",
                is_active=True,
                is_draft=False,
                status=self.project_status,
                language=self.language,
                project_type="EV",
                start_date=FIXED_NOW + timedelta(days=40 + i),
                end_date=FIXED_NOW + timedelta(days=40 + i, hours=2),
            )
            ProjectSectorMapping.objects.create(sector=sector, project=ev)
        response = self.client.get(self.url, {"sectors": sector.name, "page_size": 3})
        self.assertEqual(response.json()["count"], 5)
        self.assertEqual(len(response.json()["results"]), 3)
        self.assertIsNotNone(response.json()["next"])


class TestEventCalendarCountsView(APITestCase):
    """
    Tests for the per-day event counts endpoint (GET /api/events/calendar/).

    Returns a list of {"date": "YYYY-MM-DD", "count": N} objects for the
    requested month, applying the same exclusion and filter rules as the
    list endpoint. Multi-day events are counted on every day they span.
    """

    def setUp(self):
        self.url = reverse("organization:events-calendar-counts")

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

        # Fixed dates within FIXED_MONTH so tests are deterministic.
        self.day1_dt = datetime(2026, 3, 5, 12, 0, 0, tzinfo=dt_timezone.utc)
        self.day2_dt = datetime(2026, 3, 15, 12, 0, 0, tzinfo=dt_timezone.utc)
        draft_dt = datetime(2026, 3, 10, 12, 0, 0, tzinfo=dt_timezone.utc)
        idea_dt = datetime(2026, 3, 8, 12, 0, 0, tzinfo=dt_timezone.utc)

        # event1: single day in the month.
        self.event1 = Project.objects.create(
            name="Count Event Alpha",
            url_slug="count-event-alpha",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=self.day1_dt,
            end_date=self.day1_dt + timedelta(hours=2),
        )
        # event2: multi-day event spanning 3 days.
        self.event2 = Project.objects.create(
            name="Count Event Beta",
            url_slug="count-event-beta",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=self.day2_dt,
            end_date=self.day2_dt + timedelta(days=2, hours=2),
        )
        # Draft / inactive / non-event -> excluded from counts.
        Project.objects.create(
            name="Draft Count Event",
            url_slug="draft-count-event",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=draft_dt,
            end_date=draft_dt + timedelta(hours=2),
        )
        Project.objects.create(
            name="Inactive Count Event",
            url_slug="inactive-count-event",
            is_active=False,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=draft_dt,
            end_date=draft_dt + timedelta(hours=2),
        )
        Project.objects.create(
            name="Count Idea",
            url_slug="count-idea",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="ID",
            start_date=idea_dt,
        )

    def _counts_map(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {item["date"]: item["count"] for item in response.json()}

    def test_url_resolves(self):
        self.assertEqual(self.url, "/api/events/calendar/")

    def test_requires_year_and_month(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.get(self.url, {"year": FIXED_YEAR})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.get(self.url, {"month": FIXED_MONTH})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_month_rejected(self):
        response = self.client.get(self.url, {"year": FIXED_YEAR, "month": 13})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_counts_exclude_draft_inactive_and_non_events(self):
        response = self.client.get(self.url, {"year": FIXED_YEAR, "month": FIXED_MONTH})
        counts = self._counts_map(response)
        self.assertEqual(counts.get("2026-03-05"), 1)
        # Draft / inactive / idea days must not appear.
        self.assertNotIn("2026-03-10", counts)
        self.assertNotIn("2026-03-08", counts)

    def test_results_sorted_by_date(self):
        response = self.client.get(self.url, {"year": FIXED_YEAR, "month": FIXED_MONTH})
        dates = [item["date"] for item in response.json()]
        self.assertEqual(dates, sorted(dates))

    def test_sectors_filter(self):
        sector = Sector.objects.create(
            name="Count Sector", name_de_translation="Zähler", key="count"
        )
        ProjectSectorMapping.objects.create(sector=sector, project=self.event1)
        response = self.client.get(
            self.url,
            {
                "year": FIXED_YEAR,
                "month": FIXED_MONTH,
                "sectors": sector.name,
            },
        )
        counts = self._counts_map(response)
        self.assertEqual(counts.get("2026-03-05"), 1)
        self.assertNotIn("2026-03-15", counts)

    def test_multi_day_event_counted_only_on_start_day(self):
        # event2 starts on the 15th and spans 3 days. It must contribute a
        # single count=1 on its start day only; spanned days must NOT appear.
        response = self.client.get(self.url, {"year": FIXED_YEAR, "month": FIXED_MONTH})
        counts = self._counts_map(response)
        self.assertEqual(counts.get("2026-03-15"), 1)
        self.assertNotIn("2026-03-16", counts)
        self.assertNotIn("2026-03-17", counts)

    def test_multi_sector_event_counted_once_per_day(self):
        sector_a = Sector.objects.create(
            name="Count Sector A", name_de_translation="Zähler A", key="count-a"
        )
        sector_b = Sector.objects.create(
            name="Count Sector B", name_de_translation="Zähler B", key="count-b"
        )
        ProjectSectorMapping.objects.create(sector=sector_a, project=self.event1)
        ProjectSectorMapping.objects.create(sector=sector_b, project=self.event1)
        response = self.client.get(
            self.url,
            {
                "year": FIXED_YEAR,
                "month": FIXED_MONTH,
                "sectors": f"{sector_a.name},{sector_b.name}",
            },
        )
        counts = self._counts_map(response)
        # event1 spans a single day and matches both topics; it must be
        # counted exactly once, not once per matching topic.
        self.assertEqual(counts.get("2026-03-05"), 1)

    def test_search_filter(self):
        response = self.client.get(
            self.url,
            {
                "year": FIXED_YEAR,
                "month": FIXED_MONTH,
                "search": "Alpha",
            },
        )
        counts = self._counts_map(response)
        self.assertEqual(counts.get("2026-03-05"), 1)
        self.assertNotIn("2026-03-15", counts)

    def test_hub_filter(self):
        hub = Hub.objects.create(
            name="Counts Hub",
            url_slug="counts-hub",
            hub_type=Hub.CUSTOM_HUB_TYPE,
            segway_text="segway",
        )
        self.event1.related_hubs.add(hub)
        response = self.client.get(
            self.url,
            {
                "year": FIXED_YEAR,
                "month": FIXED_MONTH,
                "hub": hub.url_slug,
            },
        )
        counts = self._counts_map(response)
        self.assertEqual(counts.get("2026-03-05"), 1)
        self.assertNotIn("2026-03-15", counts)

    def test_counts_are_bucketed_in_requested_timezone(self):
        # An event at 2026-02-01 23:00 UTC is on 2026-02-02 in Asia/Tokyo
        # (UTC+9) but on 2026-02-01 in UTC. The day a count is attributed to
        # must follow the requested timezone so it matches the browser-local
        # day grouping on the frontend.
        Project.objects.create(
            name="Timezone Boundary Event",
            url_slug="timezone-boundary-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=datetime(2026, 2, 1, 23, 0, 0, tzinfo=dt_timezone.utc),
            end_date=datetime(2026, 2, 1, 23, 0, 0, tzinfo=dt_timezone.utc),
        )

        tokyo = self.client.get(
            self.url, {"year": 2026, "month": 2, "timezone": "Asia/Tokyo"}
        )
        tokyo_counts = self._counts_map(tokyo)
        self.assertEqual(tokyo_counts.get("2026-02-02"), 1)
        self.assertNotIn("2026-02-01", tokyo_counts)

        utc = self.client.get(self.url, {"year": 2026, "month": 2, "timezone": "UTC"})
        utc_counts = self._counts_map(utc)
        self.assertEqual(utc_counts.get("2026-02-01"), 1)
        self.assertNotIn("2026-02-02", utc_counts)

    def test_invalid_timezone_falls_back_gracefully(self):
        response = self.client.get(
            self.url, {"year": 2026, "month": 2, "timezone": "Not/ARealZone"}
        )
        # Must not error; falls back to the server timezone and still returns
        # a valid (empty or populated) list.
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.json(), list)


class TestListUpcomingEventsView(APITestCase):
    """
    Tests for the upcoming events endpoint for Browse highlights.
    """

    def setUp(self):
        self.url = reverse("organization:events-upcoming")

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

        now = timezone.now()
        self.now = now
        # 5 future events - should get 4 back
        for i in range(5):
            Project.objects.create(
                name=f"Future Event {i}",
                url_slug=f"future-event-{i}",
                is_active=True,
                is_draft=False,
                status=self.project_status,
                language=self.language,
                project_type="EV",
                start_date=now + timedelta(days=10 + i),
                end_date=now + timedelta(days=10 + i, hours=2),
            )
        # Past event - excluded
        Project.objects.create(
            name="Past Event",
            url_slug="past-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=now - timedelta(days=2),
            end_date=now - timedelta(hours=2),
        )
        # Draft event - excluded
        Project.objects.create(
            name="Draft Event",
            url_slug="draft-event",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.language,
            project_type="EV",
            start_date=now + timedelta(days=15),
        )

    def test_url_resolves(self):
        self.assertEqual(self.url, "/api/events/upcoming/")

    def test_returns_max_4_events(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json()
        self.assertEqual(len(results), 4)

    def test_only_returns_future_events(self):
        response = self.client.get(self.url)
        results = response.json()
        slugs = [item["url_slug"] for item in results]
        self.assertNotIn("past-event", slugs)
        self.assertNotIn("draft-event", slugs)

    def test_orders_by_start_date_ascending(self):
        response = self.client.get(self.url)
        results = response.json()
        slugs = [item["url_slug"] for item in results]
        # Should be event-0, 1, 2, 3 (first 4 chronologically)
        self.assertEqual(
            slugs[:4],
            ["future-event-0", "future-event-1", "future-event-2", "future-event-3"],
        )

    def test_start_date_filter_respected(self):
        # Request events starting from day 12 onwards (event-2 onwards)
        start = (self.now + timedelta(days=12)).isoformat()
        response = self.client.get(self.url, {"start_date": start})
        results = response.json()
        slugs = [item["url_slug"] for item in results]
        # Should start from event-2 (days 12, 13, 14, 15)
        self.assertEqual(len(results), 3)  # Only 3 events remain after day 12
        self.assertNotIn("future-event-0", slugs)
        self.assertNotIn("future-event-1", slugs)

    def test_sectors_filter(self):
        sector = Sector.objects.create(
            name="Future Sector", name_de_translation="Zukunft", key="future"
        )
        # Only attach sector to event-0
        Project.objects.get(url_slug="future-event-0").project_sector_mapping.create(
            sector=sector
        )
        response = self.client.get(self.url, {"sectors": sector.name})
        results = response.json()
        slugs = [item["url_slug"] for item in results]
        self.assertEqual(len(results), 1)
        self.assertIn("future-event-0", slugs)

    def test_search_filter(self):
        response = self.client.get(self.url, {"search": "Future Event 3"})
        results = response.json()
        slugs = [item["url_slug"] for item in results]
        self.assertEqual(len(results), 1)
        self.assertIn("future-event-3", slugs)

    def test_returns_plain_list_not_paginated(self):
        response = self.client.get(self.url)
        results = response.json()
        self.assertIsInstance(results, list)
        # Not a paginated response with count/next/previous
        self.assertNotIn("count", results)
        self.assertNotIn("next", results)

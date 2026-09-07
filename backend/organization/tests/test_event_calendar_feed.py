from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
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
from organization.utility.ical_feed import (
    canonicalize_query,
    sign_feed_token,
    verify_feed_token,
)

FIXED_NOW = datetime(2026, 3, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


class TestEventFeedToken(TestCase):
    def test_round_trip(self):
        canonical = canonicalize_query({"hub": "berlin", "lang": "en"})
        token = sign_feed_token(canonical)
        self.assertTrue(verify_feed_token(canonical, token))

    def test_tampered_rejected(self):
        canonical = canonicalize_query({"hub": "berlin"})
        token = sign_feed_token(canonical)
        tampered = token[:-4] + "XXXX"
        self.assertFalse(verify_feed_token(canonical, tampered))

    def test_extra_params_rejected_on_verify(self):
        canonical = canonicalize_query({"hub": "berlin"})
        token = sign_feed_token(canonical)
        canonical_extra = canonicalize_query({"hub": "berlin", "sectors": "energy"})
        self.assertFalse(verify_feed_token(canonical_extra, token))

    def test_canonical_query_stable(self):
        a = canonicalize_query(
            {"hub": "Berlin", "sectors": "Energy,Food", "lang": "EN"}
        )
        b = canonicalize_query(
            {"hub": "Berlin", "sectors": "Energy,Food", "lang": "EN"}
        )
        self.assertEqual(a, b)

    def test_canonical_query_normalizes_sectors(self):
        a = canonicalize_query({"sectors": "Energy,Food,energy"})
        b = canonicalize_query({"sectors": "energy,food"})
        self.assertEqual(a, b)

    def test_canonical_query_normalizes_hub_case(self):
        a = canonicalize_query({"hub": "Berlin"})
        b = canonicalize_query({"hub": "berlin"})
        self.assertEqual(a, b)

    def test_canonical_query_normalizes_lang_case(self):
        a = canonicalize_query({"lang": "EN"})
        b = canonicalize_query({"lang": "en"})
        self.assertEqual(a, b)

    def test_canonical_query_strips_unknown_keys(self):
        canonical = canonicalize_query({"hub": "berlin", "evil": "param"})
        self.assertNotIn("evil", canonical)

    def test_canonical_query_excludes_token(self):
        canonical = canonicalize_query({"hub": "berlin", "token": "some-token"})
        self.assertNotIn("token", canonical)

    def test_empty_params_produces_empty_string(self):
        self.assertEqual(canonicalize_query({}), "")

    def test_none_and_empty_values_excluded(self):
        canonical = canonicalize_query({"hub": "berlin", "search": "", "sectors": None})
        self.assertEqual(canonical, "hub=berlin")


@override_settings(ICAL_FEED_SIGNING_KEY="test-signing-key-for-unit-tests")
class TestEventCalendarFeed(APITestCase):
    def setUp(self):
        self.url = reverse("organization:events-feed-ics")
        self.token_url = reverse("organization:event-feed-token")

        self.project_status, _ = ProjectStatus.objects.update_or_create(
            id=2,
            defaults={
                "name": "active",
                "name_de_translation": "aktiv",
                "has_end_date": True,
                "has_start_date": True,
            },
        )
        self.language_en, _ = Language.objects.get_or_create(
            language_code="en",
            defaults={"name": "English", "native_name": "English"},
        )
        self.language_de, _ = Language.objects.get_or_create(
            language_code="de",
            defaults={"name": "German", "native_name": "Deutsch"},
        )

        self.event1 = Project.objects.create(
            name="Future Event Alpha",
            url_slug="future-event-alpha",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language_en,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=10),
            end_date=FIXED_NOW + timedelta(days=10, hours=2),
            short_description="A great event",
        )
        self.event2 = Project.objects.create(
            name="Future Event Beta",
            url_slug="future-event-beta",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language_en,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=20),
            end_date=FIXED_NOW + timedelta(days=20, hours=2),
            short_description="Another event",
        )
        self.past_event = Project.objects.create(
            name="Past Event",
            url_slug="past-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language_en,
            project_type="EV",
            start_date=FIXED_NOW - timedelta(days=5),
            end_date=FIXED_NOW - timedelta(days=5, hours=2),
        )
        Project.objects.create(
            name="Draft Event",
            url_slug="draft-event",
            is_active=True,
            is_draft=True,
            status=self.project_status,
            language=self.language_en,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=15),
            end_date=FIXED_NOW + timedelta(days=15, hours=2),
        )
        Project.objects.create(
            name="Inactive Event",
            url_slug="inactive-event",
            is_active=False,
            is_draft=False,
            status=self.project_status,
            language=self.language_en,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=15),
            end_date=FIXED_NOW + timedelta(days=15, hours=2),
        )
        Project.objects.create(
            name="An Idea",
            url_slug="an-idea",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language_en,
            project_type="ID",
            start_date=FIXED_NOW + timedelta(days=12),
        )

        self.hub = Hub.objects.create(
            name="Berlin",
            url_slug="berlin",
            hub_type=Hub.CUSTOM_HUB_TYPE,
            segway_text="test",
        )

        self.sector = Sector.objects.create(
            name="Test Energy", name_de_translation="Test Energie", key="test_energy"
        )
        ProjectSectorMapping.objects.create(project=self.event1, sector=self.sector)

    def _signed_url(self, params=None):
        if params is None:
            params = {}
        canonical = canonicalize_query(params)
        token = sign_feed_token(canonical)
        all_params = {**params, "token": token}
        qs = "&".join(f"{k}={v}" for k, v in sorted(all_params.items()))
        return f"{self.url}?{qs}"

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_valid_signed_request_returns_200(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/calendar", response["Content-Type"])

    def test_missing_token_returns_403(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_token_returns_403(self):
        url = f"{self.url}?hub=berlin&token=invalid.token"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_extra_query_params_returns_403(self):
        canonical = canonicalize_query({"hub": "berlin"})
        token = sign_feed_token(canonical)
        url = f"{self.url}?hub=berlin&sectors=energy&token={token}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_invalid_hub_returns_200_empty_calendar(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url({"hub": "nonexistent"})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/calendar", response["Content-Type"])
        body = response.content.decode()
        self.assertNotIn("VEVENT", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_default_window_excludes_past_events(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertNotIn("Past Event", body)
        self.assertIn("Future Event Alpha", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_default_window_caps_at_12_months(self, mock_now):
        mock_now.return_value = FIXED_NOW
        far_future = Project.objects.create(
            name="Far Future Event",
            url_slug="far-future-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language_en,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=400),
            end_date=FIXED_NOW + timedelta(days=400, hours=2),
        )
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertNotIn("Far Future Event", body)
        far_future.delete()

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_date_param_includes_past_events(self, mock_now):
        mock_now.return_value = FIXED_NOW
        past_date = (FIXED_NOW - timedelta(days=10)).strftime("%Y-%m-%d")
        url = self._signed_url({"date": past_date})
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("Past Event", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_date_param_no_upper_cap(self, mock_now):
        mock_now.return_value = FIXED_NOW
        far_future = Project.objects.create(
            name="Far Future Event",
            url_slug="far-future-event",
            is_active=True,
            is_draft=False,
            status=self.project_status,
            language=self.language_en,
            project_type="EV",
            start_date=FIXED_NOW + timedelta(days=400),
            end_date=FIXED_NOW + timedelta(days=400, hours=2),
        )
        past_date = (FIXED_NOW - timedelta(days=10)).strftime("%Y-%m-%d")
        url = self._signed_url({"date": past_date})
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("Far Future Event", body)
        far_future.delete()

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_hub_filter(self, mock_now):
        mock_now.return_value = FIXED_NOW
        self.event1.related_hubs.add(self.hub)
        url = self._signed_url({"hub": "berlin"})
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("Future Event Alpha", body)
        self.assertNotIn("Future Event Beta", body)
        self.event1.related_hubs.remove(self.hub)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_sectors_filter(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url({"sectors": "Test Energy"})
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("Future Event Alpha", body)
        self.assertNotIn("Future Event Beta", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_search_filter(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url({"search": "Alpha"})
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("Future Event Alpha", body)
        self.assertNotIn("Future Event Beta", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_exclusion_rules(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertNotIn("Draft Event", body)
        self.assertNotIn("Inactive Event", body)
        self.assertNotIn("An Idea", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_uid_format(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn(f"UID:{self.event1.id}@climatehub.org", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_prodid(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("-//Climate Hub Network//EN", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_x_wr_calname(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url({"hub": "berlin"})
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("X-WR-CALNAME", body)
        self.assertIn("Berlin", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_x_wr_caldesc_populated(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url({"hub": "berlin", "search": "test"})
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("X-WR-CALDESC", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_cache_control_header(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        self.assertEqual(response["Cache-Control"], "public, max-age=3600")

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_events_sorted_by_dtstart(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        alpha_pos = body.find("Future Event Alpha")
        beta_pos = body.find("Future Event Beta")
        self.assertLess(alpha_pos, beta_pos)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_lang_en_vs_de_produces_different_content(self, mock_now):
        mock_now.return_value = FIXED_NOW
        self.event1.name = "Zukunftsereignis Alpha"
        self.event1.language = self.language_de
        self.event1.save()
        from organization.models.translations import ProjectTranslation

        ProjectTranslation.objects.create(
            project=self.event1,
            language=self.language_en,
            name_translation="Future Event Alpha",
            short_description_translation="A great event",
        )

        url_en = self._signed_url({"lang": "en"})
        url_de = self._signed_url({"lang": "de"})
        resp_en = self.client.get(url_en)
        resp_de = self.client.get(url_de)
        self.assertIn("Future Event Alpha", resp_en.content.decode())
        self.assertIn("Zukunftsereignis Alpha", resp_de.content.decode())

        self.event1.name = "Future Event Alpha"
        self.event1.language = self.language_en
        self.event1.save()

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_lang_absent_falls_back_to_language_code(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("Future Event Alpha", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_sequence_and_last_modified(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("SEQUENCE:", body)
        self.assertIn("LAST-MODIFIED:", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_published_ttl_in_body(self, mock_now):
        mock_now.return_value = FIXED_NOW
        url = self._signed_url()
        response = self.client.get(url)
        body = response.content.decode()
        self.assertIn("X-PUBLISHED-TTL:PT1H", body)
        self.assertIn("REFRESH-INTERVAL", body)

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_token_endpoint_returns_url(self, mock_now):
        mock_now.return_value = FIXED_NOW
        response = self.client.post(
            self.token_url,
            data={"hub": "berlin", "lang": "en"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn("url", body)
        self.assertIn("token=", body["url"])
        self.assertIn("hub=berlin", body["url"])
        self.assertIn("lang=en", body["url"])

    @patch("organization.views.event_calendar_feed_views.timezone.now")
    def test_token_endpoint_roundtrip(self, mock_now):
        mock_now.return_value = FIXED_NOW
        response = self.client.post(
            self.token_url,
            data={"hub": "berlin", "lang": "en"},
            format="json",
        )
        url = response.json()["url"]
        # Extract query string from the frontend URL and use the Django feed URL
        qs = url.split("?", 1)[1] if "?" in url else ""
        feed_response = self.client.get(f"{self.url}?{qs}")
        self.assertEqual(feed_response.status_code, status.HTTP_200_OK)
        self.assertIn("text/calendar", feed_response["Content-Type"])

import calendar
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone as tz
from rest_framework import status
from rest_framework.test import APITestCase

from location.models import AutocompletePeriodStats, AutocompleteRequestLog
from location.tasks import (
    _get_period_keys_for_dt,
    aggregate_autocomplete_stats,
    log_autocomplete_request,
)

User = get_user_model()


def _minute_key(dt):
    ts = calendar.timegm(dt.timetuple())
    return ts // 60


class TestGetPeriodKeysForDt(TestCase):
    """Tests for the _get_period_keys_for_dt() helper."""

    def test_iso_year_boundary_dec_29(self):
        dt = datetime(2025, 12, 29, 12, 0, 0, tzinfo=timezone.utc)
        periods = _get_period_keys_for_dt(dt)
        week_entry = [p for p in periods if p[0] == "week"][0]

        self.assertEqual(week_entry[1], "2026-W01")

    def test_returns_day_week_month(self):
        dt = tz.now()
        periods = _get_period_keys_for_dt(dt)

        period_types = [p[0] for p in periods]
        self.assertEqual(period_types, ["day", "week", "month"])

    def test_period_key_formats(self):
        dt = datetime(2026, 6, 11, 14, 30, 0, tzinfo=timezone.utc)
        periods = _get_period_keys_for_dt(dt)
        by_type = {p[0]: p[1] for p in periods}

        self.assertEqual(by_type["day"], "2026-06-11")
        self.assertEqual(by_type["week"], "2026-W24")
        self.assertEqual(by_type["month"], "2026-06")


class TestAggregateNominatimStats(TestCase):
    """Tests for the aggregate_autocomplete_stats Celery task."""

    def setUp(self):
        AutocompletePeriodStats.objects.all().delete()
        AutocompleteRequestLog.objects.all().delete()

    def test_single_request_creates_all_period_rows(self):
        AutocompleteRequestLog.objects.create(minute_key=_minute_key(tz.now()))

        aggregate_autocomplete_stats()

        now = tz.now()
        periods = _get_period_keys_for_dt(now)

        for period_type, period_key, _ in periods:
            stats = AutocompletePeriodStats.objects.get(
                period_type=period_type, period_key=period_key
            )
            self.assertEqual(stats.total_requests, 1)
            self.assertGreater(stats.avg_req_per_second, 0)
            self.assertEqual(stats.peak_req_per_second, 1)

    def test_60_requests_in_same_second(self):
        now = tz.now()
        mk = _minute_key(now)
        for _ in range(60):
            AutocompleteRequestLog.objects.create(created_at=now, minute_key=mk)

        aggregate_autocomplete_stats()

        periods = _get_period_keys_for_dt(now)

        for period_type, period_key, _ in periods:
            stats = AutocompletePeriodStats.objects.get(
                period_type=period_type, period_key=period_key
            )
            self.assertEqual(stats.total_requests, 60)
            self.assertEqual(stats.peak_req_per_second, 60)

    def test_requests_across_seconds_peak_is_max(self):
        base = tz.now().replace(microsecond=0)
        second1 = base
        second2 = base + timedelta(seconds=1)
        mk = _minute_key(base)

        for _ in range(30):
            AutocompleteRequestLog.objects.create(created_at=second1, minute_key=mk)
        for _ in range(10):
            AutocompleteRequestLog.objects.create(created_at=second2, minute_key=mk)

        aggregate_autocomplete_stats()

        periods = _get_period_keys_for_dt(base)
        for period_type, period_key, _ in periods:
            stats = AutocompletePeriodStats.objects.get(
                period_type=period_type, period_key=period_key
            )
            self.assertEqual(stats.total_requests, 40)
            self.assertEqual(stats.peak_req_per_second, 30)

    def test_log_rows_marked_processed_after_aggregation(self):
        now = tz.now()
        mk = _minute_key(now)
        AutocompleteRequestLog.objects.create(minute_key=mk)
        AutocompleteRequestLog.objects.create(minute_key=mk)

        aggregate_autocomplete_stats()

        self.assertEqual(AutocompleteRequestLog.objects.count(), 2)
        self.assertEqual(
            AutocompleteRequestLog.objects.filter(processed=True).count(), 2
        )

    def test_only_unprocessed_rows_aggregated(self):
        now = tz.now()
        mk = _minute_key(now)
        AutocompleteRequestLog.objects.create(
            created_at=now, processed=True, minute_key=mk
        )
        AutocompleteRequestLog.objects.create(
            created_at=now, processed=False, minute_key=mk
        )

        aggregate_autocomplete_stats()

        periods = _get_period_keys_for_dt(now)
        for period_type, period_key, _ in periods:
            stats = AutocompletePeriodStats.objects.get(
                period_type=period_type, period_key=period_key
            )
            self.assertEqual(stats.total_requests, 1)

    def test_old_rows_cleaned_up_after_7_days(self):
        now = tz.now()
        old_dt = now - timedelta(days=8)
        AutocompleteRequestLog.objects.create(
            created_at=old_dt, processed=True, minute_key=_minute_key(old_dt)
        )
        AutocompleteRequestLog.objects.create(
            created_at=now, minute_key=_minute_key(now)
        )

        aggregate_autocomplete_stats()

        self.assertEqual(AutocompleteRequestLog.objects.count(), 1)
        self.assertTrue(
            AutocompleteRequestLog.objects.filter(
                created_at=now, processed=True
            ).exists()
        )

    def test_empty_log_does_nothing(self):
        aggregate_autocomplete_stats()

        self.assertEqual(AutocompletePeriodStats.objects.count(), 0)

    def test_new_iso_week_creates_new_row(self):
        fixed_dt = datetime(2026, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        AutocompleteRequestLog.objects.create(
            created_at=fixed_dt, minute_key=_minute_key(fixed_dt)
        )

        aggregate_autocomplete_stats()

        stats = AutocompletePeriodStats.objects.get(
            period_type="week", period_key="2026-W25"
        )
        self.assertEqual(stats.total_requests, 1)

    def test_first_of_month_creates_new_row(self):
        fixed_dt = datetime(2026, 7, 1, 12, 0, 0, tzinfo=timezone.utc)
        AutocompleteRequestLog.objects.create(
            created_at=fixed_dt, minute_key=_minute_key(fixed_dt)
        )

        aggregate_autocomplete_stats()

        stats = AutocompletePeriodStats.objects.get(
            period_type="month", period_key="2026-07"
        )
        self.assertEqual(stats.total_requests, 1)

    def test_incremental_aggregation(self):
        now = tz.now()
        mk = _minute_key(now)
        for _ in range(3):
            AutocompleteRequestLog.objects.create(created_at=now, minute_key=mk)

        aggregate_autocomplete_stats()

        for _ in range(2):
            AutocompleteRequestLog.objects.create(created_at=now, minute_key=mk)

        aggregate_autocomplete_stats()

        periods = _get_period_keys_for_dt(now)
        for period_type, period_key, _ in periods:
            stats = AutocompletePeriodStats.objects.get(
                period_type=period_type, period_key=period_key
            )
            self.assertEqual(stats.total_requests, 5)


class TestAggregateNominatimStatsByProvider(TestCase):
    """
    aggregate_autocomplete_stats() must keep LocationIQ and Nominatim apart:
    one AutocompletePeriodStats row per (period, provider), with each row's
    peak_req_per_second counting only that provider's requests — that is what
    makes the number usable for watching LocationIQ's 2 req/s ceiling.
    """

    def setUp(self):
        AutocompletePeriodStats.objects.all().delete()
        AutocompleteRequestLog.objects.all().delete()

    def test_providers_get_separate_rows(self):
        now = tz.now()
        mk = _minute_key(now)
        for _ in range(3):
            AutocompleteRequestLog.objects.create(
                created_at=now, minute_key=mk, provider="locationiq"
            )
        AutocompleteRequestLog.objects.create(
            created_at=now, minute_key=mk, provider="nominatim"
        )

        aggregate_autocomplete_stats()

        for period_type, period_key, _ in _get_period_keys_for_dt(now):
            self.assertEqual(
                AutocompletePeriodStats.objects.get(
                    period_type=period_type,
                    period_key=period_key,
                    provider="locationiq",
                ).total_requests,
                3,
            )
            self.assertEqual(
                AutocompletePeriodStats.objects.get(
                    period_type=period_type,
                    period_key=period_key,
                    provider="nominatim",
                ).total_requests,
                1,
            )

    def test_peak_per_second_is_counted_per_provider(self):
        # 3 LocationIQ + 5 Nominatim requests in the *same* second. The
        # LocationIQ peak must be 3, not 8 — otherwise Nominatim fallback
        # traffic would look like a LocationIQ rate-limit breach.
        second = tz.now().replace(microsecond=0)
        mk = _minute_key(second)
        for _ in range(3):
            AutocompleteRequestLog.objects.create(
                created_at=second, minute_key=mk, provider="locationiq"
            )
        for _ in range(5):
            AutocompleteRequestLog.objects.create(
                created_at=second, minute_key=mk, provider="nominatim"
            )

        aggregate_autocomplete_stats()

        day_key = second.strftime("%Y-%m-%d")
        self.assertEqual(
            AutocompletePeriodStats.objects.get(
                period_type="day", period_key=day_key, provider="locationiq"
            ).peak_req_per_second,
            3,
        )
        self.assertEqual(
            AutocompletePeriodStats.objects.get(
                period_type="day", period_key=day_key, provider="nominatim"
            ).peak_req_per_second,
            5,
        )

    def test_peak_survives_across_aggregation_runs(self):
        base = tz.now().replace(microsecond=0)
        mk = _minute_key(base)
        for _ in range(4):
            AutocompleteRequestLog.objects.create(
                created_at=base, minute_key=mk, provider="locationiq"
            )

        aggregate_autocomplete_stats()

        # A later, quieter second must not lower the recorded peak.
        AutocompleteRequestLog.objects.create(
            created_at=base + timedelta(seconds=5), minute_key=mk, provider="locationiq"
        )

        aggregate_autocomplete_stats()

        stats = AutocompletePeriodStats.objects.get(
            period_type="day",
            period_key=base.strftime("%Y-%m-%d"),
            provider="locationiq",
        )
        self.assertEqual(stats.total_requests, 5)
        self.assertEqual(stats.peak_req_per_second, 4)


class TestLogAutocompleteRequest(TestCase):
    """Tests for the log_autocomplete_request() helper on the request path."""

    def setUp(self):
        AutocompleteRequestLog.objects.all().delete()

    def test_writes_one_unprocessed_row_with_provider(self):
        log_autocomplete_request("locationiq")

        row = AutocompleteRequestLog.objects.get()
        self.assertEqual(row.provider, "locationiq")
        self.assertFalse(row.processed)
        self.assertEqual(row.minute_key, int(time.time()) // 60)

    def test_defaults_to_nominatim(self):
        log_autocomplete_request()

        self.assertEqual(AutocompleteRequestLog.objects.get().provider, "nominatim")

    def test_row_is_picked_up_by_the_aggregation_task(self):
        log_autocomplete_request("locationiq")

        aggregate_autocomplete_stats()

        self.assertTrue(
            AutocompletePeriodStats.objects.filter(
                period_type="day", provider="locationiq", total_requests=1
            ).exists()
        )
        self.assertTrue(AutocompleteRequestLog.objects.get().processed)

    def test_db_failure_is_swallowed(self):
        # Tracking must never take down the request it is tracking.
        with patch(
            "location.models.AutocompleteRequestLog.objects.create",
            side_effect=Exception("db down"),
        ):
            log_autocomplete_request("locationiq")

        self.assertEqual(AutocompleteRequestLog.objects.count(), 0)


class TestAutocompleteStatsView(APITestCase):
    """Tests for GET /api/autocomplete_stats/."""

    def setUp(self):
        AutocompletePeriodStats.objects.all().delete()
        AutocompleteRequestLog.objects.all().delete()

        self.url = reverse("location:autocomplete-stats")
        self.admin = User.objects.create_user(
            username="stats_admin", password="testpass", is_staff=True
        )
        self.regular_user = User.objects.create_user(
            username="stats_regular", password="testpass"
        )

        for i in range(7):
            key = f"2026-06-{11 - i:02d}"
            AutocompletePeriodStats.objects.create(
                period_type="day",
                period_key=key,
                total_requests=100 + i,
                avg_req_per_second=0.01 + i * 0.001,
                peak_req_per_second=5 + i,
            )
        for i in range(4):
            AutocompletePeriodStats.objects.create(
                period_type="week",
                period_key=f"2026-W{24 - i:02d}",
                total_requests=700 + i,
                avg_req_per_second=0.008 + i * 0.001,
                peak_req_per_second=10 + i,
            )
        AutocompletePeriodStats.objects.create(
            period_type="month",
            period_key="2026-06",
            total_requests=5000,
            avg_req_per_second=0.005,
            peak_req_per_second=15,
        )

    def test_no_params_returns_day_week_month(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("day", response.data)
        self.assertIn("week", response.data)
        self.assertIn("month", response.data)

        self.assertEqual(response.data["day"]["period_key"], "2026-06-11")
        self.assertEqual(response.data["week"]["period_key"], "2026-W24")
        self.assertEqual(response.data["month"]["period_key"], "2026-06")

    def test_period_type_with_limit(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"period_type": "week", "limit": 4})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["period_type"], "week")
        self.assertEqual(len(response.data["periods"]), 4)
        self.assertEqual(response.data["periods"][0]["period_key"], "2026-W24")
        self.assertEqual(response.data["periods"][3]["period_key"], "2026-W21")

    def test_period_type_default_limit_is_1(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"period_type": "day"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["periods"]), 1)

    def test_limit_capped_at_365(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"period_type": "day", "limit": 999})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["periods"]), 7)

    def test_unauthenticated_user_rejected(self):
        response = self.client.get(self.url)
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_requires_auth(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_provider_breakdown_is_reported(self):
        # Add a LocationIQ row alongside the existing (default: nominatim)
        # row for the newest day.
        AutocompletePeriodStats.objects.create(
            period_type="day",
            period_key="2026-06-11",
            provider="locationiq",
            total_requests=40,
            avg_req_per_second=0.02,
            peak_req_per_second=2,
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        day = response.data["day"]
        # Combined totals sum across providers...
        self.assertEqual(day["total_requests"], 140)
        # ...but the peak is the max, not the sum: 100 nominatim and 40
        # locationiq requests never made a 7/s burst happen.
        self.assertEqual(day["peak_req_per_second"], 5)
        self.assertEqual(day["providers"]["nominatim"]["total_requests"], 100)
        self.assertEqual(day["providers"]["locationiq"]["total_requests"], 40)
        self.assertEqual(day["providers"]["locationiq"]["peak_req_per_second"], 2)

    def test_limit_counts_periods_not_rows(self):
        # Two providers per day must still yield `limit` days, not limit/2.
        for i in range(7):
            AutocompletePeriodStats.objects.create(
                period_type="day",
                period_key=f"2026-06-{11 - i:02d}",
                provider="locationiq",
                total_requests=10,
                avg_req_per_second=0.001,
                peak_req_per_second=1,
            )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url, {"period_type": "day", "limit": 5})

        self.assertEqual(len(response.data["periods"]), 5)
        self.assertEqual(response.data["periods"][0]["period_key"], "2026-06-11")
        self.assertEqual(response.data["periods"][4]["period_key"], "2026-06-07")
        self.assertEqual(
            sorted(response.data["periods"][0]["providers"]),
            ["locationiq", "nominatim"],
        )

    def test_invalid_period_type_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"period_type": "year"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid period_type", response.data["detail"])

    def test_invalid_limit_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.url, {"period_type": "day", "limit": "abc"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid", response.data["detail"])


class TestTrackAutocompleteRequestView(APITestCase):
    """Tests for POST /api/autocomplete_request_count/."""

    def setUp(self):
        AutocompletePeriodStats.objects.all().delete()
        AutocompleteRequestLog.objects.all().delete()

    def test_post_returns_204(self):
        url = reverse("location:track-autocomplete-request")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_post_creates_log_row(self):
        url = reverse("location:track-autocomplete-request")
        self.client.post(url)

        self.assertEqual(AutocompleteRequestLog.objects.count(), 1)


class TestDeprecatedNominatimAliases(APITestCase):
    """
    The pre-rename paths must keep working while stale JS bundles are still in
    circulation — see the comment on the alias routes in location/urls.py. The
    tracking one carries real production traffic today and is fire-and-forget,
    so a 404 there would silently under-report rather than surface as an error.
    """

    def setUp(self):
        AutocompletePeriodStats.objects.all().delete()
        AutocompleteRequestLog.objects.all().delete()

    def test_deprecated_request_count_alias_still_logs(self):
        response = self.client.post(reverse("location:track-nominatim-request"))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(AutocompleteRequestLog.objects.count(), 1)

    def test_deprecated_stats_alias_still_serves_staff(self):
        admin = User.objects.create_user(
            username="alias_admin", password="testpass", is_staff=True
        )
        self.client.force_authenticate(user=admin)

        response = self.client.get(reverse("location:nominatim-stats"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("day", response.data)

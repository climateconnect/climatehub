"""Tests for the Twingle donation goal webhook (#2388).

Test ids (T-A1, T-S1, ...) refer to
doc/spec/20261116_1440_issue_2388_twingle_donation_goal_webhook.md.
"""

import hashlib
import hmac
import json
import logging
import re
import time
from datetime import timedelta
from decimal import Decimal
from unittest import mock

import factory
import sentry_sdk
from asgiref.sync import async_to_sync
from asgiref.testing import ApplicationCommunicator
from django.contrib import admin
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.handlers.asgi import ASGIHandler
from django.core.handlers.wsgi import WSGIHandler
from django.core.signals import request_finished, request_started
from django.db import DatabaseError, IntegrityError, close_old_connections, transaction
from django.db.models import QuerySet
from django.test import Client, RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from knox.models import AuthToken
from sentry_sdk import scope as scope_module
from sentry_sdk.transport import Transport

from climateconnect_api.models import DonationGoal
from climateconnect_api.views import twingle_webhook_views
from climateconnect_api.views.twingle_webhook_views import compute_units

SECRET = "test-twingle-secret"
PROJECT = "tw6a3547480226a"
LOGGER = "climateconnect_api.twingle"
ABSENT = object()

# Donor fields with unique sentinel values (T-P1, T-P2).
SENTINELS = {
    "user_firstname": "SentinelFirstName7731",
    "user_lastname": "SentinelLastName7731",
    "user_email": "sentinel7731@example.org",
    "debit_iban": "DE89SENTINEL7731000000",
    "user_street": "Sentinelstrasse 7731",
}
# The amount must never be logged (AC-P3). Below MAX_AMOUNT, and searched only
# as a whole number, so random hex ids and timestamp digits can't match it.
SENTINEL_AMOUNT = 937163
SENTINEL_AMOUNT_RE = re.compile(r"(?<![0-9a-fA-F.])%d(?![0-9a-fA-F])" % SENTINEL_AMOUNT)


class DonationGoalFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = DonationGoal

    name = factory.Sequence(lambda n: "Goal %d" % n)
    description = "Testing goal"
    start_date = factory.LazyFunction(lambda: timezone.now() - timedelta(days=30))
    end_date = factory.LazyFunction(lambda: timezone.now() + timedelta(days=30))
    goal_amount = 100


def make_payload(**overrides):
    payload = {
        "trx_id": "52934",
        "project_id": PROJECT,
        "project_name": "Crowdfunding",
        "timestamp": 1793860981,
        "amount": 14,
        "currency_code": "EUR",
        "donation_rhythm": "monthly",
        "parent_trx_id": None,
        "parent_transaction_guid": "",
        "donation_error": False,
        "donation_recurring_stopped": False,
        **SENTINELS,
    }
    for key, value in overrides.items():
        if value is ABSENT:
            payload.pop(key, None)
        else:
            payload[key] = value
    return payload


def sign(body, secret=SECRET):
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def encode(payload):
    return payload if isinstance(payload, bytes) else json.dumps(payload).encode()


@override_settings(TWINGLE_WEBHOOK_SECRET=SECRET)
class TwingleWebhookTestCase(TestCase):
    url = reverse("twingle-webhook")

    def setUp(self):
        self.goal = DonationGoalFactory(twingle_project_id=PROJECT, current_amount=10)
        patcher = mock.patch.object(twingle_webhook_views.sentry_sdk, "capture_message")
        self.capture_message = patcher.start()
        self.addCleanup(patcher.stop)
        # Records the reason codes; the Sentry call itself is the mock above.
        patcher = mock.patch.object(
            twingle_webhook_views, "_report", wraps=twingle_webhook_views._report
        )
        self.report = patcher.start()
        self.addCleanup(patcher.stop)

    def deliver(self, payload=None, isupdate="0", signature=None, client=None, **extra):
        body = encode(make_payload() if payload is None else payload)
        headers = {}
        if signature is not False:
            headers["HTTP_X_HUB_SIGNATURE_256"] = signature or sign(body)
        if isupdate is not None:
            headers["HTTP_X_TWINGLE_ISUPDATE"] = isupdate
        return (client or self.client).post(
            self.url, data=body, content_type="application/json", **headers, **extra
        )

    def assertAmount(self, expected, goal=None):
        goal = goal or self.goal
        goal.refresh_from_db()
        self.assertEqual(goal.current_amount, expected)

    def assertUnchanged(self, response, expected_status=200):
        self.assertEqual(response.status_code, expected_status)
        self.assertAmount(10)

    def assertWarned(self, reason):
        warnings = [
            c.args[1]
            for c in self.report.call_args_list
            if c.kwargs.get("level", "warning") == "warning"
        ]
        self.assertIn(reason, warnings, "expected a Sentry warning (%s)" % reason)

    def assertNotWarned(self):
        self.capture_message.assert_not_called()


class GoalConfigurationTests(TestCase):
    def setUp(self):
        self.request = RequestFactory().get("/")
        self.request.user = User.objects.create_superuser(
            "admin", "a@example.org", "pw"
        )
        self.model_admin = admin.site._registry[DonationGoal]

    def admin_form_data(self, **overrides):
        now = timezone.now()
        data = {
            "name": "Goal",
            "description": "Description",
            "start_date_0": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
            "start_date_1": "00:00:00",
            "end_date_0": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
            "end_date_1": "00:00:00",
            "current_amount": 0,
            "goal_amount": 100,
            "unit": "€",
            "twingle_project_id": "",
            "twingle_unit_price": "7",
        }
        data.update(overrides)
        return data

    def admin_form(self, **overrides):
        form_class = self.model_admin.get_form(self.request)
        return form_class(data=self.admin_form_data(**overrides))

    def test_unit_price_defaults_to_seven(self):
        # T-A2
        goal = DonationGoalFactory()
        goal.refresh_from_db()
        self.assertEqual(goal.twingle_unit_price, Decimal("7.00"))
        self.assertEqual(goal.twingle_project_id, "")

    def test_unit_price_must_be_positive(self):
        # T-A2
        for price in ("0", "-1"):
            with self.subTest(price=price):
                form = self.admin_form(twingle_unit_price=price)
                self.assertFalse(form.is_valid())
                self.assertIn("twingle_unit_price", form.errors)
        with self.assertRaises(IntegrityError), transaction.atomic():
            DonationGoalFactory(twingle_unit_price=Decimal("0"))

    def test_unit_price_accepts_cents(self):
        form = self.admin_form(twingle_unit_price="6.50")
        self.assertTrue(form.is_valid(), form.errors)

    def test_project_id_maps_to_at_most_one_goal(self):
        # T-A3: also with a disjoint period
        now = timezone.now()
        DonationGoalFactory(
            twingle_project_id=PROJECT,
            start_date=now - timedelta(days=400),
            end_date=now - timedelta(days=300),
        )
        form = self.admin_form(twingle_project_id=PROJECT)
        self.assertFalse(form.is_valid())
        self.assertIn(
            "already mapped to another donation goal", str(form.non_field_errors())
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            DonationGoalFactory(twingle_project_id=PROJECT)

    def test_whitespace_does_not_bypass_unique_mapping(self):
        # T-A3
        DonationGoalFactory(twingle_project_id=" %s " % PROJECT)
        self.assertTrue(
            DonationGoal.objects.filter(twingle_project_id=PROJECT).exists()
        )
        self.assertFalse(
            self.admin_form(twingle_project_id="  %s\t" % PROJECT).is_valid()
        )
        goal = DonationGoalFactory.build(twingle_project_id="%s " % PROJECT)
        with self.assertRaises(ValidationError):
            goal.full_clean()
        with self.assertRaises(IntegrityError), transaction.atomic():
            DonationGoalFactory(twingle_project_id="%s  " % PROJECT)

    def test_several_unmapped_goals_are_allowed(self):
        # T-A3
        DonationGoalFactory()
        DonationGoalFactory(twingle_project_id="")
        self.assertTrue(self.admin_form(twingle_project_id="").is_valid())

    def test_last_delivery_is_read_only_in_admin(self):
        # T-A5 / AC-A7
        self.assertIn(
            "twingle_last_delivery_at",
            self.model_admin.get_readonly_fields(self.request),
        )
        self.assertNotIn(
            "twingle_last_delivery_at",
            self.model_admin.get_form(self.request).base_fields,
        )
        self.assertIn("twingle_last_delivery_at", self.model_admin.list_display)

    def test_current_amount_stays_editable(self):
        # AC-A4
        form_class = self.model_admin.get_form(self.request)
        self.assertIn("current_amount", form_class.base_fields)

    def test_public_endpoints_expose_the_same_fields(self):
        # T-A4 / AC-A5
        DonationGoalFactory(
            twingle_project_id=PROJECT, twingle_last_delivery_at=timezone.now()
        )
        expected = {
            "name",
            "start_date",
            "end_date",
            "current_amount",
            "goal_amount",
            "hub",
            "unit",
            "call_to_action_text",
            "call_to_action_link",
        }
        many = self.client.get("/api/donation_goals_progresses/").json()
        self.assertEqual(set(many[0].keys()), expected)
        single = self.client.get("/api/donation_goal_progress/").json()
        self.assertEqual(set(single.keys()), expected)


class SecurityTests(TwingleWebhookTestCase):
    def test_missing_signature(self):
        # T-S1
        response = self.deliver(signature=False)
        self.assertUnchanged(response, 401)
        self.assertWarned("signature_missing")

    def test_wrong_or_malformed_signatures(self):
        # T-S2
        body = encode(make_payload())
        cases = {
            "wrong secret": (sign(body, "other-secret"), "signature_mismatch"),
            "other body": (sign(b'{"project_id": "x"}'), "signature_mismatch"),
            "no prefix": (sign(body)[len("sha256=") :], "signature_malformed"),
            "non-hex": ("sha256=" + "z" * 64, "signature_malformed"),
            "wrong algorithm": (
                sign(body).replace("sha256=", "sha1="),
                "signature_malformed",
            ),
            "truncated": (sign(body)[:-2], "signature_malformed"),
            "non-ascii": ("sha256=" + "ä" * 64, "signature_malformed"),
        }
        for name, (signature, reason) in cases.items():
            with self.subTest(name):
                self.capture_message.reset_mock()
                self.report.reset_mock()
                self.assertUnchanged(self.deliver(signature=signature), 401)
                self.assertWarned(reason)

    def test_body_altered_by_one_byte(self):
        # T-S3
        body = encode(make_payload())
        signature = sign(body)
        altered = body.replace(b'"amount": 14', b'"amount": 15')
        self.assertUnchanged(self.deliver(altered, signature=signature), 401)

    def test_secret_not_configured_fails_closed(self):
        # T-S4: even with a header that would match an empty secret
        body = encode(make_payload())
        for secret in ("", "   ", None):
            with (
                self.subTest(secret=secret),
                override_settings(TWINGLE_WEBHOOK_SECRET=secret),
            ):
                self.capture_message.reset_mock()
                self.report.reset_mock()
                response = self.deliver(body, signature=sign(body, ""))
                self.assertUnchanged(response, 503)
                self.assertEqual(
                    self.capture_message.call_args.kwargs["level"], "error"
                )
        self.goal.refresh_from_db()
        self.assertIsNone(self.goal.twingle_last_delivery_at)

    def test_only_post_is_allowed(self):
        # T-S5
        for method in ("get", "put", "patch", "delete", "options"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url)
                self.assertEqual(response.status_code, 405)
        self.assertAmount(10)

    def test_credentials_are_ignored(self):
        # T-S6: no 401 from token auth, no CSRF rejection
        user = User.objects.create_user("donor", "d@example.org", "pw")
        _, token = AuthToken.objects.create(user=user)
        session_client = Client(enforce_csrf_checks=True)
        session_client.force_login(user)
        cases = [
            ("valid token", {"HTTP_AUTHORIZATION": "Token %s" % token}, None),
            ("invalid token", {"HTTP_AUTHORIZATION": "Token invalid"}, None),
            ("session cookie", {}, session_client),
        ]
        expected = 10
        for name, extra, client in cases:
            with self.subTest(name):
                response = self.deliver(client=client, **extra)
                self.assertEqual(response.status_code, 200)
                expected += 2
                self.assertAmount(expected)

    def test_bad_signature_warning_is_fixed_text(self):
        # T-S7
        self.deliver(signature="sha256=" + "0" * 64)
        self.capture_message.assert_called_once()
        args, kwargs = self.capture_message.call_args
        self.assertEqual(args, ("Twingle webhook rejected: invalid signature",))
        self.assertEqual(kwargs, {"level": "warning"})


class CountingTests(TwingleWebhookTestCase):
    def test_rhythms_normalise_to_monthly(self):
        # T-N1 (R1): 7 € per month each
        cases = {"monthly": 14, "quarterly": 42, "halfyearly": 84, "yearly": 168}
        expected = 10
        for rhythm, amount in cases.items():
            with self.subTest(rhythm):
                payload = make_payload(donation_rhythm=rhythm, amount=amount)
                self.assertEqual(self.deliver(payload).status_code, 200)
                expected += 2
                self.assertAmount(expected)

    def test_units_round_down_per_transaction(self):
        # T-N2 (R2): the AC-N2 table
        cases = [
            ("monthly", 7, 1),
            ("monthly", 10, 1),
            ("monthly", 14, 2),
            ("monthly", 5, 0),
            ("yearly", 84, 1),
            ("quarterly", 21, 1),
            ("halfyearly", 42, 1),
            ("monthly", "13.99", 1),
            ("yearly", "83.99", 0),
        ]
        for rhythm, amount, units in cases:
            with self.subTest(rhythm=rhythm, amount=amount):
                self.goal.current_amount = 10
                self.goal.save()
                self.deliver(make_payload(donation_rhythm=rhythm, amount=amount))
                self.assertAmount(10 + units)
        self.assertNotWarned()

    def test_exact_multiples_never_lose_a_unit(self):
        # T-N2: exact arithmetic, incl. prices with cents
        months = {"monthly": 1, "quarterly": 3, "halfyearly": 6, "yearly": 12}
        for price in ("7", "0.10", "3.30", "6.99", "12.34"):
            for n in (1, 3, 7):
                for m in months.values():
                    amount = Decimal(price) * n * m
                    self.assertEqual(compute_units(amount, m, Decimal(price)), n)

    def test_non_default_unit_price(self):
        # T-N2
        self.goal.twingle_unit_price = Decimal("5.00")
        self.goal.save()
        self.deliver(make_payload(amount=14))
        self.assertAmount(12)

    def test_updates_do_not_add(self):
        # T-N3 (R3)
        self.assertUnchanged(self.deliver(isupdate="1"))
        self.assertNotWarned()

    def test_missing_or_unknown_isupdate_is_malformed(self):
        # T-N3, T3
        for value in (None, "", "2", "yes"):
            with self.subTest(isupdate=value):
                self.capture_message.reset_mock()
                self.report.reset_mock()
                self.assertUnchanged(self.deliver(isupdate=value))
                self.assertWarned("isupdate")

    def test_follow_up_bookings_do_not_add(self):
        # T-N4 (R4)
        for field in ("parent_trx_id", "parent_transaction_guid"):
            for value in ("52000", 52000, "8f1c-guid"):
                with self.subTest(field=field, value=value):
                    self.assertUnchanged(self.deliver(make_payload(**{field: value})))
        self.assertNotWarned()

    def test_empty_parent_fields_count(self):
        # T-N4: empty or absent
        for value in (None, "", "  ", ABSENT):
            with self.subTest(value=value):
                self.goal.current_amount = 10
                self.goal.save()
                payload = make_payload(
                    parent_trx_id=value, parent_transaction_guid=value
                )
                self.deliver(payload)
                self.assertAmount(12)

    def test_one_time_does_not_add(self):
        # T-N5 (R5)
        self.assertUnchanged(self.deliver(make_payload(donation_rhythm="one_time")))
        self.assertNotWarned()

    def test_unknown_rhythm_is_malformed(self):
        # T-N5, T3
        for value in ("weekly", "", None, ABSENT, 1):
            with self.subTest(rhythm=value):
                self.capture_message.reset_mock()
                self.report.reset_mock()
                self.assertUnchanged(self.deliver(make_payload(donation_rhythm=value)))
                self.assertWarned("donation_rhythm")

    def test_donation_error_does_not_add(self):
        # T-N6 (R6), AC-N10
        for value in (True, 1, "1", "true", "TRUE", " true "):
            with self.subTest(value=value):
                self.assertUnchanged(self.deliver(make_payload(donation_error=value)))
        self.assertNotWarned()

    def test_donation_error_not_set_counts(self):
        # T-N6, AC-N10
        for value in (False, 0, "0", "false", "", None, ABSENT):
            with self.subTest(value=value):
                self.goal.current_amount = 10
                self.goal.save()
                self.deliver(make_payload(donation_error=value))
                self.assertAmount(12)
        self.assertNotWarned()

    def test_unmapped_project_is_ignored_silently(self):
        # T-N7, T-A1
        for project in ("tw-other", "", None, ABSENT, 42):
            with self.subTest(project=project):
                payload = make_payload(project_id=project, amount=ABSENT)
                self.assertUnchanged(self.deliver(payload))
        self.assertNotWarned()

    def test_goal_without_mapping_is_unaffected(self):
        # T-A1
        unmapped = DonationGoalFactory(current_amount=5)
        self.deliver(make_payload(project_id=""))
        self.deliver()
        self.assertAmount(5, unmapped)
        unmapped.refresh_from_db()
        self.assertIsNone(unmapped.twingle_last_delivery_at)

    def test_no_period_check(self):
        # T-N7 (R7 simplified by T12): ended goal, old timestamp
        now = timezone.now()
        self.goal.start_date = now - timedelta(days=400)
        self.goal.end_date = now - timedelta(days=300)
        self.goal.save()
        self.deliver(make_payload(timestamp=1))
        self.assertAmount(12)
        self.deliver(make_payload(timestamp=ABSENT))
        self.assertAmount(14)

    def test_project_id_whitespace_is_trimmed(self):
        # T6
        self.deliver(make_payload(project_id=" %s " % PROJECT))
        self.assertAmount(12)

    def test_non_eur_is_logged_and_ignored(self):
        # T-N8 (R8)
        with self.assertLogs(LOGGER, "INFO") as logs:
            response = self.deliver(make_payload(currency_code="CHF"))
        self.assertUnchanged(response)
        self.assertEqual(len(logs.output), 1)
        self.assertIn("currency CHF", logs.output[0])
        self.assertIn("goal=%d" % self.goal.id, logs.output[0])
        self.assertNotWarned()

    def test_currency_is_case_insensitive(self):
        self.deliver(make_payload(currency_code="eur"))
        self.assertAmount(12)

    def test_deliveries_stack_on_manual_amount(self):
        # T-N9 (D9)
        self.goal.current_amount = 100
        self.goal.save()
        self.deliver(make_payload(trx_id="1"))
        self.deliver(make_payload(trx_id="2", amount=21))
        self.assertAmount(105)

    def test_unknown_fields_are_ignored(self):
        # T-N10 (A6)
        payload = make_payload(new_field={"nested": [1, 2]}, another="x")
        self.deliver(payload)
        self.assertAmount(12)

    def test_stop_and_error_updates_change_nothing(self):
        # T-N11 (AC-N11)
        for field in ("donation_recurring_stopped", "donation_error"):
            with self.subTest(field):
                response = self.deliver(make_payload(**{field: True}), isupdate="1")
                self.assertUnchanged(response)
        self.assertNotWarned()

    def test_increment_is_atomic_in_the_database(self):
        # AC-N9: a stale in-memory value can't overwrite the increment
        DonationGoal.objects.filter(pk=self.goal.pk).update(current_amount=50)
        with mock.patch.object(QuerySet, "update", autospec=True) as update:
            update.return_value = 1
            self.deliver()
        _, kwargs = update.call_args
        self.assertEqual(str(kwargs["current_amount"]), "F(current_amount) + Value(2)")

    def test_sub_cent_amounts_round_down_to_cents(self):
        # A tiny exponent must not blow up the exact arithmetic.
        cases = [("13.999", 1), ("6.999", 0), ("1e-999999999", 0), ("14.00000", 2)]
        for amount, units in cases:
            with self.subTest(amount=amount):
                self.goal.current_amount = 10
                self.goal.save()
                started = time.monotonic()
                self.assertEqual(
                    self.deliver(make_payload(amount=amount)).status_code, 200
                )
                self.assertLess(time.monotonic() - started, 5)
                self.assertAmount(10 + units)
        self.assertNotWarned()

    def test_absurd_amount_is_malformed(self):
        for amount in (
            "1e999999999",
            10_000_000,
            -7,
            "NaN",
            "Infinity",
            True,
            None,
            "x",
        ):
            with self.subTest(amount=amount):
                self.capture_message.reset_mock()
                self.report.reset_mock()
                self.assertUnchanged(self.deliver(make_payload(amount=amount)))
                self.assertWarned("amount")


class LivenessTests(TwingleWebhookTestCase):
    # T-N12 (T13)
    def assertDelivered(self, delivered):
        self.goal.refresh_from_db()
        if delivered:
            self.assertIsNotNone(self.goal.twingle_last_delivery_at)
        else:
            self.assertIsNone(self.goal.twingle_last_delivery_at)

    def test_set_on_every_signed_delivery_for_a_mapped_project(self):
        cases = {
            "counted": (make_payload(), "0"),
            "follow-up booking": (make_payload(parent_trx_id="1"), "0"),
            "one-time": (make_payload(donation_rhythm="one_time"), "0"),
            "update": (make_payload(), "1"),
            "non-EUR": (make_payload(currency_code="USD"), "0"),
            "zero units": (make_payload(amount=5), "0"),
            "malformed": (make_payload(amount=ABSENT), "0"),
            "malformed header": (make_payload(), None),
        }
        for name, (payload, isupdate) in cases.items():
            with self.subTest(name):
                DonationGoal.objects.filter(pk=self.goal.pk).update(
                    twingle_last_delivery_at=None
                )
                updated_at = DonationGoal.objects.get(pk=self.goal.pk).updated_at
                self.assertEqual(
                    self.deliver(payload, isupdate=isupdate).status_code, 200
                )
                self.assertDelivered(True)
                self.assertEqual(self.goal.updated_at, updated_at)

    def test_unchanged_without_a_valid_mapped_delivery(self):
        self.deliver(signature="sha256=" + "0" * 64)
        self.deliver(make_payload(project_id="tw-other"))
        self.deliver(b"not json")
        self.assertDelivered(False)

    def test_unchanged_on_database_error(self):
        with mock.patch.object(QuerySet, "update", side_effect=DatabaseError("boom")):
            self.assertEqual(self.deliver().status_code, 500)
        self.assertDelivered(False)


class ResponseContractTests(TwingleWebhookTestCase):
    def test_invalid_json_or_non_object(self):
        # T-R1
        for body, reason in (
            (b"not json", "invalid_json"),
            (b"[1, 2]", "not_an_object"),
            (b'"text"', "not_an_object"),
            (b"", "invalid_json"),
            (b"\xff\xfe\x00", "invalid_json"),
            (b"[" * 100000, "invalid_json"),
        ):
            with self.subTest(body=body[:10]):
                self.capture_message.reset_mock()
                self.report.reset_mock()
                self.assertUnchanged(self.deliver(body))
                self.assertWarned(reason)

    def test_missing_amount_or_currency(self):
        # T-R2
        for field in ("amount", "currency_code"):
            with self.subTest(field):
                self.capture_message.reset_mock()
                self.report.reset_mock()
                self.assertUnchanged(self.deliver(make_payload(**{field: ABSENT})))
                self.assertWarned(field)

    def test_database_error_returns_500_without_change(self):
        # T-R3
        with (
            mock.patch.object(QuerySet, "update", side_effect=DatabaseError("boom")),
            mock.patch.object(
                twingle_webhook_views.sentry_sdk, "capture_exception"
            ) as capture,
        ):
            response = self.deliver()
        self.assertUnchanged(response, 500)
        capture.assert_called_once()

    def test_logging_failure_after_commit_still_returns_200(self):
        with mock.patch.object(
            twingle_webhook_views.logger, "info", side_effect=RuntimeError("log")
        ):
            response = self.deliver()
        self.assertEqual(response.status_code, 200)
        self.assertAmount(12)

    def test_response_bodies_contain_no_payload_content(self):
        # T-P3
        responses = [
            self.deliver(),
            self.deliver(signature=False),
            self.deliver(make_payload(amount=ABSENT)),
            self.deliver(b"not json " + SENTINELS["user_email"].encode()),
        ]
        with override_settings(TWINGLE_WEBHOOK_SECRET=""):
            responses.append(self.deliver())
        for response in responses:
            content = response.content.decode()
            for value in [*SENTINELS.values(), PROJECT, "52934", "not json"]:
                self.assertNotIn(value, content)


class LoggingTests(TwingleWebhookTestCase):
    def test_one_line_per_change_without_personal_data(self):
        # T-P2 (AC-P3, AC-P4)
        payload = make_payload(amount=SENTINEL_AMOUNT, donation_rhythm="yearly")
        with self.assertLogs(LOGGER, "INFO") as logs:
            self.deliver(payload)
        self.assertEqual(len(logs.records), 1)
        line = logs.records[0].getMessage()
        self.assertTrue(line.startswith("twingle "))
        self.assertEqual(
            line,
            "twingle trx=52934 project=%s goal=%d +%d units (yearly)"
            % (PROJECT, self.goal.id, SENTINEL_AMOUNT // (12 * 7)),
        )
        self.assertNotRegex(line, SENTINEL_AMOUNT_RE)
        for value in SENTINELS.values():
            self.assertNotIn(value, line)

    def test_ignored_deliveries_write_no_line(self):
        with self.assertNoLogs(LOGGER, "INFO"):
            self.deliver(isupdate="1")
            self.deliver(make_payload(project_id="tw-other"))
            self.deliver(make_payload(amount=5))

    def test_odd_trx_id_is_not_logged_verbatim(self):
        with self.assertLogs(LOGGER, "INFO") as logs:
            self.deliver(make_payload(trx_id="1\ntwingle trx=fake +999 units"))
        self.assertEqual(logs.records[0].getMessage().split()[1], "trx=-")

    def test_logger_reaches_the_web_process_output(self):
        # T-P4 (AC-P5, T9)
        twingle_logger = logging.getLogger(LOGGER)
        self.assertTrue(twingle_logger.isEnabledFor(logging.INFO))
        self.assertTrue(twingle_logger.handlers)
        self.assertFalse(twingle_logger.propagate)
        self.assertTrue(
            all(h.level <= logging.INFO for h in twingle_logger.handlers),
        )


class _CapturingTransport(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.envelopes = []

    def capture_envelope(self, envelope):
        self.envelopes.append(envelope)


@override_settings(TWINGLE_WEBHOOK_SECRET=SECRET)
class SentryPrivacyTests(TestCase):
    """T-P1 (AC-P2, AC-P6): serialized Sentry events carry no payload values.

    Requests go through the real WSGI and ASGI handlers, because Sentry's
    request scopes, request processors and transactions are set up there and
    not in the Django test client.
    """

    def setUp(self):
        self.goal = DonationGoalFactory(twingle_project_id=PROJECT, current_amount=10)
        previous = sentry_sdk.get_client()
        self.transport = _CapturingTransport()
        # The project's own options (scrubber, before_send, integrations,
        # local variables on), but sending everything to a local transport.
        sentry_sdk.init(
            **{
                **previous.options,
                "dsn": "https://public@sentry.example.org/1",
                "transport": self.transport,
                "traces_sample_rate": 1.0,
                "traces_sampler": None,
                "sample_rate": 1.0,
            }
        )
        self.addCleanup(sentry_sdk.get_global_scope().set_client, previous)
        # Like the test client: don't let request signals close the test
        # transaction's connection.

    def wsgi_post(self, body, signature, isupdate="0"):
        environ = (
            RequestFactory()
            .post(
                reverse("twingle-webhook"),
                data=body,
                content_type="application/json",
                HTTP_X_HUB_SIGNATURE_256=signature,
                HTTP_X_TWINGLE_ISUPDATE=isupdate,
                HTTP_COOKIE="sessionid=%s" % SENTINELS["user_email"],
            )
            .environ
        )
        return self.call_wsgi(environ)

    def call_wsgi(self, environ):
        # Like the test client: the request signals must not close the test
        # transaction's connection.
        for signal in (request_started, request_finished):
            signal.disconnect(close_old_connections)
        try:
            statuses = []
            response = WSGIHandler()(environ, lambda s, h, *a: statuses.append(s))
            b"".join(response)
            response.close()
        finally:
            for signal in (request_started, request_finished):
                signal.connect(close_old_connections)
        return int(statuses[0].split()[0])

    def asgi_post(self, body, signature, isupdate="0"):
        async def run():
            communicator = ApplicationCommunicator(
                ASGIHandler(),
                {
                    "type": "http",
                    "asgi": {"version": "3.0"},
                    "http_version": "1.1",
                    "method": "POST",
                    "scheme": "https",
                    "path": reverse("twingle-webhook"),
                    "raw_path": reverse("twingle-webhook").encode(),
                    "query_string": b"",
                    "headers": [
                        (b"host", b"testserver"),
                        (b"content-type", b"application/json"),
                        (b"content-length", str(len(body)).encode()),
                        (b"x-hub-signature-256", signature.encode()),
                        (b"x-twingle-isupdate", isupdate.encode()),
                    ],
                    "client": ("127.0.0.1", 1234),
                    "server": ("testserver", 443),
                },
            )
            await communicator.send_input(
                {"type": "http.request", "body": body, "more_body": False}
            )
            start = await communicator.receive_output(timeout=10)
            await communicator.receive_output(timeout=10)
            await communicator.wait(timeout=10)
            return start["status"]

        return async_to_sync(run)()

    def serialized_events(self):
        sentry_sdk.flush()
        return [
            (item.type, item.payload.get_bytes().decode("utf-8", "replace"))
            for envelope in self.transport.envelopes
            for item in envelope.items
        ]

    def assertClean(self, events, forbidden):
        self.assertTrue(events)
        for item_type, serialized in events:
            for value in forbidden:
                self.assertNotIn(
                    value, serialized, "%s leaked into %s" % (value, item_type)
                )
            self.assertNotRegex(
                serialized, SENTINEL_AMOUNT_RE, "amount leaked into %s" % item_type
            )

    def run_scenarios(self, post, check_amount=True):
        payload = make_payload(amount=SENTINEL_AMOUNT)
        body = encode(payload)
        signature = sign(body)
        bad_signature = sign(body, "wrong-secret")
        malformed = encode(make_payload(amount=ABSENT))

        # (a) bad signature, (b) malformed payload, (d) counted delivery
        self.assertEqual(post(body, bad_signature), 401)
        self.assertEqual(post(malformed, sign(malformed)), 200)
        with self.assertLogs(LOGGER, "INFO"):
            self.assertEqual(post(body, signature), 200)
        # (c) unexpected exception inside processing, with the payload in the
        # frame's local variables
        with mock.patch.object(
            twingle_webhook_views, "compute_units", side_effect=RuntimeError("fixed")
        ):
            self.assertEqual(post(body, signature), 500)

        events = self.serialized_events()
        types = [item_type for item_type, _ in events]
        self.assertIn("transaction", types)
        self.assertGreaterEqual(types.count("event"), 3)
        # The processor ran: stack frames kept, variables gone.
        exception_events = [
            s for t, s in events if t == "event" and "RuntimeError" in s
        ]
        self.assertEqual(len(exception_events), 1)
        self.assertIn("compute_units", exception_events[0])
        self.assertNotIn('"vars"', exception_events[0])
        self.assertClean(
            events,
            [
                *SENTINELS.values(),
                signature.split("=")[1],
                bad_signature.split("=")[1],
                SECRET,
                body.decode()[20:60],
            ],
        )
        if check_amount:
            self.goal.refresh_from_db()
            self.assertEqual(self.goal.current_amount, 10 + SENTINEL_AMOUNT // 7)

    def test_wsgi_events_carry_no_payload(self):
        self.run_scenarios(self.wsgi_post)

    def test_asgi_events_carry_no_payload(self):
        # Production path (uvicorn). The sync view runs in an executor thread
        # with its own database connection, which can't see this test's
        # transaction, so the goal lookup is stubbed; the update there hits no
        # row, and only the events are checked.
        goal = {"id": self.goal.id, "twingle_unit_price": Decimal("7.00")}
        with mock.patch.object(
            twingle_webhook_views, "find_mapped_goal", return_value=goal
        ):
            self.run_scenarios(self.asgi_post, check_amount=False)

    def test_processor_stays_on_the_webhook_request(self):
        # The processor is scoped to the webhook request: the request's scopes
        # are forks, so the scopes outside it don't gain it. Asserting on
        # another endpoint's events can't show this, because Django re-adds
        # the request data after any leaked processor.
        def registered():
            lists = [
                scope_module.global_event_processors,
                sentry_sdk.get_global_scope()._event_processors,
                sentry_sdk.get_isolation_scope()._event_processors,
                sentry_sdk.get_current_scope()._event_processors,
            ]
            processor = twingle_webhook_views._strip_request_data
            return [processors.count(processor) for processors in lists]

        before = registered()
        self.assertEqual(self.wsgi_post(b"{}", "sha256=" + "0" * 64), 401)
        self.assertEqual(registered(), before)
        self.transport.envelopes.clear()
        environ = (
            RequestFactory().get("/api/donation_goals_progresses/?probe=1").environ
        )
        self.call_wsgi(environ)
        transactions = [s for t, s in self.serialized_events() if t == "transaction"]
        self.assertTrue(transactions)
        self.assertIn('"request"', transactions[-1])

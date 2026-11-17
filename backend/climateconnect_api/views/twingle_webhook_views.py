"""
Twingle webhook: adds new recurring donations to a mapped DonationGoal.

Stateless by design: nothing about a delivery is stored except the change to
`current_amount` and the liveness timestamp. See
doc/spec/20261116_1440_issue_2388_twingle_donation_goal_webhook.md and the ops
guide doc/twingle-donation-webhook.md.

Privacy rules for this module (AC-P2, AC-P3, AC-P6):
- Every Sentry event of the request goes through `_strip_request_data`.
- Problems caused by the payload are reported as fixed-text messages with a
  reason tag, never as exceptions (parser errors echo their input).
- Only trx_id, project_id, currency_code, the rhythm and the unit delta are
  ever logged; never the body, donor fields or the amount.
"""

import hashlib
import hmac
import json
import logging
import re
from decimal import Decimal, InvalidOperation
from fractions import Fraction

import sentry_sdk
from django.conf import settings
from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from climateconnect_api.models import DonationGoal

logger = logging.getLogger("climateconnect_api.twingle")

SIGNATURE_HEADER = "X-Hub-Signature-256"
ISUPDATE_HEADER = "X-Twingle-Isupdate"

# Divisor that turns an amount of the given rhythm into a monthly amount (R1).
RHYTHM_MONTHS = {
    "monthly": 1,
    "quarterly": 3,
    "halfyearly": 6,
    "yearly": 12,
}
ONE_TIME_RHYTHM = "one_time"
# No real donation comes near this. The bound keeps the exact arithmetic cheap
# and current_amount within its integer column, so an absurd value is treated
# as malformed (200) instead of failing with a 500 on every retry.
MAX_AMOUNT = Decimal(1_000_000)

_SIGNATURE_RE = re.compile(r"sha256=([0-9a-fA-F]{64})")
# Values that end up in a log line are reduced to a safe charset, so a signed
# but odd payload can't forge or break log lines.
_LOG_SAFE_RE = re.compile(r"[A-Za-z0-9_.:-]{1,64}")

_TRUE_VALUES = {"1", "true"}
_FALSE_VALUES = {"", "0", "false"}


class _Malformed(Exception):
    """A field needed for the decision is missing or unreadable.

    `reason` is a fixed code; the exception never carries payload values.
    """

    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


def _strip_request_data(event, hint):
    """Sentry event processor scoped to a webhook request (AC-P2, AC-P6).

    Removes everything that can carry payload values or the signature: request
    data (body, headers, cookies, query string), breadcrumbs, extra and the
    local variables of every stack frame. Keeps the stack trace itself, tags,
    the fixed message, the transaction name, timings and spans.
    """
    event.pop("request", None)
    event.pop("breadcrumbs", None)
    event.pop("extra", None)
    for key in ("exception", "threads"):
        for value in (event.get(key) or {}).get("values") or []:
            for frame in (value.get("stacktrace") or {}).get("frames") or []:
                frame.pop("vars", None)
    return event


def _report(message, reason, level="warning"):
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("twingle_reason", reason)
        sentry_sdk.capture_message(message, level=level)


def _log_safe(value):
    text = value if isinstance(value, str) else str(value) if value else ""
    return text if _LOG_SAFE_RE.fullmatch(text) else "-"


def _is_set(value, reason):
    """Tolerant boolean read (AC-N10)."""
    if value is None or value is False:
        return False
    if value is True:
        return True
    if isinstance(value, int) and value in (0, 1):
        return value == 1
    if isinstance(value, str):
        normalised = value.strip().lower()
        if normalised in _TRUE_VALUES:
            return True
        if normalised in _FALSE_VALUES:
            return False
    raise _Malformed(reason)


def _is_empty(value):
    return value is None or (isinstance(value, str) and not value.strip())


def _read_amount(value):
    # bool is an int subclass, but never a valid amount.
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise _Malformed("amount")
    try:
        amount = Decimal(value.strip() if isinstance(value, str) else str(value))
    except InvalidOperation:
        raise _Malformed("amount") from None
    if not amount.is_finite() or amount < 0 or amount > MAX_AMOUNT:
        raise _Malformed("amount")
    return amount


def compute_units(amount, months, unit_price):
    """Units = floor(monthly amount / unit price), exact (R1, R2, AC-N2)."""
    return int(Fraction(amount) / (months * Fraction(unit_price)) // 1)


def _decide(payload, isupdate_header, unit_price):
    """Return (units, rhythm, currency) for a mapped project.

    units is 0 when the delivery is ignored. currency is returned only for a
    non-EUR delivery, which the caller logs (AC-N8).
    """
    isupdate = (isupdate_header or "").strip()
    if isupdate not in ("0", "1"):
        raise _Malformed("isupdate")
    # Phase 1: every update, including stop and error updates, is ignored
    # (R3, AC-N11). Admins subtract stops by hand.
    if isupdate == "1":
        return 0, None, None

    # Follow-up bookings of a recurring donation (R4).
    if not _is_empty(payload.get("parent_trx_id")) or not _is_empty(
        payload.get("parent_transaction_guid")
    ):
        return 0, None, None

    rhythm = payload.get("donation_rhythm")
    rhythm = rhythm.strip() if isinstance(rhythm, str) else None
    if rhythm == ONE_TIME_RHYTHM:
        return 0, None, None
    if rhythm not in RHYTHM_MONTHS:
        raise _Malformed("donation_rhythm")

    if _is_set(payload.get("donation_error"), "donation_error"):
        return 0, None, None

    currency = payload.get("currency_code")
    if not isinstance(currency, str) or not currency.strip():
        raise _Malformed("currency_code")
    if currency.strip().upper() != "EUR":
        return 0, rhythm, currency.strip()

    amount = _read_amount(payload.get("amount"))
    return compute_units(amount, RHYTHM_MONTHS[rhythm], unit_price), rhythm, None


class TwingleWebhookView(APIView):
    """POST /api/webhooks/twingle/: signed Twingle transaction delivery.

    The signature is the only authentication (AC-S2), so there are no
    authentication classes. The response contract (section R of the spec)
    guarantees that a non-2xx response never comes with a changed goal.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    http_method_names = ["post"]

    def dispatch(self, request, *args, **kwargs):
        # Before anything else touches the request. Django registers its own
        # request processor on the current scope and the ASGI integration on
        # the isolation scope; processors run isolation scope first, then
        # current scope, each in registration order. Registering on both makes
        # sure ours runs after every processor that adds request data.
        sentry_sdk.get_isolation_scope().add_event_processor(_strip_request_data)
        sentry_sdk.get_current_scope().add_event_processor(_strip_request_data)
        return super().dispatch(request, *args, **kwargs)

    def post(self, request):
        secret = (settings.TWINGLE_WEBHOOK_SECRET or "").strip()
        if not secret:
            _report(
                "Twingle webhook rejected: secret not configured",
                "secret_missing",
                level="error",
            )
            return Response(
                {"detail": "Not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        body = request.body
        if not self._signature_valid(
            request.headers.get(SIGNATURE_HEADER), secret, body
        ):
            return Response(
                {"detail": "Invalid signature."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            payload = json.loads(body)
        except (ValueError, RecursionError):
            _report("Twingle webhook ignored: malformed payload", "invalid_json")
            return self._ok()
        if not isinstance(payload, dict):
            _report("Twingle webhook ignored: malformed payload", "not_an_object")
            return self._ok()

        try:
            return self._process(payload, request.headers.get(ISUPDATE_HEADER))
        except Exception:
            # Nothing was changed: the only write that changes the goal is the
            # last statement of _process, and logging after it is guarded.
            sentry_sdk.capture_exception()
            return Response(
                {"detail": "Error."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _signature_valid(self, header, secret, body):
        match = _SIGNATURE_RE.fullmatch((header or "").strip())
        if match is None:
            reason = "signature_missing" if not header else "signature_malformed"
        else:
            expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected, match.group(1).lower()):
                return True
            reason = "signature_mismatch"
        _report("Twingle webhook rejected: invalid signature", reason)
        return False

    def _process(self, payload, isupdate_header):
        project_id = payload.get("project_id")
        project_id = project_id.strip() if isinstance(project_id, str) else ""
        goal = (
            DonationGoal.objects.filter(twingle_project_id=project_id)
            .values("id", "twingle_unit_price")
            .first()
            if project_id
            else None
        )
        if goal is None:
            # Unmapped projects are ignored without validating the rest, so
            # other Twingle projects create no Sentry noise.
            return self._ok()

        goal_rows = DonationGoal.objects.filter(pk=goal["id"])
        now = timezone.now()
        try:
            units, rhythm, currency = _decide(
                payload, isupdate_header, goal["twingle_unit_price"]
            )
        except _Malformed as malformed:
            goal_rows.update(twingle_last_delivery_at=now)
            _report("Twingle webhook ignored: malformed payload", malformed.reason)
            return self._ok()

        if units <= 0:
            goal_rows.update(twingle_last_delivery_at=now)
            if currency is not None:
                self._log(
                    "twingle trx=%s project=%s goal=%s ignored: currency %s",
                    payload,
                    project_id,
                    goal["id"],
                    _log_safe(currency),
                )
            return self._ok()

        # Atomic increment in the database (AC-N9). QuerySet.update() doesn't
        # touch updated_at, which stays the last admin change (T13).
        goal_rows.update(
            current_amount=F("current_amount") + units,
            twingle_last_delivery_at=now,
        )
        self._log(
            "twingle trx=%s project=%s goal=%s +%d units (%s)",
            payload,
            project_id,
            goal["id"],
            units,
            rhythm,
        )
        return self._ok()

    def _log(self, message, payload, project_id, goal_id, *args):
        # The change is committed at this point; a logging problem must not
        # turn the response into a non-2xx (section R).
        try:
            logger.info(
                message,
                _log_safe(payload.get("trx_id")),
                _log_safe(project_id),
                goal_id,
                *args,
            )
        except Exception:
            pass

    def _ok(self):
        return Response({"detail": "OK."}, status=status.HTTP_200_OK)

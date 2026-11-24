# Issue draft: Apply Sentry PII filtering to performance transactions and nested data

**Status**: Draft GitHub issue (not created yet)
**Date**: 2026-11-16
**Found during**: spec work for #2388 (Twingle donation goal webhook), system impact analysis
**Labels (suggested)**: backend, privacy, monitoring

---

## Title

Sentry: apply PII filtering to performance transactions and nested request data

## Problem

Our backend Sentry setup (`backend/climateconnect_main/settings.py`, `sentry_sdk.init`) promises layered PII protection (see `doc/sentry.md`). Two of those layers have gaps:

1. **`before_send` doesn't run on performance transactions.** With `traces_sample_rate=0.2`, about one in five requests sends a transaction event to Sentry. The Django integration attaches the parsed request body (up to ~10 KB) and request headers to these transactions too. The SDK only calls `before_send` for errors; transactions use the separate `before_send_transaction` hook, which we don't set. So on transactions:
   - known PII fields are only filtered by the `EventScrubber` (`[Filtered]`), not by `_sentry_before_send` (`[REDACTED]`);
   - headers are **not** stripped, except the SDK's built-in sensitive ones (cookie, authorization, …). User agent and referer go through.
2. **The `EventScrubber` is not recursive.** It's created without `recursive=True` (SDK default: `False`), so it only checks the top-level keys of each dict it scans (request data, frame variables, `extra`, breadcrumb data, span data). A PII key in a nested dict, e.g. `{"profile": {"email": …}}` or the Mailjet payload key `Email` inside a variables dict, is not filtered.

## Evidence

- **Production, 2026-11-16**: a transaction event for `POST /api/auth/request-token` (trace `118f0633f1c5416f849288a9618a4ba7`) contains the serialized request body `data: { email: [Filtered] }`. The body is attached to transactions, and the `[Filtered]` marker (instead of `[REDACTED]`) shows that the scrubber ran but `before_send` didn't.
- **SDK source** (sentry-sdk 2.59.0, locked version):
  - `client.py`: `before_send_transaction` is the only user hook applied to transaction events.
  - `scrubber.py`: `EventScrubber.__init__(…, recursive=False)`. `scrub_dict` only recurses when `self.recursive` is set. Key matching is **case-insensitive** (`k.lower() in self.denylist`). `scrub_event` covers request, extra, user, breadcrumbs, frame vars and spans, but **not** exception values or messages.

## Impact

No active leak of known PII fields at the top level was found: the scrubber filters them on transactions too. The risk is a defence-in-depth gap:
- PII in nested request data or nested frame variables reaches Sentry on errors and transactions.
- Request headers reach Sentry on ~20 % of requests.
- Any future field that isn't on the denylist is covered by one layer fewer than documented.

Priority: low to medium.

## Proposed change

1. In `sentry_sdk.init`, add `before_send_transaction=_sentry_before_send`, so transactions get the same treatment as errors (headers, cookies and user stripped, known PII fields redacted).
2. Create the scrubber with `EventScrubber(pii_denylist=_PII_DENYLIST, recursive=True)` to close the nested-key gap. Small CPU cost per event; event sizes are bounded by the SDK.
3. Add a test that runs the real Sentry config with a capturing transport (no network). It sends a POST with a top-level and a nested PII field and asserts that neither value appears in the captured **error** event nor in the captured **transaction** event (tracing forced to 100 % in the test), and that no request headers appear.
4. Correct `doc/sentry.md`:
   - Layer 2 "Always strips: headers, cookies, user object" applies to errors **and** (after this change) transactions. Say so explicitly.
   - Layer 3 claims nested keys (`Email`) and exception values are scrubbed. Nested keys are only scrubbed with `recursive=True`; exception values and messages are never scrubbed by the SDK.
   - "What is NOT protected" says matching is case-sensitive. It's case-insensitive (`Email` and `email` are the same entry; the separate `Email` entry is redundant).
   - Mention that performance transactions carry request data and are covered by `before_send_transaction`.

## Acceptance criteria

- [ ] Transaction events from the backend contain no request headers and redact known PII fields with `[REDACTED]`, like error events.
- [ ] A PII key nested inside request data or a frame variable is filtered on both event types.
- [ ] The capturing-transport test covers both event types and passes; the full backend suite passes.
- [ ] `doc/sentry.md` matches the actual behaviour (points 4 above).
- [ ] No change to `traces_sample_rate`, `send_default_pii`, or the field list itself.

## Out of scope

- Turning off request bodies (`max_request_body_size="never"`) or local variables globally. Considered and rejected: it removes debugging context everywhere.
- Scrubbing exception messages (not supported by the SDK scrubber; would need a custom processor).
- Cleaning up existing transaction events in Sentry. Known fields were already filtered, and retention handles the rest. Revisit only if a nested PII case is found in existing data.
- The Twingle webhook (#2388). It gets its own endpoint-scoped Sentry processor (spec T10) and doesn't depend on this issue.

# Update donation goals automatically from a Twingle webhook

**Status**: IMPLEMENTATION (spec complete: all decisions T1–T13 settled, System impact by Archie done; Phase 1 implemented on branch `twingle-webhook`, not pushed; awaiting code review)
**Type**: Backend: new unauthenticated, signed webhook endpoint plus three new `DonationGoal` fields. No frontend change.
**Date created**: 2026-11-16

**Issue**: [#2388 Add Webhook to update actual donation goal results](https://github.com/climateconnect/climatehub/issues/2388)
**Requirements brief (input, authoritative for intent)**: `doc/requirements/twingle-donation-goal-webhook.md` (decisions D1–D18, open questions Q1–Q4, rules R1–R10, FR1–FR13). This spec refers to them by number and does not repeat them. Where this spec and the brief disagree, the brief wins. Raise the conflict with Harald.

**Touches** (areas, not a design):
- `backend/climateconnect_api/models/donation.py` (`DonationGoal`: three new fields only; `Donation` untouched, D16)
- `backend/climateconnect_api/admin.py` (`DonationGoal` is currently registered as a plain pass-through `ModelAdmin`)
- `backend/climateconnect_api/views/`, `backend/climateconnect_main/urls.py` (new endpoint)
- `backend/climateconnect_main/settings.py` (new secret setting; one `LOGGING` entry for the webhook logger, T9. `sentry_sdk.init` stays unchanged unless the T10 fallback is needed.)
- Docs: `doc/twingle-donation-webhook.md` (new ops guide), `doc/domain-entities.md`, `doc/api-documentation.md`, `doc/environment-variables.md`, `doc/sentry.md`, `doc/architecture.md`
- Already updated by Archie (state after implementation): `doc/mosy/architecture_overview.md`, `doc/mosy/flows/core-flows.md`, `doc/mosy/entities/system-entities.md`

---

## Problem Statement

The crowdfunding progress bars for the Erlangen, Marburg and (soon) Potsdam hubs show `DonationGoal.current_amount`. Today an admin types this value into the Django admin by hand. The bar goes stale (Erlangen: last edited about 10 weeks before the brief). That undersells a running campaign and costs the team recurring manual work. Donations are already collected in Twingle, and Twingle can push every new or changed transaction to a webhook.

**What we want**: a goal that is mapped to a Twingle project adds units automatically when a new recurring donation arrives. Admins keep correcting the number by hand where needed. We store no transaction and no donor data (guiding principle, D15).

**Why it matters**: visible momentum on the crowdfunding page while the campaign runs, less manual work for the team, and no new personal data on our side.

### Guiding principle (from the brief, binding)

Keep it simple and stateless. The counter exists only for the website and doesn't have to be exact. Admins correct `current_amount` by hand. **No new table, no transaction storage, legacy `Donation` model untouched.** The only schema change is three new fields on `DonationGoal`.

---

## Delivery phases

| Phase | Content | Required for #2388 |
|---|---|---|
| **1: Add** | Goal configuration (FR1–FR4), signed endpoint (FR5–FR11), add rules R1–R8, ops guide | **Yes: this task** |
| **2: Subtract** | Stop or error updates subtract units (FR12, R9, R10) | **No: not part of this task** (Harald, 2026-11-16). Nice to have per the brief (D10). Possible later task, after Q1(c) shows which transaction a stop update refers to (A3). |

This task delivers Phase 1 only. Section X and the Phase 2 tests are kept as a reference for a possible later task. A later Phase 2 must not need a schema change.

---

## User Stories

- As a **potential donor**, I want the progress bar to include recent donations, so that I trust the campaign is alive and see my own donation count.
- As a **hub team member**, I want progress to update without asking Climate Connect staff, so that I can share an up-to-date page with my community.
- As a **Climate Connect admin**, I want to map a goal to a Twingle project once and only step in for backfill and corrections, so that running several campaigns takes little effort.
- As a **maintainer**, I want a small stateless endpoint that never stores or leaks donor data and reports failures to Sentry, so that the integration is safe and cheap to run.

---

## Acceptance Criteria

### A. Goal configuration (Django admin): FR1–FR4

- **AC-A1**: A `DonationGoal` can be mapped to a Twingle project by entering the Twingle **project id** (D2), a text value such as `tw6a3547480226a`. The field is optional. A goal without a mapping behaves exactly as today.
- **AC-A2**: A `DonationGoal` has a **unit price** in € per month, defaulting to **7**. It must be greater than 0. Existing goals get the default.
- **AC-A3** (FR3, simplified by T12): A Twingle project id can be mapped to **at most one** goal, regardless of periods. This is enforced by a database unique constraint on non-blank values, and the admin shows a clear message on a conflict. Goals without a mapping are never in conflict. To reuse a Twingle project for a new campaign, the admin moves the mapping (or edits the existing goal).
- **AC-A4** (FR4): `current_amount` stays editable on mapped goals.
- **AC-A5**: The public endpoints `GET api/donation_goals_progresses/` and `GET api/donation_goal_progress/` return exactly the same fields as today. The Twingle project mapping and the unit price are **not** exposed publicly.
- **AC-A6**: The admin shows the project mapping and the unit price with help texts that explain them, e.g. where to find the project id in twingleMANAGER and what one unit means.
- **AC-A7** (T13): `DonationGoal` has a nullable timestamp `twingle_last_delivery_at`. The admin shows it **read-only**, also in the goal list, with a help text ("last validly signed Twingle delivery for this project, counted or not"). It isn't exposed publicly (AC-A5).

### S. Endpoint and security: FR6, FR7, D17

- **AC-S1**: A new public endpoint accepts **POST only**. Other methods get 405 and change nothing.
- **AC-S2**: The endpoint uses no session or token authentication, and CSRF checks don't block it. Its only authentication is the signature (FR7). A request carrying a Knox token (valid **or invalid**) or a session cookie is treated the same as one without. In particular, a stray invalid `Authorization` header must not produce a 401 from token authentication. Hint (I2): DRF views are already CSRF-exempt at middleware level, so having no authentication classes on this endpoint is enough.
- **AC-S3**: The signature in `X-Hub-Signature-256` (`sha256=<hex>`) is verified as HMAC-SHA256 of the **raw request body** with the configured secret, using a constant-time comparison. This happens **before** the body is parsed as JSON.
- **AC-S4**: A missing, malformed or wrong signature returns **401**, changes nothing and sends a Sentry **warning** that contains no body content (see section P).
- **AC-S5**: The secret comes from server configuration (environment), never from the repo. If the secret isn't configured, the endpoint **fails closed**: it rejects every request (see the response contract), changes nothing and reports a Sentry error. An unset secret must never mean "accept unsigned".
- **AC-S6**: The response body never echoes request content. A short fixed status message, or an empty body, is enough.

### N. Counting rules, Phase 1 (add): R1–R8, FR5, FR8

A delivery **adds** units only if all of AC-N3 to AC-N8 hold. Otherwise it changes nothing and is acknowledged with 2xx (FR8, D13), unless the response contract below says otherwise.

- **AC-N1** (R1): The amount is normalised to a monthly amount: `monthly` ×1, `quarterly` ÷3, `halfyearly` ÷6, `yearly` ÷12.
- **AC-N2** (R2): Units = monthly amount ÷ the goal's unit price, rounded **down**, per transaction. With the default price of 7: 7 €/month → 1, 10 €/month → 1, 14 €/month → 2, 5 €/month → 0, 84 €/year → 1, 21 €/quarter → 1, 42 €/half-year → 1. The arithmetic must be exact: a monthly amount that is an exact multiple of the unit price must never lose a unit to rounding (e.g. 84 €/year must give 1, not 0). A delivery that yields 0 units changes nothing.
- **AC-N3** (R3): `X-Twingle-Isupdate` is `0`.
- **AC-N4** (R4): `parent_trx_id` and `parent_transaction_guid` are both empty or absent.
- **AC-N5** (R5): `donation_rhythm` is not `one_time`.
- **AC-N6** (R6): `donation_error` is not set.
- **AC-N7** (R7, simplified by T12): `project_id` matches a goal's Twingle project mapping. **There is no period check**: the transaction `timestamp` and the goal's `start_date`/`end_date` are not compared. Whether a goal counts is controlled only by its mapping.
- **AC-N8** (R8): `currency_code` is `EUR`. Any other currency on a delivery for a mapped project changes nothing and writes a PII-free log line naming the currency.
- **AC-N9** (A5): The change is applied as an **atomic increment in the database**. It must not be a read-modify-write in Python. Concurrent deliveries and an admin save must not lose a webhook increment through the webhook path.
- **AC-N10**: Unknown extra payload fields are ignored (A6). Boolean-like fields (`donation_error`, `donation_recurring_stopped`) are read tolerantly: `true`, `1`, `"1"` and `"true"` count as set; `false`, `0`, `"0"`, empty, `null` or absent count as not set.
- **AC-N11** (L4): Stop and error updates (`Isupdate: 1` with `donation_recurring_stopped` or `donation_error` set) are acknowledged with 2xx and change nothing. Phase 2 isn't part of this task. Admins subtract by hand.

### X. Counting rules, Phase 2 (subtract): NOT part of this task, reference for a later task only (R9, R10, FR12)

- **AC-X1** (R9): An update (`X-Twingle-Isupdate: 1`) with `donation_recurring_stopped` or `donation_error` set, for a transaction that meets AC-N4, AC-N5, AC-N7 and AC-N8, subtracts the units computed by AC-N1/AC-N2, using the goal's **current** unit price (L7).
- **AC-X2** (D10): The subtraction applies even if the goal has ended. The goal is looked up by project mapping only, not by "currently active".
- **AC-X3** (R10): `current_amount` never goes below 0, even under concurrent deliveries. The floor is enforced atomically in the same database operation.
- **AC-X4**: Any other update (`Isupdate: 1` without stop or error) changes nothing.

### R. Response contract: FR9 (decided, T1)

Twingle treats any non-2xx as an error. Its retry behaviour is undocumented (Q2). The contract is designed so that **a non-2xx response always means no goal was changed**. A retried delivery can then never double-count because of our own error.

| Situation | Response | Goal changed | Sentry | Log line |
|---|---|---|---|---|
| Valid delivery that adds units | 200 | yes | – | yes (FR11) |
| Valid delivery that is ignored (unmapped project, follow-up booking, one-time, any `Isupdate: 1` including stop or error updates (AC-N11), 0 units) | 200 | no | – | no (optional debug level) |
| Mapped, non-EUR | 200 | no | – | yes (AC-N8) |
| Missing, malformed or wrong signature | 401 | no | warning | no |
| Secret not configured | 503 | no | error | no |
| Non-POST | 405 | no | – | no |
| Body isn't valid JSON or isn't a JSON object (after a valid signature) | 200 | no | warning | no |
| Mapped project, but a field needed for the decision is missing or unreadable (`X-Twingle-Isupdate`, `donation_rhythm` with an unknown value, `amount`, `currency_code`) | 200 | no | warning | no |
| Unexpected error (e.g. database unavailable) **before** the change is committed | 500 | no | error | no |

Rationale:
- Malformed payloads are acknowledged (2xx), because a retry can't fix them. Repeated non-2xx responses might lead Twingle to flag or disable the shared webhook for every project (FR8). Sentry gives us the visibility.
- Transient failures return 5xx, so that a Twingle retry (if there is one) can recover the donation.
- Once the change is committed, nothing after it may turn the response into a non-2xx. Logging problems must not fail the request.
- Field validation for "malformed" only matters once the project is mapped. Deliveries for unmapped projects are ignored without validating the rest, so other Twingle projects create no Sentry noise.

### P. Privacy and logging: FR10, FR11, D11

- **AC-P1**: No donor data is stored. The only database write is the change to `current_amount`.
- **AC-P2**: No Sentry event caused by this endpoint contains any part of the request body or any payload value. "Any Sentry event" covers error and message events, **performance transactions** (`traces_sample_rate=0.2`), breadcrumbs, exception messages, and **stack-frame local variables**. The existing `before_send` redacts by field name only, and Twingle's field names aren't on that list.
- **AC-P3**: No payload values other than `trx_id`, `project_id`, `currency_code`, the rhythm and the computed unit delta appear in application logs. The raw body, donor fields and the `amount` are never logged.
- **AC-P4** (FR11): Every change to a goal writes exactly **one** log line at INFO level or higher, starting with `twingle ` so it can be grepped. It contains the transaction id, the project id, the goal id and the signed unit delta, e.g. `twingle trx=<trx_id> project=<project_id> goal=<id> +2 units`.
- **AC-P5**: The AC-P4 line actually appears in the production App Service log stream of the web process (see insight I3: the current `LOGGING` config may drop INFO lines from non-`django` loggers).
- **AC-P6**: The signature header and the secret are never logged or sent to Sentry.

### D. Display: FR13

- **AC-D1**: No frontend change. After a delivery adds units, a fresh load of the crowdfunding page shows the new value (success criterion 1: ≤ 5 minutes). See insight I5 for the cache check.

---

## Constraints

- **No new table, no transaction storage, `Donation` untouched** (D15, D16). Only the three new `DonationGoal` fields and their migration.
- **No new dependency** is needed. The standard library and Django cover HMAC and constant-time comparison.
- **The existing PII protections stay as they are for every other endpoint.** Any Sentry or logging change for this endpoint must be scoped to it. Harald approved exactly two settings-level changes: the webhook logger entry (T9) and, only as a fallback, a `traces_sampler` that excludes this endpoint (T10). Anything else global needs his explicit approval.
- **Out of scope per D17**: replay protection, dual-secret rotation, OAuth, Basic Auth, IP allowlisting. Basic Auth only comes in if Q1(b) shows the signature isn't an HMAC. That would be a follow-up decision, not part of this task.
- **Backwards compatibility**: existing goals and the public GET endpoints behave exactly as before.
- Twingle's delayed delivery stays off (D18). Switching it on later wouldn't change the counting, because there is no period check (T12).

---

## AI Agent Insights and Additions

Findings from reading the code on `master` (1045c9f2d). These are context for the implementer and Archie, not design.

- **I1: Sentry sends more than the request body.** `sentry_sdk.init` in `settings.py` uses the SDK defaults for local variables. Stack frames of an exception therefore carry local variables, e.g. a parsed payload dict, and the `EventScrubber` only redacts denylisted **key names**. The Django integration also attaches the request body to events, and `before_send` doesn't run for performance transactions. A fix that only drops `request.data` in `before_send` does **not** satisfy AC-P2. The test in T-P1 checks the whole serialized event.
- **I2: Default DRF auth is Knox + Session (corrected by Archie).** `REST_FRAMEWORK.DEFAULT_AUTHENTICATION_CLASSES` includes Knox `TokenAuthentication` and `SessionAuthentication`. DRF views are already exempt from Django's global `CsrfViewMiddleware`. CSRF is enforced only through `SessionAuthentication`. So AC-S2 only needs **no authentication classes** on this endpoint. That also stops Knox from answering 401 to a stray invalid `Authorization` header.
- **I3: INFO logs don't reach production logs (verified by Archie).** `LOGGING` only attaches a console handler to the `django` logger. A module logger in the web process propagates to a root logger with no handler. Python's last-resort handler then prints WARNING and above only. Existing `logger.info` calls work in Celery workers, because Celery configures root logging there, but the webhook runs in gunicorn/uvicorn. Fixed by the scoped logger entry (T9, confirmed).
- **I4: The public serializer lists fields explicitly.** `DonationGoalSerializer` uses an explicit `fields` tuple, so new model fields don't leak into the public API by accident. AC-A5 just needs a regression test.
- **I5: FR13 cache check. Result: no cache longer than 5 minutes.** The frontend fetches `/api/donation_goals_progresses/` client-side, once per full page load, in `_app.tsx` (`useEffect` on mount → `UserContext.donationGoals`). The backend view has no `cache_page`, there's no Next.js revalidation and no HTTP cache header. Every fresh page load gets the current value, which meets ≤ 5 minutes. Only limitation: a visitor who stays in the single-page app and navigates client-side keeps the value from their first load until they reload. That's acceptable and unchanged. Note: the fetch only happens when the frontend env `DONATION_CAMPAIGN_RUNNING="true"`, so it's part of the go-live check. Goals are shown on `pages/hubs/marburg/crowdfunding.tsx`, `pages/hubs/potsdam/crowdfunding.tsx`, `DonationCampaignInformation` and the hub layouts.
- **I6: The admin form overwrites `current_amount` on save (new limitation, L8).** The webhook's atomic increment (A5) protects the webhook path only. If an admin opens a goal, a delivery adds units, and the admin then saves the form, the save writes the old value and the webhook's units are lost. This fits the guiding principle (admins correct by hand). The ops guide should tell admins to reload the goal right before editing `current_amount`. **Accepted by Harald (T11)**: no locking, and no "save only changed fields" admin.
- **I7: Encoding of Twingle values is unconfirmed.** `amount` is in whole euros (resolved, Q5). `timestamp` is a Unix epoch in seconds, e.g. `1793860981` (real payload), but it isn't used (T12). Boolean encoding is still unconfirmed; AC-N10 is tolerant on booleans.
- **I8: The existing `hmac.compare_digest` use in `auth_app/views.py`** shows the codebase already uses constant-time comparison. Mentioned as a precedent only.

---

## Tests

Django test framework and Factory Boy (a `DonationGoal` factory doesn't exist yet). Requests are signed in tests with a test secret set via settings override. Run the **whole** backend suite before reporting green, not only the new module.

**Configuration and admin**
- T-A1: Goal without a mapping: unaffected by any delivery.
- T-A2: Unit price defaults to 7. 0 or a negative value is rejected.
- T-A3: Unique mapping (FR3, T12): a second goal with the same project id is rejected (admin message and database constraint), also with a disjoint period; several goals with a blank mapping are allowed; surrounding whitespace doesn't bypass the check.
- T-A4: Public GET endpoints return the same field set as before (no project mapping, no unit price, no `twingle_last_delivery_at`).
- T-A5 (T13): `twingle_last_delivery_at` is read-only in the admin form.

**Security**
- T-S1: No signature header → 401, no change.
- T-S2: Wrong signature, signature over a different body, and malformed header value (no `sha256=` prefix, non-hex) → 401, no change.
- T-S3: Valid signature but body altered by one byte → 401.
- T-S4: Secret not configured → rejected (503), no change, even with a header that would match an empty secret.
- T-S5: GET/PUT → 405.
- T-S6: A valid request with a valid Knox token, an **invalid** `Authorization: Token …` header, or a session cookie attached behaves exactly like one without (no 401 from token auth, no CSRF rejection).
- T-S7: Sentry is called with a warning on bad signature (mocked capture).

**Counting, one test (or subTest group) per rule**
- T-N1 (R1): each rhythm normalises correctly: monthly, quarterly, halfyearly, yearly.
- T-N2 (R2): the example table from AC-N2, including 5 → 0 (no change) and exact multiples (84/year → 1). Also a goal with a non-default unit price.
- T-N3 (R3): `Isupdate: 1` doesn't add; missing header → no change + Sentry warning.
- T-N4 (R4): `parent_trx_id` set → no change; `parent_transaction_guid` set → no change.
- T-N5 (R5): `one_time` → no change; unknown rhythm → no change + Sentry warning.
- T-N6 (R6): `donation_error` set → no change; each tolerant encoding from AC-N10.
- T-N7 (R7): unmapped project → 200, no change, no Sentry; mapped project → counted regardless of `timestamp` and of the goal's `start_date`/`end_date` (including a goal that has ended).
- T-N8 (R8): non-EUR → no change and log line present.
- T-N9: two deliveries in a row add up (stacking with a manually set `current_amount`, D9).
- T-N10: unknown extra fields are ignored.
- T-N12 (T13): a validly signed delivery for a mapped project sets `twingle_last_delivery_at`, both when it's counted and when it's ignored (follow-up booking, one-time, update, non-EUR, malformed payload with a readable `project_id`). Bad signature, unmapped project and a database error before commit leave it unchanged. `updated_at` is never changed by the webhook.
- T-N11 (AC-N11): a stop update and an error update (`Isupdate: 1`) → 200, no change.

**Response contract**
- T-R1: invalid JSON / JSON array with a valid signature → 200, no change, Sentry warning.
- T-R2: mapped project with missing `amount` → 200, no change, Sentry warning.
- T-R3: database error during the update (mocked) → 500, no change.

**Phase 2 (later task, not part of this one; don't implement)**
- T-X1 (R9): stop update subtracts; error update subtracts; update without stop or error doesn't.
- T-X2: subtract works after the goal has ended.
- T-X3 (R10): subtracting more than `current_amount` leaves 0.
- T-X4: stop update for a follow-up booking or one-time donation → no change.

**Privacy**
- T-P1: With a payload whose donor fields carry unique sentinel values (name, email, IBAN, street), trigger (a) a bad-signature warning, (b) a malformed-payload warning and (c) an unexpected exception inside processing. Capture the Sentry events that would be sent (e.g. via a test transport or `before_send` hook). Assert that no sentinel and no raw body substring appears anywhere in the serialized events, including frame variables and breadcrumbs. Also capture a **transaction event** for (d) a successful counted delivery, with tracing forced to 100 % in the test. Assert that neither a sentinel value nor the `X-Hub-Signature-256` value appears in any captured event, errors and transactions alike (AC-P2, AC-P6).
- T-P2: Capture logs during a counted delivery: exactly one `twingle ` line with trx, project, goal and delta; no sentinel value; no amount.
- T-P3: Response bodies contain no payload content.
- T-P4 (AC-P5): With the project settings, the webhook's logger is enabled for INFO and has a handler, so the FR11 line reaches the web process's log output.

---

## Operations and go-live guide

To be written into the new doc `doc/twingle-donation-webhook.md` (see Documentation) as part of this task. Content required:

### One-time setup
1. Generate a strong random secret. Store it as the backend environment setting on the production App Service. It must be identical on both slots, and it isn't sticky. Never put it in the repo. Document it in `doc/environment-variables.md`.
2. In **twingleMANAGER** (Twingle organisation of Climate Connect): set the webhook URL to the production endpoint, **exactly as documented, with `https` and the trailing slash** (a missing slash causes a 301, which Twingle counts as an error), and enter the same value as "Secret für den Validierungshash". Leave delayed delivery **off** (D18), and no Basic Auth or OAuth (D17).
3. Check that the frontend production env has `DONATION_CAMPAIGN_RUNNING="true"` (I5).

### Mapping a goal to a Twingle project (per campaign)
1. Find the Twingle **project id** of the campaign project in twingleMANAGER (Q3, Q4).
2. In the Django admin, open the goal, enter the project id, check the unit price (7 € unless agreed otherwise), and save.
3. In twingleMANAGER, enable "Neue und geänderte Spenden an Webhook übertragen" for that project.
4. When the campaign ends, clear the project id on the goal (or switch off the webhook for the project). There is no period check (T12), so a mapped goal keeps counting after its end date.

### Q1 go-live test (one recurring test donation in a mapped project)
- [ ] The delivery reached us: App Service log shows the `twingle ` line, and `current_amount` went up by the expected units.
- [ ] (A1) The first delivery had `X-Twingle-Isupdate: 0` and empty `parent_*`. If the units didn't count, check Sentry and the rule order.
- [ ] (A2) The signature verified. If it failed with the correct secret, the signature isn't HMAC-SHA256 → stop and decide Basic Auth (D17).
- [ ] The unit count matches the test amount (sanity check; `amount` in euros is confirmed, Q5).
- [ ] Stop the test donation. (A3) Note which transaction the stop update refers to. Subtract the units by hand (Phase 2 isn't part of this task).
- [ ] Correct `current_amount` for the test payment (L1).

### Backfill
After the webhook is live for the project, compare `current_amount` with twingleMANAGER (active recurring first donations of the mapped project, converted with R1/R2) and set it by hand. Webhook changes stack on top (D9). **Reload the goal page right before editing `current_amount`**, because saving the admin form overwrites changes made since the page was opened (I6, L8).

### Checking that the webhook is alive
The goal list in the admin shows `twingle_last_delivery_at` per goal. Monthly follow-up bookings arrive regularly, so a mapped goal of a running campaign should show a recent value. If it's stale, check the Twingle webhook settings, the secret on both slots, and Sentry (401/503).

### Explaining a number
Grep the App Service log for `twingle ` and the goal id. Each line is one change (FR11). Deviations are corrected by hand (L1–L8).

---

## Documentation

- **`doc/twingle-donation-webhook.md` (new)**: the ops and go-live guide above, for admins and ops: setup, mapping a goal, Q1 checklist, backfill, explaining a number.
- `doc/domain-entities.md`: the three new `DonationGoal` fields and their meaning.
- `doc/api-documentation.md`: the webhook endpoint (exact URL, method, signature header, response contract table, no auth). Links to the ops guide.
- `doc/environment-variables.md`: the secret setting (required for the webhook, fail-closed when unset, same value on both slots, not sticky). Links to the ops guide.
- `doc/sentry.md`: section on this endpoint: how it's kept free of request bodies, headers and payload values (AC-P2, AC-P6), and the fallback if one is used. Links to the ops guide.
- `doc/architecture.md`: in "External Services", replace the generic "Payment Gateway (donations)" with **Twingle (inbound signed webhook)**.
- `doc/mosy/`: already updated by Archie. Check that it still matches what was built.

## Definition of Done

- [x] Phase 1 acceptance criteria (A, S, N, R, P, D) met. Phase 2 (section X) is not part of this task (Harald, 2026-11-16) and is not implemented.
- [x] Migration created and applied; existing goals unaffected.
- [x] Tests from the Tests section written; **full** backend suite passes (`cd backend && pdm run python manage.py test --keepdb`).
- [x] `make format` run.
- [x] Documentation updated (all items above), including the ops guide.
- [x] No frontend change (if one turns out to be needed, raise it with Harald first).
- [ ] Code review done with a focus on AC-P2, AC-S3 and AC-N9.
- [ ] Go-live checklist (Q1) handed over to Harald. Running it isn't part of code completion.

---

## Out of Scope

Everything in section 7 "Out of scope" of the brief. In particular: transaction storage or reuse of `Donation` (D15/D16), an admin list of processed donations, replay protection, secret rotation, OAuth, Basic Auth, IP allowlisting (D17), pulling from the Twingle API, automatic backfill, one-time donations, showing the unit on the page, donor recognition, self-service goal setup, several Twingle organisations. Also out of scope:
- Phase 2, subtracting on stop or error (FR12, R9, R10; section X)
- admin-form locking or a "save only changed fields" admin against concurrent webhook updates (I6, T11)
- any global change to Sentry or logging beyond the approved T9 logger entry and the T10 `traces_sampler` fallback

---

## Decisions (all settled, 2026-11-16)

Proposed by Taskie; confirmed, changed or dropped by Harald.

| # | Proposal | Why | Beyond the brief? |
|---|---|---|---|
| T1 | **Confirmed.** Response contract as in section R: 2xx for malformed payloads (with a Sentry warning), 5xx only for transient errors before any change, never non-2xx after a change. | FR9 asks for a decision. It's safe under unknown retries (Q2) and protects the shared webhook. | Decides FR9 |
| T2 | **Confirmed.** Unset secret → fail closed with **503** + Sentry error (not 401), so a misconfiguration is distinguishable from forged requests. | Fail closed is required by security; the code is a choice. | Small addition |
| T3 | **Confirmed.** A delivery for a mapped project that lacks `X-Twingle-Isupdate` or has an unknown rhythm is treated as malformed (no change, 2xx, Sentry warning), not guessed. | Avoids silent double counts if Twingle changes the format (A6). | Clarifies A6 |
| T4 | **Superseded by T12.** `timestamp` is a Unix epoch in seconds (real payload: `1793860981`), but it isn't used. | Harald | – |
| T5 | **Dropped.** The unique mapping (T12) makes more than one matching goal impossible. No special handling. | Harald | – |
| T6 | **Confirmed.** The Twingle project id mapping is stored as text and matched exactly after trimming whitespace. Real ids are alphanumeric strings, e.g. `tw6a3547480226a`. | Matches the real id format. | Clarifies FR1 |
| T7 | **Confirmed.** The unit price accepts euro amounts with cents, must be > 0, default 7. | FR2 says "€ per month"; cents cost nothing extra. Whole euros would also work. | Clarifies FR2 |
| T8 | **Dropped as a decision.** Phase 2 is a nice to have per the brief (FR12, D10) and is **not part of this task**. Section X is kept as a reference for a later task. | Harald | – |
| T9 | **Confirmed** (archie's recommendation). INFO lines don't reach production logs (I3, verified), so add one `LOGGING` entry for the webhook's own logger only: existing console handler, INFO, no propagation. | FR11 needs the line to be visible. Changing logging globally is a separate concern. | Yes: touches `settings.py`; **approved** |
| T10 | **Confirmed** (archie's recommendation). AC-P2 also covers performance transactions, headers and stack-frame variables. **Primary**: one Sentry event processor scoped to the endpoint's request (System impact > Sentry). **Fallback**, only if T-P1 can't pass with the processor: a `traces_sampler` that returns 0 for the webhook path and the current rate for everything else. No other global change to Sentry. **URL** (Harald): the webhook doesn't have to sit under `/api/`. The implementer may choose a separate path such as `/webhooks/twingle/` if it simplifies scoping (System impact > Placement). | Body-free Sentry events (FR10) aren't achievable via `before_send` alone (I1). Cost of the fallback: no performance traces for this endpoint. | Yes: monitoring side effect; **approved** |
| T12 | **Decided by Harald.** Keep it simple: a delivery for a mapped project counts, with **no period check** (drops the timestamp part of R7 and D3). Consequently a project id maps to at most one goal (unique constraint), replacing the overlapping-period check in FR3. Ops consequence: remove the mapping when a campaign ends, otherwise the ended goal keeps counting (invisible on the site, since the GET endpoint only returns active goals). | Simpler; no time handling. | **Overrides brief D3, R7 (period), FR3** |
| T13 | **Decided by Harald.** The webhook doesn't touch `updated_at`; it keeps meaning "last admin change" (who and what is in the admin History). A new nullable field `twingle_last_delivery_at` is set on every validly signed delivery for a mapped project, counted or not, as a liveness check. Set in the same atomic update as the increment when counting; otherwise its own single-column update. | Keeps admin edits and webhook activity apart; a reliable health check. | **Yes, one field beyond the brief; approved** |
| T11 | **Confirmed.** Accept and document limitation **L8** (admin form save overwrites concurrent webhook increments). No locking. Archie's "save only changed fields" admin option is **rejected**. | Harald: the admin must be able to adjust the amount by hand, and the number doesn't have to be exact because it's only for the web display. | New known limitation |

## Open Questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | Go-live test (A1, A2, A3): see the checklist above. | Harald | Go-live; a later Phase 2 (A3) |
| Q2 | Does Twingle retry failed deliveries? T1 is designed to be safe either way. | Harald / Twingle support | Nothing (T1 holds either way) |
| Q3 | ~~Does twingleMANAGER clearly show the project id?~~ **Resolved 2026-11-16 (Harald): yes.** Goals are mapped by `project_id` (D2); no `project_name` fallback. | Harald | – |
| Q4 | Which Twingle projects run the Erlangen, Marburg and Potsdam campaigns, and are they all in the same Twingle organisation? **Same organisation: yes** (Harald, 2026-11-16). The project ids are collected at go-live. | Harald | Go-live setup |
| Q5 | ~~Is Twingle's `amount` in euros or in cents?~~ **Resolved 2026-11-16 (Harald, real payload): euros**, e.g. `"amount": 30, "currency_code": "EUR"`. The parser should still accept a decimal value. | Harald | – |

---

## System impact

Written by Archie on 2026-11-16 and checked against `master` 1045c9f2d and sentry-sdk **2.59.0** (the locked version). Harald has since decided the recommendations below: T9 and T10 confirmed as recommended, the T11 option rejected. Annotations mark where a decision changed the text.

### Check of Taskie's findings

| # | Result | Evidence |
|---|---|---|
| I1 | **Confirmed, and the problem is wider than described.** | (a) `include_local_variables` defaults to on. (b) Our `EventScrubber` is **non-recursive** (SDK default), so it only matches top-level keys. A parsed payload dict in a frame variable or in the request data isn't scrubbed below its first level. (c) The Django integration attaches the DRF-parsed body (up to 10 KB, `max_request_body_size="medium"`) through a scope event processor. Those processors run for **transactions** too, but `before_send` doesn't. (d) **New:** the ASGI integration attaches request headers to transactions, filtered only by the SDK's sensitive-header list. `X-Hub-Signature-256` isn't on that list, and the global `before_send` strips headers on error events only. **Without a fix, about 20 % of deliveries would send the full donor payload and the signature header to Sentry inside a performance transaction** (violates AC-P2 and AC-P6). |
| I2 | **Confirmed, with one correction.** | DRF views are already exempt from Django's `CsrfViewMiddleware`. CSRF is enforced only through `SessionAuthentication`. The opt-out AC-S2 needs is **no authentication classes on this endpoint**. That also stops Knox from answering 401 to a stray invalid `Authorization` header. No default throttling applies, because only the `event_feed` scope is defined. |
| I3 | **Confirmed. The line is definitely dropped, not just possibly.** | With the project settings loaded, a module logger in `climateconnect_api` has effective level WARNING and no handler. Only `django` has an INFO console handler (stderr). Production runs `gunicorn … -k uvicorn.workers.UvicornWorker`, which doesn't configure the root logger. So T9 is **required** for AC-P5. It isn't conditional. |
| I6 | **Confirmed.** | `DonationGoal` is in the `pass_through_models` list in `admin.py` (plain `ModelAdmin`). Saving writes every field, including `current_amount`. |

### Placement and URL

- **App**: `climateconnect_api`, next to the existing donation-goal model, serializer and GET endpoints. No new app.
- **URL**: `POST /api/webhooks/twingle/`, registered in `climateconnect_main/urls.py` with the other donation endpoints. The **trailing slash belongs to the URL**: `APPEND_SLASH` answers a slash-less POST with a 301 in production, and Twingle counts that as an error. The `webhooks/` prefix groups inbound integrations without building a framework for them.
- **Allowed alternative (Harald, T10)**: the webhook URL may be completely separate from the normal API, so it doesn't have to sit under `/api/`. The implementer may choose a separate path such as `/webhooks/twingle/` if that makes scoping the Sentry processor (or the fallback `traces_sampler`) simpler. **The trailing-slash warning applies to any path**: `APPEND_SLASH` redirects a slash-less POST wherever the route lives. Record the final URL in the ops guide and the API docs.
- Server-to-server only. No CORS, no frontend link.
- **New setting**: one secret read from the environment (the implementer picks the name). It's the same value on both App Service slots and isn't sticky. If it's unset, the endpoint fails closed (AC-S5).

### Sentry: AC-P2, AC-P6 (I1, T10)

**Recommended: one event processor scoped to the endpoint, with no change to `sentry_sdk.init`.**

- The webhook registers an event processor on the request's Sentry **isolation scope** before it does anything else with the request. The Django integration creates one isolation scope per request and registers its own request processor on that scope. Processors run in registration order for **errors, messages and transactions** (everything except cron check-ins, verified in SDK 2.59). So one processor covers every event this request can produce, and no other request is affected.
- For each event, the processor removes the request body, headers, cookies and query string, the local variables of every stack frame, breadcrumbs, and `extra`. It keeps the exception type, the stack trace (file, function, line), the fixed message, tags, the transaction name, timings and spans. SQL spans carry no parameters, because `record_sql_params` is off.
- **Design rule that goes with it**: problems caused by the payload (invalid JSON, missing or unreadable fields, unknown rhythm) are reported as **fixed-text messages with a reason code**, never as captured exceptions. The processor doesn't clean exception messages, and parser errors echo their input. Bad-signature warnings use one fixed text, so they group into one Sentry issue.
- **Verification**: T-P1 must also capture a **transaction event** (tracing forced to 100 % in the test) and assert that no sentinel value and no signature header value appear in it.
- **Fallback, only if T-P1 can't pass with the processor**: a `traces_sampler` that returns 0 for this path and the current 0.2 for everything else. Other endpoints behave the same, but it changes the global init. **Approved by Harald as the fallback (T10).**
- **Rejected**:
  - `include_local_variables=False` and `max_request_body_size="never"`: both are global, both remove debugging data for every endpoint, and neither one alone covers headers or breadcrumbs.
  - `before_send_transaction`, or extending the global `before_send` by URL: both work, but they need two global hooks to do the job of one local processor, and they put knowledge about this endpoint into `settings.py`.

### Logging: AC-P4, AC-P5 (I3, T9)

- **Recommended, confirmed by Harald (T9)**: add **one** `LOGGING` entry for the webhook's own logger: the existing `console` handler, level INFO, no propagation. The change only adds an entry and leaves every other logger unchanged. The handler has no formatter, so the output is the bare message and starts with `twingle ` as AC-P4 requires.
- **Alternative with no change to settings**: log through the existing `django` logger. The `location` app already does this. It works today, but the lines end up in Django's namespace. Not chosen: Harald confirmed the logger entry (T9).
- **Not recommended here**: configuring the root logger. That would also make every `logger.info` in web views visible that production drops today. It's a separate concern (see risks).
- **Verification**: a test asserts that, with the project settings, the webhook's logger is enabled for INFO and has a handler. The Q1 checklist already confirms the line in the App Service log stream.

### Data model and migration

- `DonationGoal` gets **three columns**: an optional Twingle project id mapping (text, blank means unmapped), a unit price (€ per month, decimal, > 0, default 7), and a nullable `twingle_last_delivery_at` timestamp (T13). `Donation` stays untouched. No new table and no index, since the table has only a handful of rows.
- **Migration**: it only adds columns, it's reversible, and it needs no data migration (the default fills the existing Erlangen and Marburg rows). In PostgreSQL, adding a column with a constant default only changes metadata. There's no table rewrite and no locking concern.
- **During a slot swap**: both slots share the production database. While the deploy is running, an admin creating a goal on the **old** code would fail on the new non-null price column unless the default also exists in the database. The risk is negligible, because goals are created rarely. Either give the column a database-level default or don't create goals during the deploy.
- **FR3 (T12)**: a conditional unique constraint on the project id mapping (non-blank values only), part of the same migration. Values are trimmed before saving so the constraint sees the normalised value. No exclusion constraint or extension needed.
- **Atomic increment (AC-N9)**: a single conditional database update that also sets `twingle_last_delivery_at`. It deliberately doesn't set `updated_at`, which stays the admin's "last changed" (T13).
- The public serializer doesn't change (I4).

### Admin

- `DonationGoal` moves out of the pass-through list and gets its own admin configuration for the help texts (AC-A6) and a clear message for the unique mapping (AC-A3).
- **I6 / L8, an option for T11**: a simpler fix than accepting L8 exists. If the admin form saves only the fields the admin actually changed, a save that doesn't touch `current_amount` (for example a description fix) can't wipe out webhook increments. An overwrite then only happens when the admin edits `current_amount` on purpose, which is the intended correction. No locking is needed. **Rejected by Harald (T11)**: L8 is accepted, admins adjust the amount by hand, and the number only drives the web display. The admin keeps saving the full form.

### Documentation placement

- **Ops and go-live guide**: a new short doc, `doc/twingle-donation-webhook.md`, covering setup, mapping a goal to a Twingle project, the Q1 checklist, backfill and explaining a number. `doc/api-documentation.md` (endpoint), `doc/environment-variables.md` (secret) and `doc/sentry.md` (endpoint section) link to it. Reason: the guide is for admins and ops, while `api-documentation.md` is a 1,200-line developer reference.
- **`doc/architecture.md`**: `backend/agent.md` requires an update for a significant architecture change. Its "External Services" box lists a generic "Payment Gateway (donations)". Replace that with Twingle (inbound signed webhook).

### `doc/mosy/` impact (applied; describes the state after implementation)

- `doc/mosy/architecture_overview.md`: Twingle added as an external-system actor and as an external service.
- `doc/mosy/flows/core-flows.md`: new flow 11, "Twingle Donation Goal Update Flow".
- `doc/mosy/entities/system-entities.md`: new section 8, "Donations", with `DonationGoal`, including the three new fields. The entity wasn't documented before.
- No separate sequence-diagram file: flows 5–10 don't have one either, and the response contract in section R is the authoritative decision table. `doc/mosy/` has no OpenAPI or AsyncAPI spec, so none was created.

### Not affected

Frontend, the public GET endpoints, Celery, Channels, and the Sentry and logging behaviour of every other endpoint (with the recommended options).

### Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Donor payload or signature header reach Sentry through performance transactions (I1 c/d) | GDPR breach (D11) | Scoped event processor. T-P1 extended to cover a transaction event. Fallback: `traces_sampler` (approved, T10). |
| Log line not visible in production (I3, verified) | No audit trail (FR11) | T9 logger entry plus a settings test. Q1 checklist. |
| Webhook URL entered without the trailing slash, or with `http` | 301, every delivery fails | Ops guide gives the exact URL. The Q1 test catches it. |
| Secret missing on one slot | 503 after a swap; donations not counted until fixed | Secret isn't sticky and is set on both slots. Sentry error on 503. |
| Internet scanners send unsigned POSTs | Sentry noise and quota | One fixed message per reason, grouped into one issue. Sentry spike protection. |
| Old code on the other slot during deploy | Creating a goal in the admin fails | Database-level default, or don't create goals during the deploy. |
| Admin saves a stale form (I6) | Webhook increments lost | Accepted (L8, T11). Ops guide: reload first. |
| Signature isn't an HMAC (A2) | Every delivery rejected | Q1 go-live test before mapping real campaigns. |
| Repeated non-2xx responses make Twingle disable the shared webhook | Every Twingle project loses delivery | Response contract T1: only signature, configuration and transient errors return non-2xx. |

---

## Log

- 2026-11-16 14:40 UTC: Created by Taskie from the requirements brief `doc/requirements/twingle-donation-goal-webhook.md` (#2388). Code read on `master` 1045c9f2d: `DonationGoal` model and admin, donation views and serializer, Sentry and logging config in `settings.py`, DRF auth defaults, frontend goal loading in `_app.tsx`. FR13 check done (I5: no cache, ≤ 5 min met). Proposed decisions T1–T11 and new question Q5 await Harald's review. System impact pending Archie. Status: DRAFT.
- 2026-11-16: Q5 resolved by Harald from a real payload: `amount` is in whole euros (`"amount": 30`). Spec updated (I7, Q1 checklist, Open Questions, risks).
- 2026-11-16: Harald's review: T1, T2, T6, T7, T9 confirmed; T4 resolved (`timestamp` is Unix epoch seconds); T5 and T8 dropped (Phase 2 not part of this task); Q4 answered (same Twingle organisation). Terminology changed from "link" to "mapping" for the Twingle project id. Open: T3, T10, T11.
- 2026-11-16: Harald decided T12: no period check; a delivery for a mapped project always counts. FR3 becomes a unique mapping per project id. T4 superseded. Overrides brief D3/R7 (period part)/FR3 by explicit decision.
- 2026-11-16: Archie: System impact section added (checked against `master` 1045c9f2d and sentry-sdk 2.59.0). Corrected I2 (DRF views are already CSRF-exempt; no authentication classes needed). Verified I3. Widened I1 (transactions, non-recursive scrubber, signature header). `doc/mosy/` updated (architecture overview, flow 11, entities section 8).
- 2026-11-16: Taskie applied Harald's last decisions and Archie's corrections. T3 confirmed. T10 confirmed (scoped event processor, `traces_sampler` as fallback; webhook URL may live outside `/api/`, e.g. `/webhooks/twingle/`, trailing slash required). T11 confirmed (L8 accepted; "save only changed fields" rejected). **All decisions T1–T12 are settled.** Tests: T-P1 extended with a transaction event at 100 % tracing (no sentinel, no signature value); T-P4 added (webhook logger INFO plus handler); T-S6 covers an invalid token; T-N11 added. AC-S2 and I2 aligned with Archie's correction. AC-N11 added (stop and error updates ignored); Phase 2 marked as not part of this task throughout. Documentation: new ops guide `doc/twingle-donation-webhook.md` linked from the API, env-variables and Sentry docs; `doc/architecture.md` (Twingle replaces "Payment Gateway"); Touches updated. Remaining open questions (Q1 go-live test, Q2 retries, Q3 project id visibility) don't block implementation. Status: DRAFT → **IMPLEMENTATION**.
- 2026-11-16: Q3 resolved by Harald: the Twingle project id is visible in twingleMANAGER, so mapping by `project_id` (D2) stands; the `project_name` fallback is dropped.
- 2026-11-16: Harald decided T13: new field `twingle_last_delivery_at` (liveness check, set on every validly signed delivery for a mapped project); the webhook doesn't touch `updated_at`. Added AC-A7, T-A5, T-N12, ops section "Checking that the webhook is alive"; Archie's `updated_at` recommendation replaced.
- 2026-11-16: Harald explicitly confirmed the T10 fallback (`traces_sampler` returning 0 for the webhook path) as approved.
- 2026-11-17: Implementation started on branch `twingle-webhook` (Claude, for Harald).
- 2026-11-17: Phase 1 implemented (branch `twingle-webhook`, 6 commits, not pushed). Fields `twingle_project_id`, `twingle_unit_price`, `twingle_last_delivery_at` (migration 0103, with database defaults for the slot swap, a partial unique constraint and a check constraint `> 0`); own `DonationGoalAdmin`; setting `TWINGLE_WEBHOOK_SECRET`; logger `climateconnect_api.twingle` (T9); endpoint `POST /api/webhooks/twingle/` (`climateconnect_api/views/twingle_webhook_views.py`). Tests in `climateconnect_api/tests/test_twingle_webhook.py` (54); full suite 1176 tests OK (15 skipped) with `--keepdb`. Docs: new ops guide `doc/twingle-donation-webhook.md`, plus domain-entities, api-documentation, environment-variables, sentry, architecture. `doc/mosy/` checked: matches what was built. Open DoD items: code review, Q1 hand-over.
- 2026-11-17: **Deviation from System impact (Sentry)**: the event processor is registered on the request's isolation scope **and** its current scope. In sentry-sdk 2.59, Django's WSGI-style request processor sits on the current scope, and current-scope processors run after isolation-scope ones. With the isolation scope alone, T-P1 leaked the body on the WSGI path (checked by mutation test). Both scopes are forked per request, so it stays scoped (a test checks that other endpoints keep their request data). T-P1 runs through the real WSGI and ASGI handlers. The `traces_sampler` fallback wasn't needed.
- 2026-11-17: Implementation choices for Harald to confirm (not in the spec): (1) `amount` above 1,000,000 € is treated as malformed (200 + warning), which keeps the exact arithmetic cheap and `current_amount` in range. (2) A `donation_error` value outside the AC-N10 encodings is treated as malformed (not counted, warning). (3) `currency_code` is compared case-insensitively; the payload's `project_id` is trimmed. (4) The change line also names the rhythm (allowed by AC-P3): `twingle trx=… project=… goal=… +2 units (monthly)`. Values that aren't `[A-Za-z0-9_.:-]{1,64}` are logged as `-`. (5) OPTIONS also returns 405. (6) `DonationGoalFactory` lives in the test module, because `climateconnect_api/factories.py` uses the removed `factory.DjangoModelFactory` API and can't be imported. (7) The ops guide leaves the production API host as a placeholder (`api.climateconnect.earth` in old docs may be stale).
- 2026-11-17: Note: `make format` (black 26.3.1 in the PDM env) reformats 4 unrelated files that the pre-commit hook (black 23.12.0) formats differently. Those changes were reverted, not committed.

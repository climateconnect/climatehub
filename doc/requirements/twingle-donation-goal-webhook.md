# Requirements brief: Update donation goals automatically from Twingle

**Status**: Draft, ready for the spec phase. Q1 and Q3 are checks before go-live, and Q2 and Q4 don't block anything.
**Date**: 2026-11-12 (updated after the security and simplicity discussion)
**Stakeholder**: Harald Walker (product owner, maintainer)
**Issue**: [#2388 Add Webhook to update actual donation goal results](https://github.com/climateconnect/climatehub/issues/2388)
**Input**: brainstorm with Harald, Twingle support docs, prod data from Grafana, code as of `master` ca26de1c2.
**Decisions**: see section 10 (D1–D18)

Evidence tags: **[Confirmed]** stated by the product owner or verified in code and data · **[Researched]** cited external source · **[Assumed]** inference, not validated.

**Guiding principle** [Confirmed, Harald]: keep it simple on our side. The counter exists only for our website. It doesn't have to be 100% correct, because an admin can always correct `current_amount` by hand. Store as little as possible: no transaction records, no donor data.

---

## 1. Problem statement

Hub crowdfunding pages (Erlangen, Marburg, and now Potsdam) show a progress bar toward a donation goal. Donations are collected in Twingle, but the goal's current value is typed in by hand in the Django admin. [Confirmed] The bar falls behind as soon as nobody updates it: the Erlangen goal was last edited around 1 Sep 2026, about 10 weeks before this brief. [Confirmed, data] A stale bar undersells the campaign just when visible momentum matters most. It also costs the team recurring manual work for each running campaign. [Assumed]

## 2. Users and stakeholders

| Stakeholder | Real goal | Pain today | Success looks like |
|---|---|---|---|
| **Potential donor** visiting a crowdfunding page | Trust that the campaign is real and moving, and see their donation make a difference. | The bar may lag weeks behind. Their own donation doesn't show. [Confirmed, data] | The bar reflects new donations within minutes. [Assumed] |
| **Hub team / campaign owner** (Erlangen, Marburg, Potsdam) | Reach the goal and show progress to their community. | Depends on Climate Connect staff to update the number. [Assumed] | Progress updates without asking anyone. [Assumed] |
| **Climate Connect admin** | Run several campaigns with little effort. | Has to compare Twingle with the admin by hand and update each goal. [Confirmed] | Only occasional manual corrections (backfill, test payments, stops, rare duplicates). [Confirmed D9] |
| **Maintainers (volunteers)** | A small, safe integration with no donor personal data on our side. | – | A small stateless endpoint, no new tables, failures visible in Sentry. [Confirmed D15] |

## 3. Current situation

**Platform** [Confirmed, code]
- `DonationGoal` (`backend/climateconnect_api/models/donation.py`): `name` (+DE), `description`, `start_date`, `end_date`, `current_amount` and `goal_amount` (positive integers), `unit` (free text), call to action text/link, optional `hub`. It is edited only in the Django admin.
- `GET api/donation_goals_progresses/` returns all goals whose `start_date ≤ now ≤ end_date`. The frontend loads them into `UserContext.donationGoals`. Crowdfunding pages pick the goal by hub slug and render `DonationGoal` as "current/goal". The unit isn't shown.
- The legacy `Donation` model (81 rows, last one created 2022-12-31) could in theory be reused and extended. It isn't needed for this goal and stays untouched (D16).
- Twingle is used only as an embedded donation widget (`DonationWigetDialog`, `FloatingWidget`). The backend has no Twingle integration.
- Sentry runs with `send_default_pii=False` and a `before_send` hook that strips headers and redacts known PII fields **by name** (`backend/climateconnect_main/settings.py`). Twingle's field names (`debit_iban`, `user_street`, …) aren't on that list.

**Prod data** (2026-11-12) [Confirmed, data]

| Goal | Hub | Period | Current / goal | Unit | Last edited |
|---|---|---|---|---|---|
| Crowdfunding Erlangen | erlangen | 2026-08-09 → 2026-12-31 | 86 / 300 | – | ~2026-09-01 |
| Crowdfunding Marburg | marburg | 2026-10-11 → 2026-12-31 | 2 / 100 | – | 2026-11-04 |

Potsdam has a crowdfunding page (#2387) but no goal yet.

**Meaning of a unit** [Confirmed] Campaign donations are always recurring. One step toward the goal is **7 € per month**. The goal doesn't record that rule anywhere today. The goal is effectively counted in "7 €/month supporter equivalents".

**Twingle webhook** [Researched: [payload documentation](https://support.twingle.de/faq/de-de/9-anbindung-externer-systeme/108-documentation-for-webhook-payload), [connecting systems](https://support.twingle.de/faq/de-de/9-anbindung-externer-systeme/320-beliebige-systeme-an-twingle-anbinden-api-webhook-middleware), [external webhook setup](https://support.twingle.de/faq/de-de/9-anbindung-externer-systeme/111-kann-ich-einen-externen-webhook-fur-salesforce-anbinden)]
- One webhook URL **per Twingle organisation**, switched on per Twingle project ("Neue und geänderte Spenden an Webhook übertragen"). Every enabled project, including any non-campaign one, sends to the same endpoint.
- Sends a JSON POST for each **new or changed** transaction. **No historical data** is sent. Only transactions from activation onward arrive.
- The same transaction is sent again on every change. The header `X-Twingle-Isupdate` is `0` for a new transaction and `1` for an update.
- The endpoint must answer 200/201/202. Other codes count as errors. Retry behaviour isn't documented.
- **Authentication**: Basic Auth (credentials sent in `Authorization` on every call) or OAuth (Twingle fetches a token from our token URL before each call).
- **Signing**: optional "Secret für den Validierungshash". When it's set, Twingle sends a SHA-256 hash of the whole payload, made with the secret, in the header `X-Hub-Signature-256` as `sha256=<hash>`. Whether this is a standard HMAC isn't stated.
- **Delayed delivery**: optional delay of 3–30 min (default: none). It exists so donors can finish entering their details after paying.
- Relevant fields: `project_id`, `project_name`, `trx_id`, `parent_trx_id` / `parent_transaction_guid` (set only on follow-up bookings of a recurring donation), `timestamp`, `amount`, `currency_code`, `donation_rhythm` (`one_time`, `monthly`, `quarterly`, `halfyearly`, `yearly`), `donation_error`, `donation_recurring_stopped`.
- The payload also carries a lot of donor personal data (name, email, address, IBAN, birthday). There's no test or sandbox flag. No IP addresses are published.

## 4. Goal and success criteria

**Goal**: A crowdfunding donation goal linked to a Twingle project counts new recurring donations automatically. Admins keep correcting it by hand where needed, and we store no transaction data.

**Success criteria**
1. A new recurring donation in a linked Twingle project shows in the goal's progress shortly after Twingle sends it. Expected within seconds; acceptance threshold ≤ 5 minutes. [Assumed]
2. Monthly follow-up bookings and ordinary updates of a donation never change the count. [Confirmed D4, D15]
3. No donor personal data is stored or sent to Sentry. [Confirmed D11]
4. During a campaign, admins edit `current_amount` only for backfill and occasional corrections. A small deviation from Twingle is acceptable. [Confirmed D9, guiding principle]
5. No new database table. The goal gets only the fields it needs to be linked and configured. [Confirmed D15]

## 5. Counting rules

Each incoming request is handled on its own. Nothing about earlier requests is stored. A request either adds units to `current_amount`, subtracts them (nice to have), or is ignored.

**Units of a transaction** (used for adding and subtracting)

| # | Rule | Source |
|---|---|---|
| R1 | The amount is normalised to a monthly amount: monthly ×1, quarterly ÷3, half-yearly ÷6, yearly ÷12. | D7 |
| R2 | Units = ⌊ monthly amount ÷ goal's unit price ⌋. The unit price is set per goal and defaults to 7 €. Examples at 7 €: 7 €/month → 1, 10 €/month → 1, 14 €/month → 2, 5 €/month → 0, 84 €/year → 1. Rounding applies per transaction. | D6, D8 |

**When to add** (must have): all of these must hold.

| # | Condition | Source |
|---|---|---|
| R3 | `X-Twingle-Isupdate` is `0` (a new transaction). | D15 |
| R4 | `parent_trx_id` / `parent_transaction_guid` is empty (the first payment, not a monthly follow-up booking). | D4, issue |
| R5 | `donation_rhythm` is not `one_time`. | D5 |
| R6 | `donation_error` is false. | D10 |
| R7 | `project_id` is linked to a goal, and the transaction's `timestamp` falls within that goal's `start_date`–`end_date`. | D2, D3 |
| R8 | `currency_code` is `EUR`. Other currencies are ignored and logged. | D14 |

**When to subtract** (nice to have, FR12)

| # | Rule | Source |
|---|---|---|
| R9 | An update (`X-Twingle-Isupdate: 1`) with `donation_recurring_stopped` or `donation_error` set, for a transaction that meets R4, R5, R7 and R8, subtracts its units. This applies even after the goal has ended. | D10 |
| R10 | `current_amount` never drops below 0. | Assumed |

**Everything else** (other updates, follow-up bookings, one-time donations, unlinked projects, transactions outside the goal period) is acknowledged with 2xx and changes nothing.

Note: because the units come from the payload itself (amount, rhythm, unit price), a donation can be subtracted without having been stored. That includes donations from before go-live that an admin backfilled by hand, as long as they fall within the goal period. Manual edits of `current_amount` and webhook additions or subtractions stack on top of each other. [Confirmed D9]

## 6. Functional requirements

**Goal configuration (Django admin)**
- FR1: An admin can link a donation goal to a Twingle project by entering its Twingle `project_id` (or `project_name`, see D2/Q3). A goal without a link behaves exactly as today (manual only).
- FR2: An admin can set the unit price per goal (in € per month, default 7).
- FR3: A Twingle project can be linked to at most one goal with an overlapping period. The admin rejects a conflicting setup with a clear message.
- FR4: An admin can still edit `current_amount` on a linked goal, for backfill and corrections.

**Webhook endpoint**
- FR5: Each request is processed according to section 5, with no record of the transaction kept on our side.
- FR6: The endpoint accepts POST only and verifies `X-Hub-Signature-256` against the raw request body, using a secret stored in server configuration and a constant-time comparison. It does this before parsing the JSON. A missing or invalid signature is rejected with 401 and reported to Sentry as a warning.
- FR7: The endpoint doesn't use session or token authentication. Its only authentication is the signature.
- FR8: Requests for a project not linked to any goal, or outside every goal's period, are acknowledged with 2xx and otherwise ignored, so the shared Twingle webhook keeps working for every project.
- FR9: A malformed payload or a processing error is reported to Sentry. The response code for these cases is decided in the spec, taking into account Twingle's retry behaviour (Q2).
- FR10: Donor personal data is never stored or logged. Sentry events from this endpoint carry no request body at all, because name-based redaction doesn't cover Twingle's field names.
- FR11: Every change to a goal writes one log line with no personal data, e.g. `twingle trx=<trx_id> project=<project_id> goal=<id> +2 units`. It is the trail admins use to explain a figure, in place of a stored transaction list.

**Nice to have**
- FR12: Subtract units on a stop or error update (R9).

**Display**
- FR13: No frontend change is needed. The existing progress bar shows the updated `current_amount`. The spec checks whether a page caches the goals longer than the target in success criterion 1.

## 7. Scope

**In scope**: the signed webhook endpoint, the add rules (R1–R8), the Twingle link and unit price on the goal, the PII-free logging, operational docs (switching on the webhook and setting the signing secret in twingleMANAGER, linking a goal, backfilling).

**Nice to have**: subtracting on stop or error (R9, FR12).

**Out of scope**
- Storing transactions, including reusing or extending the legacy `Donation` table (D15, D16).
- An admin list of processed donations (replaced by the log lines in FR11).
- Replay protection, secret rotation with two valid secrets, OAuth, Basic Auth, IP allowlisting (D17).
- Pulling data from the Twingle API, and automatic backfill of historical donations (admins backfill by hand, D9).
- Counting one-time donations (D5).
- Showing the unit or the 7 € rule on the crowdfunding page.
- Donor recognition (badges, donor lists) or linking Twingle donors to Climate Connect accounts.
- Self-service goal setup by hub teams (stays in the Django admin).
- Several Twingle organisations or webhook URLs.

## 8. Known limitations (accepted)

These follow from storing nothing. An admin corrects `current_amount` by hand when they matter. [Confirmed, guiding principle]

| # | Limitation | When it happens |
|---|---|---|
| L1 | Test payments are counted. | During setup; Twingle has no test flag. |
| L2 | A new donation delivered twice is counted twice. | Only if Twingle re-sends an `Isupdate: 0` delivery (retries aren't documented). |
| L3 | A stopped or failed donation is subtracted twice (with FR12). | If Twingle sends another update for a donation that is already stopped, e.g. contact details changed afterwards. |
| L4 | Without FR12, stops and later payment failures aren't subtracted. | Every cancelled recurring donation during the campaign. |
| L5 | A donation that failed after it was counted, but before any update with the error arrives, stays counted until that update. | Short window; SEPA returns can take days. |
| L6 | A captured, validly signed request could be resent to raise the counter. | Needs access to real traffic. The worst outcome is a wrong number on the bar. |
| L7 | Changing the unit price mid-campaign doesn't recalculate earlier counts, and a later subtraction uses the new price. | Only if an admin changes the price during a campaign. |

## 9. Risks and assumptions

| # | Risk / assumption | Impact | Mitigation |
|---|---|---|---|
| A1 | A new first payment arrives with `X-Twingle-Isupdate: 0` and empty `parent_*`. Follow-up bookings arrive with `parent_*` set. [Confirmed for `parent_*` (issue); Assumed for the header] | Missed or double-counted donations. | Check with a test donation before go-live (Q1). |
| A2 | `X-Hub-Signature-256` is a standard HMAC-SHA256 (same header name and format as GitHub). [Assumed] | If it's a plain hash of secret + payload, it's weaker (open to length-extension attacks). | Check with a test delivery (Q1). If it isn't an HMAC, also turn on Basic Auth. |
| A3 | A stop is reported as an update of the **first** transaction. [Assumed] | If Twingle updates the latest follow-up booking instead, R9 ignores it as a follow-up. | Check with a test donation (Q1). If needed, R9 uses `parent_*` instead, still without storage. Only affects the nice to have. |
| A4 | Twingle's retry behaviour isn't documented. [Researched] | Lost deliveries leave the count too low (fixed by hand); retried ones raise L2. | Sentry on errors. Ask Twingle (Q2). |
| A5 | Webhook updates and a manual edit can arrive at the same moment. [Assumed] | A lost update on `current_amount`. | Apply the change as an atomic increment (spec). |
| A6 | The payload format can change ("fieldlist can be extended", fields may be renamed). [Researched] | Processing breaks. | Tolerate unknown fields. Missing required fields go to Sentry. |
| A7 | Personal data reaches our servers in transit. [Researched] | GDPR exposure if it's logged or reaches Sentry. | FR10. |

## 10. Decisions

| # | Decision | Source |
|---|---|---|
| D1 | Use the Twingle webhook (push), not the API (pull). | Issue |
| D2 | Link goals by Twingle **`project_id`**, not `project_name` as the issue suggested: the name is free text the customer can rename, while the id is stable. This holds only if twingleMANAGER clearly shows the project id. Otherwise we link by `project_name` (Q3). | Harald |
| D3 | Only transactions inside the goal's `start_date`–`end_date` count. | Assumed default |
| D4 | Follow-up bookings of a recurring donation (`parent_*` set) are not counted. | Issue, Harald |
| D5 | Only recurring donations count. Campaign donations are always recurring anyway. | Harald |
| D6 | A donation's contribution is proportional to its amount, rounded down per donation. | Harald |
| D7 | Rhythms are normalised to a monthly amount. | Harald |
| D8 | Unit price is configurable per goal, default 7 € per month. | Harald |
| D9 | Backfill, test payments and any other deviation are handled by editing `current_amount` by hand. The webhook adds or subtracts on top. There is no separate offset field. | Harald |
| D10 | Failed and stopped donations are subtracted, also after the goal has ended. This is a **nice to have**, not required for the first release. | Harald |
| D11 | No donor personal data is stored, logged or sent to Sentry. | Harald (keep it simple), privacy |
| D12 | Goal configuration stays in the Django admin. | Assumed default |
| D13 | Unlinked or out-of-period deliveries are acknowledged and ignored. | Required by the shared webhook URL |
| D14 | Only EUR is counted. | Assumed default |
| D15 | **Stateless processing**: no transaction is stored. New-donation deliveries add, stop or error updates subtract (nice to have), and everything else is ignored. The inaccuracies in section 8 are accepted. | Harald |
| D16 | The legacy `Donation` table is not reused or extended. | Harald |
| D17 | Security = HTTPS + the `X-Hub-Signature-256` signature + no PII in logs or Sentry. No OAuth, IP allowlist, replay protection or dual-secret rotation. Basic Auth only if the signature turns out not to be an HMAC (A2). A forged request can at worst change the website counter. | Brainstorm, Harald (keep it simple) |
| D18 | Twingle's delayed delivery option stays off. We don't need donor details. | Assumed default |

## 11. Open questions

| # | Question | Owner | Blocks |
|---|---|---|---|
| Q1 | Go-live test with one recurring test donation in a linked project, then stopping it. Check: (a) the first delivery has `X-Twingle-Isupdate: 0` and empty `parent_*` (A1); (b) the signature is an HMAC-SHA256 of the raw body (A2); (c) which transaction the stop update is for (A3). | Harald | Go-live, not the spec |
| Q2 | Does Twingle retry failed deliveries (how often, for how long)? | Harald / Twingle support | Response codes in FR9; doesn't block the spec |
| Q3 | Does twingleMANAGER clearly show the project id, so an admin can copy it into the goal? If yes, link by `project_id` (D2). If not, link by `project_name`. | Harald | Field choice in FR1; can be checked during the spec |
| Q4 | Which Twingle projects run the Erlangen, Marburg and Potsdam campaigns, and are all of them in the same Twingle organisation as the general Climate Connect donations? | Harald | Go-live setup |

## 12. Suggested next steps

1. Harald checks whether twingleMANAGER shows the project id (Q3) and asks Twingle about Q2.
2. Spec phase (taskie) with system impact (archie): new goal fields, endpoint, signature check, atomic increment, Sentry scrubbing for this endpoint, ops guide.
3. Go-live checklist: set the signing secret and switch on the webhook for the campaign projects, run the Q1 test donation, backfill `current_amount` by hand, then correct for the test payment.

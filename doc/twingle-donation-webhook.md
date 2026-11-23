# Twingle donation webhook: ops and go-live guide

Twingle pushes every new or changed donation transaction to our backend. When a
`DonationGoal` is mapped to a Twingle project, each **new recurring donation**
of that project adds units to the goal's `current_amount`, and the crowdfunding
progress bar shows the new value on the next page load. We store no transaction
and no donor data. The only trail is one log line per change.

Issue: [#2388](https://github.com/climateconnect/climatehub/issues/2388).
Spec: `doc/spec/20261116_1440_issue_2388_twingle_donation_goal_webhook.md`.
Endpoint reference: [API documentation](api-documentation.md#twingle-webhook).

## How a delivery is counted

A delivery adds units only if **all** of these hold:

- `X-Twingle-Isupdate` is `0` (a new transaction, not an update)
- `parent_trx_id` and `parent_transaction_guid` are empty (the first payment,
  not a monthly follow-up booking)
- `donation_rhythm` is `monthly`, `quarterly`, `halfyearly` or `yearly` (not `one_time`)
- `donation_error` is not set
- `project_id` is mapped to a goal (there is **no period check**)
- `currency_code` is `EUR`

Units = monthly amount ÷ the goal's unit price, rounded down per donation. At
the default 7 €: 7 €/month → 1, 10 €/month → 1, 14 €/month → 2, 5 €/month → 0,
84 €/year → 1.

Stops and payment errors are **not** subtracted. Admins correct `current_amount`
by hand.

## One-time setup

1. Generate a strong random secret, e.g. `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.
   Set it as `TWINGLE_WEBHOOK_SECRET` on the production backend App Service,
   with the **same value on both slots**, and **not** as a slot-sticky setting.
   Never put it in the repo. See [environment variables](environment-variables.md#twingle_webhook_secret).
2. In **twingleMANAGER** (Climate Connect's Twingle organisation):
   - Webhook URL: `https://<production API host>/api/webhooks/twingle/`. Use the
     host of the frontend's production `API_URL`, with **`https` and the
     trailing slash**. Without the slash, Django answers with a redirect, and
     Twingle counts that as a failed delivery.
   - "Secret für den Validierungshash": the same value as `TWINGLE_WEBHOOK_SECRET`.
   - Delayed delivery: **off**. No Basic Auth, no OAuth.
3. Check that the frontend production env has `DONATION_CAMPAIGN_RUNNING="true"`.
   Otherwise the page doesn't load the goals at all.

If the secret is missing on the active slot, every delivery is rejected with 503
and Sentry reports an error ("Twingle webhook rejected: secret not configured").

## Mapping a goal to a Twingle project (per campaign)

1. Find the Twingle **project id** of the campaign project in twingleMANAGER
   (e.g. `tw6a3547480226a`).
2. In the Django admin (DonationGoals), open the goal, enter the id in
   **Twingle project id**, check **Unit price** (7 € unless agreed otherwise),
   and save. A Twingle project can be mapped to only one goal. The admin shows
   an error if the id is already used by another goal.
3. In twingleMANAGER, enable "Neue und geänderte Spenden an Webhook übertragen"
   for that project.
4. **When the campaign ends, clear the Twingle project id on the goal** (or
   switch off the webhook for the project). There is no period check, so a
   mapped goal keeps counting after its end date. The site doesn't show ended
   goals, so this goes unnoticed otherwise.

To reuse a Twingle project for a new campaign, clear the id on the old goal
first, then enter it on the new one.

## Go-live test (Q1): one recurring test donation in a mapped project

- [ ] The delivery reached us: the App Service log stream shows a line like
      `twingle trx=… project=… goal=… +N units (monthly)`, and `current_amount`
      went up by the expected units.
- [ ] The first delivery had `X-Twingle-Isupdate: 0` and empty `parent_*`
      (assumption A1). If the units didn't count, check Sentry for a
      "Twingle webhook ignored: malformed payload" warning and its
      `twingle_reason` tag.
- [ ] The signature verified (assumption A2). If deliveries fail with 401 and
      the "Twingle webhook rejected: invalid signature" warning although the
      secret is correct, the signature isn't HMAC-SHA256. Stop and decide on
      Basic Auth (decision D17).
- [ ] The unit count matches the test amount.
- [ ] Stop the test donation. Note which transaction the stop update refers to
      (assumption A3, needed for a possible later "subtract" phase). Subtract
      the units by hand.
- [ ] Correct `current_amount` for the test payment.

## Backfill

After the webhook is live for the project, compare `current_amount` with
twingleMANAGER (active recurring first donations of the mapped project,
converted with the rules above) and set it by hand. Webhook additions stack on
top of the manual value.

**Reload the goal page in the admin right before you edit `current_amount`.**
Saving the admin form writes the value from when the page was opened. Units the
webhook added in the meantime are lost (known limitation L8, accepted).

## Checking that the webhook is alive

The DonationGoals list in the admin shows **Last Twingle delivery** per goal. It
is set on every validly signed delivery for the mapped project, whether it was
counted or not. Monthly follow-up bookings arrive regularly, so a mapped goal of
a running campaign should show a recent value. If it is stale, check:

- the webhook settings of the project in twingleMANAGER (URL with trailing slash),
- `TWINGLE_WEBHOOK_SECRET` on **both** slots,
- Sentry for "Twingle webhook rejected: …" (401 = signature, 503 = secret missing).

## Explaining a number

Grep the App Service log for `twingle ` and the goal id. Each line is one change:

```
twingle trx=52934 project=tw6a3547480226a goal=3 +2 units (monthly)
twingle trx=52990 project=tw6a3547480226a goal=3 ignored: currency CHF
```

Everything else (manual edits, test payments, stops) shows up only in the admin
History of the goal. Deviations are corrected by hand.

## Responses and Sentry

| Situation | Response | Goal changed | Sentry |
|---|---|---|---|
| Delivery that adds units | 200 | yes | – |
| Ignored delivery (unmapped project, follow-up booking, one-time, any update, 0 units) | 200 | no | – |
| Mapped project, non-EUR | 200 | no (log line) | – |
| Missing, malformed or wrong signature | 401 | no | warning |
| `TWINGLE_WEBHOOK_SECRET` not set | 503 | no | error |
| Not a POST | 405 | no | – |
| Body isn't a JSON object, or a mapped delivery lacks a needed field | 200 | no | warning |
| Unexpected error (e.g. database down) | 500 | no | error |

A non-2xx response always means nothing was changed, so a retry by Twingle can't
double-count. Sentry events of this endpoint never contain the request body,
headers or payload values (see [Sentry](sentry.md#twingle-webhook)).

## Known limitations

Counting is deliberately approximate. An admin corrects `current_amount` when it
matters:

- Test payments are counted.
- A new donation delivered twice is counted twice.
- Stops and later payment failures are not subtracted.
- Changing the unit price mid-campaign doesn't recalculate earlier counts.
- Saving the admin form overwrites units added since the page was opened (L8).

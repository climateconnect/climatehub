# Requirements brief: Waiting list for full events

**Status**: Draft epic. Harald will refine it with stakeholders before finalising. No GitHub issues have been created yet. Two items remain open (section 11, Q1 and Q5), and neither blocks the spec phase. The button label and layout for the waitlist state, and where the count sits in the registrations tab, are design tasks for the spec phase (D28, D34).
**Date**: 2026-11-04 (updated after the product owner's answers)
**Stakeholder**: Harald Walker (product owner, maintainer)
**Input**: solution brainstorm and answers from Harald (relayed), prod data from Grafana, code and docs as of `master` 825decf35.
**Decisions**: see section 13 (D1–D37)
**Related**: [event-registration-guest-seats.md](./event-registration-guest-seats.md) (places per registration, #2348), `doc/spec/20260715_1643_notify_event_guests_on_event_deletion.md`, `doc/mosy/metrics/analytics_events.md`

Evidence tags: **[Confirmed]** stated by the product owner or verified in code and data · **[Researched]** cited external source · **[Assumed]** inference, not validated.

---

## 1. Problem statement

An event on Climate Connect is fully booked as soon as its places or a required inventory or time slot option sell out. Everyone who arrives after that meets a disabled "booked out" button and leaves. [Confirmed, code] Seats that free up later go to whoever happens to check the page again, not to the people who wanted them first. Late-freed seats can stay empty. [Confirmed, data] Would-be attendees get no way to queue and no clear answer about their chances. The organiser and Climate Connect learn nothing about how many people wanted to come. [Confirmed] Each of those people is also a possible returning member (newsletter, other events), and today they are lost. [Confirmed, business goal]

## 2. Users and stakeholders

| Stakeholder | Real goal | Pain today | Success looks like |
|---|---|---|---|
| **Would-be attendee** (arrives after FULL, member or not) | Attend this event. Failing that, a clear answer in good time. | Disabled button, no option, no information. They must keep checking the page. [Confirmed, code] | A fair, low-effort way to get a freed seat, and a clear outcome either way. [Confirmed D3, D7] |
| **Registered attendee** | Attend. Cancel easily if plans change. | Little pain. | Cancelling stays easy. [Assumed] |
| **Organiser / team admin of the event project** | A full room. A predictable headcount for venue and catering. Little admin work. | Freed seats near the deadline may stay empty (Balkonien: 20 freed, 6 never refilled). [Confirmed, data] | Freed seats refilled automatically with no manual work. The waiting count visible in the UI. [Confirmed D3, D9, D22] |
| **Hub operators and partners** (e.g. the Marburg and Würzburg events) | Show reach and demand for their events. | No figure beyond "it was full". [Assumed] | The waiting count gives a rough demand figure. [Assumed] |
| **Climate Connect team: growth and newsletter** | More registrations. Registrants return (newsletter, other events). | Non-members bounce at FULL without an account. [Assumed, code: the button is disabled, so no auth flow starts] | Joining the waitlist is a normal event registration (with account creation and consent, as today), so it brings in people we would otherwise lose. [Confirmed D23] |
| **Maintainers (volunteers)** | Small, safe changes with low support load. | Any new registration state touches many queries (the attending audit). [Confirmed] | No overbooking, and no waitlisted person leaking into guest lists, exports or emails. [Confirmed] |

Insight: with the waitlist **on by default** (D1), it serves the would-be attendee (fairness, clarity), the organiser (refill with no effort) and the growth goal (people captured as registrants instead of bouncing) on almost every full event. What remains uncovered is deliberately accepted: people beyond the cap get nothing (D16), and demand measurement and config history are out of this epic (D13). [Confirmed]

## 3. Current situation

**Platform today** [Confirmed, code and `doc/domain-entities.md`]
- Registration requires an account. A non-member registers through the auth flow inside `EventRegistrationModal`. Account creation and consent work the same for everyone.
- `EventRegistrationConfig.status`: `open`, `closed` (organiser), `full` (system), and `ended` (computed when `registration_end_date` has passed). The status becomes FULL when the booked places reach `max_participants`, **or** when a required inventory or time slot field is sold out (`evaluate_registration_status` in `backend/organization/utility/event_registration.py`). A cancellation that frees capacity reopens the event to OPEN.
- On a FULL event the register button is disabled ("Ausgebucht" / "Booked out"), and the modal does not open. The event page shows a seat counter ("x / y seats available") next to the button while registration is open.
- GA4 already fires `event_registration_button_impression` with `registration_status: "full"`. It only covers users who accepted statistics cookies. It is a retroactive, partial view of interest in full events, available without code.
- Guest messaging (`SendOrganizerEmailView`, `SendEmailToGuestsModal`): organisers email active guests, with a "new guests only" option and a test send.
- Event deletion notifies active guests (spec 20260715_1643). There is no separate "event cancelled" state. Balkonien was cancelled by renaming it "Abgesagt …".
- Admin-cancelled users cannot register again until an admin reinstates them.
- **Data retention**: there is no cleanup of event registration data. Registrations, cancelled registrations and custom-field answers are kept indefinitely, also for past events. The only scheduled cleanups are login tokens and login audit logs (`backend/climateconnect_main/celery.py`). [Confirmed, verified by Harald] This is a general gap, not specific to the waitlist (D20).
- There is no history of `EventRegistrationConfig` changes (status, capacity, end date). This stays out of this epic (D13).

**Prod data** (Grafana; events with registration enabled, real capacity, registration period ended) [Confirmed]
- About 50 limited events. Only 3 reached FULL:
  - Balkonien '26 Marburg: capacity 134, full 14.8 days before the end, 20 seats freed, 14 rebooked through reopen, ended at 128/134.
  - Würzburg hitzefrei! Kickoff: capacity 60, full only at the very end, which fits a capacity raise.
  - Wärmeplanung on Tour: capacity 105, full 2.8 days before the end, no cancellations.
- Seat cancellation rate: about 10% overall, 6.9% on never-full events, 13–15% on the busiest.
- Cancellation timing (89 seats): 29 more than 7 days before registration end, 26 at 2–7 days, 33 less than 2 days before, 1 after. Registration end often equals event start.

**What the data implies** [Assumed, derived from the data above]
- In the observed history, a waitlist would have refilled **at most about 6 more seats** (Balkonien). Reopening already refilled 70% of freed seats. The direct volume gain is small. The main benefits are fairness, refilling without effort, and capturing people as registrants (D14).
- 37% of freed seats are freed in the last 2 days, so auto-promotion will often notify people at short notice (Q1).

**Comparable platforms** [Researched]
- **Meetup**: automatic promotion in queue order for free events, with a notification on promotion. A party only moves up if there is room for all of them. ([Meetup Help: join a waitlist](https://help.meetup.com/hc/en-us/articles/41229648295181-How-to-Join-an-Event-Waitlist-on-Meetup))
- **Luma**: opt-in "Over-Capacity Waitlist". Guests complete the registration questions when joining. Hosts approve manually. Sold-out ticket types alone don't trigger the waitlist. ([Luma Help: Waitlist](https://help.luma.com/p/waitlist))
- **Eventbrite**: the waitlist triggers when a ticket type or the event sells out. Spots are released with a configurable claim time. An optional size limit can be set. People can't see their rank. ([Eventbrite Help: set up a waitlist](https://www.eventbrite.com/help/en-us/articles/811539/))
- **Mobilize** (used by advocacy and climate groups): opt-in per timeslot, auto-advance or manual. No cap. Email on joining and on promotion. Organisers see the waitlist count. ([Mobilize Help](https://help.mobilize.us/en/articles/12754348-enable-and-manage-a-waitlist-beta))
- The agreed direction is closest to Meetup and Mobilize auto-advance. Unlike Luma, it also applies when a required option sells out (D17). Like Eventbrite, the queue position is not shown (D19).

## 4. Key user flows

Throughout this brief, "FULL" means the existing system status: places or a required inventory or time slot option sold out (D17).

**A. Organiser and the waitlist setting** [Confirmed D1]
1. Every event with registration has the waitlist on by default. The organiser can turn it off in the registration settings. No other options (D5).
2. This applies to all events, including published events whose registration is still open at release (D36).

**B. Would-be attendee joins** [Confirmed D2, D19, D24]
1. The event is FULL, the waitlist is on and has room. The event page, the browse cards and the similar-events sidebar all offer waitlist registration instead of only "booked out" (D30). The button label and layout are designed in the spec phase. Space is very limited on browse cards and in the mobile footer bar (D28).
2. They open the existing registration modal. It explains what to expect, along the lines of "You'll be registered automatically if a place frees up. We'll email you." (D29) They log in or sign up inside the modal (as for any registration), pick places, fill the full form (custom fields, inventory, time slot), and confirm. This is a registration that awaits confirmation.
3. They get a "you're on the waiting list" email (EN/DE). It says that promotion is automatic, that it stops at registration end, and how to leave the list.
4. Exceptions:
   - Waitlist full (cap reached), or waitlist off: everywhere (event page, cards, sidebar) it looks exactly like today's "booked out" state, with nothing else offered (D16, D31).
   - Already registered or already waitlisted: they are shown their state.
   - Admin-cancelled user: blocked, the same as for registration (D24).
   - FULL because a required option sold out: they may pick that sold-out option. Promotion waits until it is available again (D17).

**C. A seat or option frees up** [Confirmed D3, D17, D25]
Triggers: a cancellation by a guest or the organiser, a capacity raise, or freed inventory or time slot.
1. The system matches all free capacity against the queue in order. The first person who fits **both** places and their chosen inventory or time slot options is registered. This repeats until nobody fits.
2. Each promoted person gets a "you're in" email with a one-click cancel link and is from then on a normal guest. If `notify_admins` is on, the team admins get the same notification, with the same details, as for a normal registration (D33).
3. If nobody fits, the event reopens as today. People still waiting keep their place.
4. Exceptions:
   - After `registration_end_date`, nobody is promoted (D6).
   - While the organiser has registration manually closed, promotion still happens (D25).
   - Promotion cutoff before event start: open (Q1).
   - Organiser lowers capacity: nobody is promoted.
   - Concurrent changes: never overbook.

**D. Waitlisted person checks their status or leaves** [Confirmed D32]
A waitlisted user sees their status in the existing "my registration details" view that registered users already have. The leave action is there, in the same place as cancel, and the email link also offers it. Leaving frees waitlist capacity, not seats. Admins are not notified about joining or leaving (D35).

**E. Registration period ends** (`registration_end_date`) [Confirmed D7, D25]
Everyone still waiting gets one "didn't make it" email (EN/DE) with no suggestions. When the organiser closes registration manually, nothing is sent. If the organiser extends the end date after these emails went out, those entries stay closed. The people can join the waitlist or register again like anyone else (D37).

**F. Organiser messages the waitlist** [Confirmed D8]
In the existing guest message dialog, the organiser picks the recipients: guests or waiting list. The content is up to the organiser, including promoting another event.

**G. Event deleted or cancelled** [Confirmed D21]
Waitlisted people are notified whenever registered guests are notified. Today that is the deletion notification.

## 5. Pain points (ranked)

1. **Would-be attendees have no path once an event is FULL.** They get a disabled button and a manual re-check lottery. This is unfair and frustrating. [Confirmed]
2. **People interested in a full event are lost to the platform.** No registration, no follow-up. [Confirmed, business goal]
3. **Late-freed seats stay empty or need organiser effort.** Small in the data (about 6 seats across 3 full events). [Confirmed, data]
4. **Unmet demand and config changes are invisible.** Acknowledged, but low priority given the usage numbers (D13). [Confirmed]

## 6. Requirements

**Must: waitlist core**
- M1. Every event with registration has a waitlist, on by default. This includes published events whose registration is still open at release. Organisers can turn it off in the registration settings. [Confirmed D1, D36]
- M2. When the event is FULL (places or a required option sold out) and the waitlist is on and below its cap, a member can join with the full registration form (places, custom fields, inventory, time slot), including options that are currently sold out. Joining is an event registration that awaits confirmation, with the same account, consent and blocking rules as normal registration. [Confirmed D2, D17, D23, D24]
- M3. Waitlist cap = 20% of `max_participants`, counted in places, with a small hardcoded floor for tiny events. It applies whatever made the event FULL. No organiser setting. [Confirmed D5, D17]
- M4. Freed capacity from any source (cancellation, capacity raise, freed inventory or time slot) is offered in queue order to the first person whose places **and** chosen options fit. This repeats until nobody fits. Nobody is ever overbooked. [Confirmed D3, D17]
- M5. A promoted person is registered, gets a "you're in" email with a one-click cancel link, and from then on is treated exactly like any other guest. If `notify_admins` is on, the team admins are notified of the promotion with the same details as a normal registration notification. [Confirmed D3, D33]
- M6. If nobody in the queue fits, the event reopens as today. [Confirmed D3]
- M7. No promotion after `registration_end_date`. Promotion continues while the organiser has registration manually closed. [Confirmed D6, D25]
- M8. A waitlisted person sees that they are on the waitlist (not their position) in the existing "my registration details" view, and can leave the waitlist there, in the same place as cancel. [Confirmed D19, D32]
- M9. Organisers see the waitlist count (people and places) in the existing "registrations" tab, next to its counters. Where and how the numbers are shown is a spec-phase UX choice. There is no alert, and admins are not notified on join or leave. [Confirmed D9, D22, D34, D35]
- M10. Waitlisted people never appear in or count toward: the guest list, CSV exports, guest emails (unless the organiser picks the waitlist), the seats-left display, inventory and time slot capacity, or the "registered" state. [Confirmed D9, D12]
- M11. "Didn't make it" email to everyone still waiting when `registration_end_date` passes, at most once per person. No email on a manual close. These entries stay closed even if the end date is extended later. [Confirmed D7, D25, D37]
- M12. Guest message dialog: a "Waiting list" recipient option. The content is free. [Confirmed D8, D18]
- M13. Waitlisted people are notified when the event is deleted or cancelled, the same as registered guests. [Confirmed D21]
- M14. When waitlist registration is possible, the event page, the browse cards and the similar-events sidebar all offer or indicate it consistently. They do not just say "booked out". The button label and layout are designed in the spec phase, within the very limited space on browse cards and in the mobile footer bar. [Confirmed D28, D30]
- M15. All new text and emails in English and German. The established term is "Warteliste". [Confirmed]
- M16. The registration modal tells people joining the waitlist what to expect, along the lines of "You'll be registered automatically if a place frees up. We'll email you." [Confirmed D29]
- M17. When the waitlist is full (cap reached) or turned off, every surface looks exactly like today's "booked out" state. [Confirmed D16, D31]

**Should**
- None.

**Could (later, outside this epic)**
- C1. Event suggestions in the "didn't make it" email. [Confirmed as a follow-up]
- C2. A full waitlist view for organisers (names, answers, order). [Confirmed as a follow-up]
- C3. GA4 events for the waitlist funnel (impression of the join button, joined, left), following `analytics_events.md`. Not a prerequisite. [Assumed]
- C4. History of registration settings changes (status, capacity, end date, actor). [Confirmed as nice-to-have, D13]
- C5. Demand tracking beyond the waitlist count. [Confirmed as nice-to-have, D13]
**Separate issue, outside this epic**
- Retention and cleanup of event registration data, waitlist included. See D20 and the draft issue in section 14.

## 7. Success criteria

Targets are open (Q5). The metrics use data the waitlist stores anyway (registration rows and their states) plus existing GA4 and prod queries. **New instrumentation is not a prerequisite** (D14).

| Goal | Metric | Source |
|---|---|---|
| More registrations | Places filled by promotion per FULL event. Empty places at registration end on events that were ever FULL (historical: Balkonien 6). Refill share of freed places (historical: 14/20 = 70% via reopen). | Prod DB (registration and waitlist states, timestamps) |
| Engagement | People who joined a waitlist (members and new accounts). Among those not promoted: later registrations for other events. | Prod DB (account creation time vs waitlist join time, later registrations) [Assumed approach] |
| Demand visibility (side effect) | Places requested on waitlists per FULL event. | Prod DB |
| Attendee experience | Share of promoted people who cancel via the one-click link. Promotions less than 24 h before event start (input for Q1). | Prod DB |
| Adoption | Share of limited events where organisers turned the waitlist off. | Prod DB (setting) |
| Safety | Zero overbooking. Zero waitlisted people in guest lists, exports or guest emails. | Tests, audit, support reports |

Optional baseline without code: per FULL event in the past, places freed and refilled and empty places at the end (already in Grafana), plus GA4 impressions of the "booked out" button.

Caution: only 3 of about 50 limited events were ever FULL, so results will be noisy for months. Report per event. [Assumed]

## 8. Constraints and dependencies

- **Privacy and GDPR**
  - Joining is an event registration, with the same terms, consent and account rules as today. Nothing new on signup or newsletter consent (D23). [Confirmed]
  - Organiser messages to the waitlist, including promotion of other events, are covered by the same terms as guest messages. The content is not controlled by the platform (D18). [Confirmed]
  - Retention of waitlist answers follows the general rule for registration data, which doesn't exist yet. The general gap is handled as a separate issue (D20). [Confirmed]
  - Organisers see only counts (D9).
- **i18n**: EN and DE for all UI text and the new emails (joined, you're in, didn't make it), including plural forms for places.
- **Entities affected**: `EventRegistration` (waitlisted state, D11), `EventRegistrationConfig` (waitlist setting, default on), and `RegistrationFieldAnswer` (answers of waitlisted people, including sold-out options, must not count toward inventory or time slot capacity). Mosy docs (`system-entities.md`, `core-flows.md` flows 8 and 9) need updates.
- **Existing flows touched**: register (including the registration modal text), self-cancel, organiser cancel, organiser edits capacity, deadline or status, guest messaging, CSV export, event deletion notification, FULL and reopen logic, the registration button and seat counter on the event page, browse cards, similar-events sidebar and mobile footer bar, the "my registration details" view, the organiser "registrations" tab and its counters, and admin notifications (`notify_admins`).
- **Dependencies**: places per registration (#2348) is live, and promotion matching depends on it. No other dependency.
- **Volunteer capacity**: medium-sized, mainly because of the attending audit.

## 9. Scope

**v1 (this epic)**: M1–M17.

**Not in v1**
- Anything offered beyond the cap or when the waitlist is off. It stays "booked out" (D16).
- Organiser alert when the waitlist fills (D22).
- Showing the queue position or the waiting count to users (D19).
- Event suggestions in the "didn't make it" email and automatic "similar events" sending (C1, D10).
- An organiser waitlist view, manual promotion, removing or reordering individual entries (C2).
- Registration settings change history and demand tracking (C4, C5, D13).
- GA4 waitlist events (C3).
- An organiser-configurable cap, claim windows, broadcast or first-come release (D4, D5).
- Promotion after `registration_end_date` (D6).
- Changes to signup, consent or `signup_source` (D23).
- Data retention and cleanup for registrations (a separate issue, D20).
## 10. Assumptions and risks

| Item | Type | Validation |
|---|---|---|
| Direct registration gain is small (about 6 seats historically) | Risk to expectations | Agreed: judge on fairness, refills and captured registrants, not volume (D14). |
| Late promotions (37% of freed seats come in the last 2 days) lead to no-shows | Risk | Track promotions less than 24 h before start and one-click cancels. Q1. |
| On by default surprises organisers who expect a hard stop at capacity (e.g. a promoted person arrives they didn't plan for) | Risk | The waitlist never exceeds capacity, so headcount stays within `max_participants`. Make the setting visible in the registration settings. Watch support requests. |
| Waitlisters pick options that are sold out and stay sold out, so they wait without a real chance | Risk (D17) | The "didn't make it" email closes the loop. Watch how often FULL is caused by inventory. |
| A "not cancelled = attending" query is missed, and a waitlisted person leaks into a list, export, email or count | Risk (high impact) | Hand-off: central audit and tests. |
| Waitlisted-not-promoted people have a worse impression than if they had never joined | Risk | Clear "didn't make it" email. Look at their later registrations (section 7). |
| Waitlist answers kept indefinitely like all registration data | Risk (general, D20) | Separate retention issue. |
| Promotion during a manual close fills seats the organiser meant to hold | Risk, accepted (D25) | The end result for the organiser is unchanged. Watch feedback. |
| No good button label fits on browse cards and in the mobile footer bar, so the waitlist state is unclear or breaks the layout | Risk (D28) | Spec phase: mock up the card, desktop and mobile footer states in EN and DE (German labels are longer) before building. |
## 11. Open questions (ranked by scope impact)

1. **Q1. Promotion cutoff before event start.** Registration end often equals event start, and 37% of freed seats come in the last 2 days. Should promotion stop some hours before start? Harald's current leaning: no extra rule. Organisers for whom it matters should set an earlier registration end date. *Harald, after talking to stakeholders.*
2. **Q5. Targets** for the metrics in section 7. *Harald.*

Answered on 2026-11-04: Q2 (event page UX, D28–D32, D34), Q3 (D37), Q4 (D36), Q6 (D35). The button label and layout, the seat counter in the waitlist state, and where the waitlist numbers are shown in the registrations tab are design tasks for the spec phase, not open product questions.

Not blocking this epic: the separate retention issue (D20) needs an explicit decision on the delay after an event before registration data is removed.

## 12. Hand-off notes (needs, not solutions)

- **Attending audit (known risk)**: the waitlisted state goes on the existing `EventRegistration` row (D11). Every query that treats "not cancelled" as "attending" must be found and made explicit: booked seats, `available_seats`, the FULL evaluation (including `_are_required_fields_sold_out`), inventory and time slot `booked_count`, guest list, CSV, guest emails (`SendOrganizerEmailView`), the deletion notification (which must include the waitlist, D21), organiser notifications, the "registered" UI state, and analytics. A single, central definition of "attending" is needed so this can't regress. The architect owns the design.
- **Promotion must be race-free and consistent** across all triggers: self-cancel, organiser cancel, a capacity raise, freed inventory or time slot, and cancellations during a manual close. Several triggers can fire at once. The guarantee against overbooking from #2348 must hold.
- **Matching** checks places plus every inventory or time slot choice in the stored answers, against all free capacity. Answers may name options that were sold out when the person joined (D17).
- **Cap** is in places (20% of `max_participants`) whatever caused FULL. The floor value for tiny events is for the spec writer to set.
- The unique `(user, registration_config)` constraint and row reuse on re-registration interact with the waitlisted, promoted and cancelled states. Admin-cancel blocking applies to waitlist joins (D24).
- Scheduled work is needed at `registration_end_date` (the "didn't make it" email). It must be idempotent and survive worker outages (see the recent Celery robustness specs). A manual close must not trigger it (D25).
- **Design constraint (D28)**: the spec phase must define the button label and layout for the waitlist state on the event page (desktop and mobile footer bar), browse cards and the similar-events sidebar, including the seat counter, in EN and DE. Space on browse cards and in the mobile footer bar is very limited. Waitlist-full and waitlist-off states reuse today's "booked out" state (D31).
- **Admin notification on promotion (D33)**: a promotion must trigger the same admin notification, with the same details, as a normal registration when `notify_admins` is on. There are no admin notifications for joining or leaving the waitlist (D35).
- The waitlisted status and the leave action go into the existing "my registration details" view (D32). The waitlist count goes into the existing organiser "registrations" tab (D34).
- The one-click cancel link in the "you're in" email must be safe and not guessable. The spec decides how much login friction is acceptable.
- Default on (D1, D36): the setting is on for every event, including published events with registration still open at release.
- An entry that got the "didn't make it" email stays closed if the end date is extended later. The person can join or register again as a fresh entry (D37). This interacts with the row reuse on the unique `(user, registration_config)` constraint.
- Feature toggle: whether one is needed is a technical decision (as D14 in the guest-seats brief).
- Mosy docs must be updated with the new state and flows.

## 13. Decisions and rationale

All confirmed by Harald Walker on 2026-11-04, except where noted.

| # | Decision | Reason |
|---|----------|--------|
| D1 | The waitlist is on by default for events with registration. Organisers can turn it off. | "It doesn't do any harm." It reaches every full event without organiser work. |
| D2 | Joining = a registration that awaits confirmation, with the full form (places, custom fields, inventory, time slot). | Enables automatic promotion without a second step. |
| D3 | Auto-promotion in queue order. The first person who fits is promoted, repeated against all free capacity. If nobody fits, the event reopens as today. | Fast near the deadline and fair. A large party does not block smaller ones. |
| D4 | No claim windows and no broadcast or first-come release. | Claim windows are too slow near the deadline. Broadcast is unfair and frustrating. |
| D5 | Waitlist cap = 20% of `max_participants` in places, with a small hardcoded floor. No organiser option. | Prevents false hope (prod: up to 15% of places freed). Keeps settings simple. |
| D6 | No promotion after `registration_end_date`. | The deadline exists for organiser planning. |
| D7 | "Didn't make it" email at the end of the registration period. No suggestions. | Clear communication closes the loop. |
| D8 | "Waiting list" is a recipient option in the existing guest message feature. | Reuses an existing feature. Organisers can announce extra dates or other events. |
| D9 | Organisers see the waitlist count only. The full waitlist view is a follow-up. | Small v1 and data minimisation. |
| D10 | Follow-ups: event suggestions in the "didn't make it" email, an organiser waitlist view. No automatic "similar events" sending. | Not core to the first release. |
| D11 | The waitlisted state lives on the existing `EventRegistration` row. Every "attending" query must be audited. | Recorded as a constraint. The design belongs to the architect. |
| D12 | Waitlisted people are excluded from the guest list, exports and guest emails. | They are not attending. |
| D13 | Registration settings change history and demand tracking are not part of this epic. They are listed as later ideas only. | Nice-to-have. Usage numbers are too low to make them a priority. |
| D14 | Success is judged on refills, captured registrants and fairness, not raw volume. It is measured from data the waitlist stores anyway, with no new instrumentation as a prerequisite. | Prod data shows about 6 seats of direct upside. Instrumentation is not a priority (D13). |
| D15 | Each person on the waitlist gets at most one "didn't make it" email. | Avoids repeated bad news. |
| D16 | When the waitlist is full or off: nothing new. Registration shows "booked out" as today. "Stay connected beyond the cap" is out of scope. | Keep v1 small. The cap trade-off is accepted. |
| D17 | The waitlist applies when FULL comes from a sold-out required inventory or time slot option too. Matching must fit places and options. The cap stays in places. | Matches existing business logic: registration closes when places or required inventory sell out. |
| D18 | Organisers may use the waitlist message to promote other events. The platform does not control the content. | Waitlisted people accepted the same terms that allow related communication, as for guests. |
| D19 | Users see neither their position nor the waiting count. They only see that they are on the waitlist. | Simplicity. The same as Eventbrite. |
| D20 | The missing cleanup of registration data (all registrations, cancelled ones and answers, kept indefinitely) is a general gap, handled as a separate issue outside this epic. Waitlist answers follow whatever rule is decided. Harald's view: clean up a short time after the event (time for complaints and support). | One concern per issue. The data isn't needed long after the event. |
| D21 | Waitlisted people are notified when the event is deleted or cancelled, the same as registered guests. | They are registrants awaiting confirmation. |
| D22 | No organiser alert when the waitlist fills. The count in the UI is enough. | Keep it small. |
| D23 | Joining the waitlist changes nothing about signup or consent compared to normal registration. No `signup_source` dependency. The bundled newsletter consent is not part of this epic. | It is an event registration awaiting confirmation. |
| D24 | Admin-cancelled users are treated as in normal registration (blocked from joining the waitlist until reinstated). | The waitlist is an event registration. |
| D25 | A manual close by the organiser sends no "didn't make it" email. That email is only for `registration_end_date`. Cancellations during a manual close may still promote people from the waitlist. | A manual close is temporary. Promotion doesn't change the end result for the organiser. |
| D26 | Harald's leaning on a promotion cutoff before event start (not final, Q1): no extra rule. Organisers who need one set an earlier registration end date. | Uses an existing setting instead of a new one. |
| D27 | Brief file name follows the existing convention `doc/requirements/<short-topic>.md`. | Consistent with `event-registration-guest-seats.md`. |
| D28 | The button label and layout for the waitlist state are not specified in this brief. They are a design constraint the spec phase must solve: space on browse cards and in the mobile footer bar is very limited. | A real UX problem that needs design work, not a product decision. |
| D29 | The registration modal explains what to expect when joining the waitlist ("You'll be registered automatically if a place frees up. We'll email you."). Must-have. | People must understand that joining is a commitment that can turn into a registration without another step. |
| D30 | Browse cards and the similar-events sidebar are consistent with the event page. When waitlist registration is possible, they offer or indicate it instead of only "booked out". | Otherwise people browsing never find the waitlist. |
| D31 | When the waitlist is full (cap reached), every surface looks exactly like today's "booked out" state. | Nothing more can be offered (D16). Reuses the existing state. |
| D32 | A waitlisted user sees their status in the existing "my registration details" view. The leave action is there, in the same place as cancel. | Reuses the existing view. The waitlist is an event registration. |
| D33 | On promotion, both the guest ("you're in") and the team admins (if `notify_admins` is on) are notified, with the same details as a normal registration notification. | For the organiser, a promotion is a new registration. |
| D34 | The waitlist count goes into the existing organiser "registrations" tab with its counters. Where and how the numbers are shown (including any overview-style presentation) is a UX choice for the spec phase, not a separate feature. | There is no separate guest list page. The numbers already exist; only their presentation is open. |
| D35 | With `notify_admins` on, admins are notified only on promotion (D33) and on cancellations as today. No notification when someone joins or leaves the waitlist. | The count is visible in the registrations tab. An email per join would be noise. |
| D36 | "On by default" applies to all events, including published events whose registration is still open at release. | The setting defaults to on for every event. Consistent with D1 ("it doesn't do any harm"). |
| D37 | If `registration_end_date` is extended after the "didn't make it" emails went out, those entries stay closed. The people can join the waitlist or register again like anyone else. | Keeps the outcome final and simple. Nobody is shut out. |

## 14. Draft GitHub issues

### Epic: Event registration: waiting list for full events

**Summary**
When an event is fully booked (places or a required option sold out), would-be attendees meet a disabled button and we lose them. With the waiting list, which is on by default, they can register to wait. When a place frees up, the first people who fit are registered automatically. Everyone gets a clear outcome.

**Sub-issues (in suggested order)**
1. Waiting list: join, leave, event page and card states, organiser count (must; the button label and layout are designed in the spec phase, D28)
2. Waiting list: automatic promotion and "you're in" email (must)
3. Waiting list: "didn't make it" email at registration end (must)
4. Guest messages: "waiting list" recipient option (must)

**Later ideas (not in this epic)**: event suggestions in the "didn't make it" email, an organiser waitlist view, GA4 waitlist events, registration settings change history, demand tracking.
**Related, separate issue (outside this epic)**: retention and cleanup of event registration data.

---

**1. Waiting list: join, leave and organiser count**
*Problem*: When an event is full, would-be attendees have no way to queue for a freed place and are lost to the platform.
*Acceptance criteria*
- [ ] Events with registration have a waiting list, on by default. This includes already published events with registration still open. Organisers can turn it off in the registration settings.
- [ ] When the event is fully booked (places or a required option sold out) and the waiting list has room, visitors can join it with the normal registration form, signing up or logging in first if needed. They may choose options that are currently sold out.
- [ ] The waiting list holds up to 20% of the event's places (with a small minimum for tiny events). When it is full or turned off, the event shows "booked out" as today.
- [ ] When joining the waiting list is possible, the event page, the browse cards and the similar-events sidebar all offer it consistently, not just "booked out". The label and layout work within the limited space on browse cards and in the mobile footer bar, in English and German.
- [ ] When the waiting list is full or turned off, every surface looks exactly like today's "booked out" state.
- [ ] The registration modal tells people what to expect, e.g. "You'll be registered automatically if a place frees up. We'll email you."
- [ ] People on the waiting list get a confirmation email. In their registration details they see that they are on the waiting list (no position or count) and can leave it, in the same place where registered people cancel.
- [ ] Rules for blocked (admin-cancelled) users are the same as for registration.
- [ ] Organisers see how many people and places are waiting in the "registrations" tab, next to the existing counters. Admins are not notified when someone joins or leaves the waiting list.
- [ ] Waiting-list entries don't appear in the guest list, the CSV export or guest emails, and don't count toward places, inventory or time slots.
- [ ] People on the waiting list are notified when the event is deleted, the same as guests.
- [ ] All text and emails are in English and German.

**2. Waiting list: automatic promotion**
*Problem*: Freed places, especially in the last days, go to whoever happens to check the page again, or stay empty.
*Acceptance criteria*
- [ ] When places or options free up (a cancellation, a capacity increase, or freed inventory or time slot), the first people in the queue who fit both the free places and their chosen options are registered automatically, until nobody else fits.
- [ ] Promoted people get a "you're in" email with a one-click cancel link.
- [ ] If admin notifications are on for the event, team admins are notified of each promotion with the same details as for a normal registration.
- [ ] If nobody on the list fits, registration reopens as it does today.
- [ ] Nobody is promoted after the registration end date. Promotion still happens while the organiser has closed registration manually.
- [ ] The event is never overbooked, even with simultaneous changes.

**3. Waiting list: "didn't make it" email**
*Problem*: People still waiting at the end never hear the outcome.
*Acceptance criteria*
- [ ] When the registration end date passes, everyone still on the waiting list gets a short email (English or German) saying they didn't get a place.
- [ ] Each person gets this email at most once.
- [ ] No such email is sent when the organiser closes registration manually.
- [ ] If the organiser extends the registration end date afterwards, these people are not put back on the waiting list. They can join or register again like anyone else.

**4. Guest messages: "waiting list" recipient option**
*Problem*: Organisers can't reach people waiting for their event, e.g. to tell them about an extra date or another event.
*Acceptance criteria*
- [ ] In the "email guests" dialog, organisers can choose the waiting list as recipients instead of registered guests.
- [ ] The recipient count and the test send work as they do for guests.
- [ ] Guest emails never reach waiting-list entries unless the organiser chooses the waiting list.

---

### Separate issue (outside the epic): Clean up event registration data after events

*Problem*: Event registrations, cancelled registrations and custom-field answers are kept indefinitely, also for long-past events. The only scheduled cleanups cover login tokens and login audit logs. The data isn't made available and isn't needed long after an event.
*Acceptance criteria* (subject to an explicit decision on the delay)
- [ ] Registration personal data (registrations, including cancelled and waitlisted ones, and their custom-field answers) is removed or anonymised a defined time after the event ends. The time leaves room for complaints and support.
- [ ] Aggregate numbers needed for reporting (e.g. counts per event) stay available.
- [ ] The rule is documented in the privacy-relevant docs.

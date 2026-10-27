# Requirements brief: Bring guests to an event (multiple seats per registration)

**Status**: Ready for spec (no open questions)
**Date**: 2026-10-19
**Stakeholder**: Harald Walker (maintainer)
**Decisions**: see section 13 (D1–D17)

---

## 1. Problem statement

Organisers set the number of places for an event, and every registration takes exactly one place. People who want to bring a partner, a child or friends have no proper way to reserve places for them. Each guest would need their own account and registration, or the organiser has to estimate who is coming. Organisers then don't know the real number of people attending, which matters for venue limits and for catering. [Confirmed]

## 2. Users and stakeholders

- **Registrant (logged-in member)**: wants to sign up themselves plus a few guests in one step, without creating accounts for the guests. [Confirmed]
- **Organiser / team admin of the event project**: wants to know the total number of people coming and to limit how many places one registrant can take. [Confirmed]
- **Guests of the registrant**: have no account and give no data. They are not platform users in this feature. [Confirmed]
- **Maintainers (volunteers)**: need a small change that reuses the existing registration flow. [Confirmed]

## 3. Current situation

- One `EventRegistration` per user per event (database unique constraint). Capacity = `max_participants`. Seats left = `max_participants` minus the active registrations. Status becomes FULL when the count reaches the limit and goes back to OPEN after a cancellation. [Confirmed, code: `backend/organization/models/event_registration.py`, `backend/organization/utility/event_registration.py`]
- Registration requires an account. Registrants cannot edit a registration. They can cancel and register again, and registering again replaces all custom-field answers. Organisers can cancel a registration but not edit it. [Confirmed, code and D6]
- Workaround in use: a required, single-option inventory field "Number of people (200 available)" (issue #2322). Its capacity is separate from `max_participants`, and the public seat count still counts registrations, not people. This workaround stays and is not migrated (D5). [Confirmed]
- Custom-field answers (checkbox, option_select, inventory, time_slot_select, text) are stored once per registration. Time slot capacity counts registrations. [Confirmed, code]
- Comparable platforms [Researched]:
  - **Luma "Group Registration"**: an on/off switch. The registrant picks a number of tickets, up to the remaining capacity. It is one record under the registrant's name, with no names or questions per guest. ([Luma Help](https://help.luma.com/p/group-registration))
  - **Meetup**: members can add guests (up to 5 by default). Guests count toward the limit. A waitlisted party only moves up when there is room for all of them. ([Meetup Help](https://help.meetup.com/hc/en-us/articles/9389668230541-Manage-attendees-and-track-attendance-for-your-Meetup-event-on-the-web), [waitlist](https://help.meetup.com/hc/en-us/articles/41229648295181-How-to-Join-an-Event-Waitlist-on-Meetup))
  - **Eventbrite**: a minimum and maximum tickets per order. Organisers can collect details from the buyer only or from each attendee. ([Eventbrite Help](https://www.eventbrite.com/help/en-us/articles/644100/))
  - The chosen direction is closest to Luma.

## 4. Key user flows

**Organiser sets up guests**
1. Organiser creates or edits an event with registration enabled.
2. Organiser sets "Maximum places per registration". 1 (default) means no guests, as today. There is no platform-wide upper limit other than `max_participants` (D12).
3. The setting can be changed later. Existing registrations keep their seat count.

**Registrant signs up with guests**
1. Registrant opens the registration dialog. If the event allows more than 1 place per registration, they see "How many places?" with a default of 1 (themselves only).
2. They pick 1 up to the lower of: the per-registration maximum or the seats left.
3. They fill in any custom fields once for the whole party, and submit.
4. The confirmation email shows the number of places. The organiser notification (if `notify_admins` is on) shows the number of places.

**Exceptions**
- More places requested than are left: registration is refused with a clear message naming how many are left. Nothing is saved. [Confirmed D16]
- The last seats are taken by someone else at the same moment: the same refusal, with no overbooking.
- Changing the number of places: cancel and register again (D6). If the event has filled up in the meantime, the registrant may not get back in. This is an accepted v1 risk.
- Cancelling (by the registrant or the organiser) frees all places of that registration.
- Organiser lowers `max_participants` below the places already booked: handled as today, but based on places, not registrations.

## 5. Pain points (ranked)

1. **No way to reserve places for guests.** Guests either go unregistered or need accounts. [Confirmed]
2. **Organisers don't know the real headcount**, for venue limits and food. [Confirmed]
3. **The inventory workaround is clumsy.** It has two capacity numbers, and the public "seats left" figure counts registrations, not people. [Confirmed, issue #2322]

## 6. Requirements

**Must**
- M1. Organisers can set a maximum number of places per registration (default 1). There is no platform-wide cap beyond `max_participants`. [Confirmed D3, D12]
- M2. Registrants choose the number of places when registering. Default 1. The form only offers as many places as are actually available: the lower of the organiser's maximum per registration and the seats left. [Confirmed D16]
- M3. All places count toward `max_participants`: the existing "seats left" display on the event page ("x / y"), the FULL status, re-opening after a cancellation, and the check when an organiser lowers capacity. There is no setting to exclude guests. [Confirmed D4]
- M4. A registration can never exceed the remaining seats. If seats run out between opening the form and submitting, the submission is refused with a clear message saying how many places are left, and nothing is saved. Concurrent sign-ups must never overbook. [Confirmed D16]
- M5. No guest names or other guest data are collected. [Confirmed D2]
- M6. Custom-field answers stay once per registration. Inventory `max_amount_per_guest` stays a limit per registration. Fields are not linked to the seat count. [Confirmed D9, D10]
- M7. A time slot is taken once per registration, whatever the number of places. [Confirmed D7, tentative]
- M8. The number of places is shown in: the organiser attendee list, the CSV export, the registrant confirmation email and the organiser notification email. The total number of places booked is visible to the organiser. [Confirmed D8]
- M9. Changing the number of places is only possible by cancelling and registering again. Cancelling frees all places. [Confirmed D6]
- M10. All new text is in English and German, including singular and plural forms ("1 place / 2 places", "1 Platz / 2 Plätze"). [Confirmed]
- M11. Existing events and registrations behave exactly as today (each existing registration = 1 place). [Confirmed D17]
- M12. Cancelled registrations keep showing their former number of places in the organiser attendee list and CSV. They do not count toward capacity. [Confirmed D15]

**Should**
- None. (The former S1 is covered by the existing seats-left display plus M2, see D16.)

**Could**
- C1. Analytics: track the number of places chosen per registration, to measure adoption. [Assumed]

## 7. Success criteria

- Events with a maximum above 1 place per registration: share of new events and number of organisers using it in the first 3 months. [Assumed, target to be set]
- Share of registrations with more than 1 place on those events. [Assumed]
- No overbooking incidents, meaning booked places never exceed `max_participants`. [Confirmed as a must]
- Fewer new events using a "number of people" inventory field to count headcount. [Assumed]

## 8. Constraints and dependencies

- **Privacy**: no data about guests. The registrant remains the only contact for the group. Emails go to the registrant only. [Confirmed]
- **i18n**: English and German, including plural forms. [Confirmed]
- **Entities affected**: `EventRegistrationConfig` (new organiser setting), `EventRegistration` (number of places). `RegistrationField*` is unchanged. The Mosy entity docs and the Event Registration flows need updating. [Assumed, for the architect to confirm]
- **Existing flows**: register, self-cancel, organiser cancel, organiser edits registration settings, attendee list/CSV, confirmation and notification emails, bulk guest email (still one email per registration). [Confirmed]
- **Feature toggle**: not a product requirement. See hand-off notes (D14).
- **Volunteer capacity**: keep it small. Reuse the existing dialog and settings screens.

## 9. Scope

**v1**: M1–M12.

**Not in v1**
- Editing the number of places on an existing registration (by the registrant or the organiser). [D6]
- Guest names, emails or per-guest answers. [D2]
- Linking food or inventory amounts to seats, or per-person food limits. [D9, D10]
- Allergies and diet handling (a separate topic, for example a future multiselect field type). [D11]
- Counting time slots per person. [D7, risk]
- Waitlist (does not exist today).
- Changing or migrating the single-option inventory workaround. [D5]
- An organiser option to exclude guests from capacity. [D4]
- Mentioning on the event page that guests are allowed. The page is already overloaded. [D13]
- A platform-wide cap on places per registration. [D12]

## 10. Assumptions and risks

| Item | Type | Validation |
|------|------|-----------|
| Some events want time slots counted per person (for example a tour with 10 places per slot) | Risk (D7) | Ask organisers using time slots after release. Watch support requests. |
| Cancel and re-register is acceptable for changing places, even though it can lose the spot on a nearly full event | Risk (D6) | Watch feedback. Revisit if organisers report it. |
| One registrant reserving many places may block others | Risk, limited by M1 | The organiser sets the maximum. |
| Organisers may combine the new places setting with the old "number of people" inventory field and get confused | Risk | A short hint in the organiser settings (spec writer to decide). |
| Registrants don't know guests are possible until they open the registration dialog (the event page does not mention it, D13) | Risk | Watch adoption (section 7). Revisit if usage is low. |
| The public "seats left" figure counts places | Assumed from D4/D8 | Implied by the decisions. Confirm in the spec review. |

## 11. Open questions

None. Resolved on 2026-10-19: platform cap (D12), event page mention (D13), feature toggle moved to hand-off notes (D14), cancelled registrations keep their places in the list (D15), seats-left handling (D16), existing registrations = 1 place (D17).

## 12. Hand-off notes (needs, not solutions)

- Capacity must stay race-free when one request takes several places. Today's locking guarantees this for single places.
- Expected size (Harald's view, D17): a small change. One organiser setting (maximum places per registration, default 1), one number of places per registration (default 1, which is also the value for existing data), and seat counting switched from counting registrations to summing places.
- One consistent seat calculation is needed. Today registrations are counted separately in about 6 places:
  - the FULL-status check in `backend/organization/utility/event_registration.py`
  - recalculating seats in the registration view's POST and DELETE handlers (`backend/organization/views/event_registration_views.py`)
  - `available_seats` in the serializer (`backend/organization/serializers/event_registration.py`)
  - the `max_participants` lower-limit check in the serializer

  All of them must give the same result. A partial switch would make the numbers inconsistent.
- Time slot and inventory capacity counting stays as it is (per registration and per quantity).
- The organiser list, the CSV, both emails and the analytics funnel (`doc/mosy/metrics/analytics_events.md`) need the number of places.
- Mosy docs to update: `doc/mosy/entities/system-entities.md` and `doc/mosy/flows/core-flows.md` (registration flows).
- Feature toggle (D14): the existing `EVENT_REGISTRATION` toggle cannot gate this, because the feature is live and the toggle is on. Whether a new toggle is needed for a safe rollout is a technical decision for the spec writer and architect, based on scope and risk.
- Registration endpoints are used by the frontend and possibly OpenAPI codegen. The contract change must stay backward compatible for clients that send no number of places (default 1).

## 13. Decisions and rationale

All confirmed by Harald Walker on 2026-10-19.

| # | Decision | Reason |
|---|----------|--------|
| D1 | The need: registrants want to bring guests, for general events and for events where food is served. | Real organiser requests. |
| D2 | No guest names or details are collected. One registration plus a number of places. | Not needed as far as known. Keeps data about people without an account off the platform. Same as Luma. |
| D3 | Organisers set a maximum number of places per registration. | Stops one registrant from taking most of the capacity. |
| D4 | Guests always count toward `max_participants`. No option to exclude them. | Keep it simple. Same as Meetup and Luma. |
| D5 | The single-option inventory workaround ("Number of people") stays as it is, with no migration. | Still useful in other single-option situations. |
| D6 | Registrants cannot change the number of places after registering. They cancel and register again. | Registrations can't be edited today. Adding editing would grow the scope a lot. |
| D7 | A time slot is taken once per registration, whatever the number of places (tentative). | A time slot works more like inventory: a group of 3 takes one slot. Some events may want slots counted per person, so this is listed as a risk. |
| D8 | The number of places is shown in the confirmation email and the organiser notification email. | Both the registrant and the organiser need the headcount. |
| D9 | Food and catering need nothing new. The number of places gives the headcount. | The real food-event organiser only needed the total number of people. |
| D10 | Custom fields are not linked to the number of places. `max_amount_per_guest` stays a limit per registration. | No confirmed need for extra rules. |
| D11 | Allergies and diets are out of scope here. They are a separate topic, for example a future multiselect field type. | Separate concern. Also avoids collecting health data about guests. |
| D12 | No platform-wide cap on places per registration. | The organiser's maximum and `max_participants` are enough. |
| D13 | The event page does not mention that guests are allowed. | The event page is already overloaded with information. |
| D14 | A feature toggle is a technical decision, not a product requirement. `EVENT_REGISTRATION` can't be reused. | The feature is already live with the toggle on. |
| D15 | Cancelled registrations keep showing their former number of places in the attendee list and CSV. | Obvious, but worth stating explicitly. |
| D16 | No separate "seats left before submitting" requirement. Instead, the form only offers as many places as are actually available. | The event page already shows seats left ("x / y"). |
| D17 | Existing registrations count as exactly 1 place. | Natural default. Current events stay unchanged. |

## 14. Draft GitHub issue

**Title**: Event registration: allow registrants to bring guests (multiple places per registration)

**Summary**
Today every registration takes exactly one place. People who want to bring guests can't reserve places for them, and organisers don't know the real headcount. Organisers can now allow up to N places per registration. Registrants pick how many places they need (themselves plus guests). Guests count toward the event capacity. No guest details are collected.

**Acceptance criteria**
- [ ] Organisers can set "Maximum places per registration" in the registration settings (default 1 = no guests, same as today). No platform-wide cap beyond the event capacity.
- [ ] When the maximum is above 1, the registration dialog asks "How many places?" (default 1). It only offers as many places as are actually available: the lower of the organiser's maximum and the seats left.
- [ ] All places count toward the event capacity: the existing seats-left display on the event page ("x / y"), the "fully booked" status, re-opening after a cancellation, and lowering capacity in the settings.
- [ ] If seats run out between opening the form and submitting, the registration is refused with a clear message saying how many places are left, and nothing is saved. The event is never overbooked, even with simultaneous sign-ups.
- [ ] Cancelling a registration (by the registrant or the organiser) frees all its places. To change the number of places, the registrant cancels and registers again.
- [ ] No names or other data about guests are collected. Custom-field answers stay once per registration. A time slot is taken once per registration.
- [ ] The number of places is shown in the organiser attendee list, the CSV export, the confirmation email and the organiser notification email. Organisers can see the total places booked.
- [ ] Cancelled registrations still show their former number of places in the attendee list and CSV, but don't count toward capacity.
- [ ] Existing events and registrations are unchanged (each counts as 1 place).
- [ ] All new text is available in English and German, with correct singular and plural.

**Out of scope**: editing a registration's number of places, guest names, food/diet logic, per-person time slots, waitlist, mentioning guests on the event page, changes to the "number of people" inventory workaround.

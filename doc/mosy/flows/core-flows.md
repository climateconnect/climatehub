# Core Functional Flows

## 1. User Onboarding Flow
- **Actor**: Guest
- **Trigger**: User clicks "Sign Up"
- **Actions**:
  1.  User submits registration form (Email/Password).
  2.  System sends verification email (via Mailjet).
  3.  User clicks verification link.
  4.  System activates account.
  5.  User completes profile setup.

## 2. Project/Event/Idea Creation Flow
- **Actor**: Member, Organization
- **Trigger**: User clicks "Share"
- **Actions**:
  1. User selects a type of project (Event, Idea, etc.). 
  2. User inputs project details (Title, Description, Location).
  3. System validates inputs.
  4. System saves Project as "Draft" or "Published".
  5. System notifies followers (if applicable).

## 3. Organization Creation Flow
- **Actor**: Member
- **Trigger**: User clicks "Create Organization" on profile page
- **Actions**:
   1. User inputs organization details (Name, Description, Location).
   2. System validates inputs.
   3. System saves Organization.

## 4. Search & Discovery Flow
- **Actor**: Member
- **Trigger**: User searches for projects/events/organizations
- **Actions**:
   1.  User enters keywords or selects location hub.
   2.  System queries database/index.
   3.  System returns filtered and ranked list of results.

## 5. Event Registration Field Management Flow (introduced in [#1880](https://github.com/climateconnect/climateconnect/issues/1880))
- **Actor**: Organiser / Team Admin
- **Trigger**: Organiser creates or edits an event with registration enabled
- **Actions**:
   1. Organiser navigates to event create/edit form.
   2. Organiser enables event registration (if not already enabled).
   3. Organiser opens the "Registration fields" section (gated behind `REGISTRATION_CUSTOM_FIELDS` toggle).
   4. Organiser adds custom fields (up to 5): checkbox (with rich-text description) or option select (with title and ordered options).
   5. Organiser marks fields as required as needed.
   6. Organiser reorders fields using up/down arrow controls.
   7. Organiser saves the event. Fields are validated on publish (non-draft).
   8. Custom field definitions are stored and returned in the event detail API response.
- **Notes**:
   - Fields are managed as a nested writable array on the existing event create/edit endpoints.
   - Full sync on save: items with `id` are updated, items without `id` are created, absent IDs are deleted (guarded against existing answers).
   - Checkbox description supports rich text (bold + links) stored as sanitized HTML via `bleach`.
   - Option select options are stored as separate `RegistrationFieldOption` rows for addressable FK in future answer storage.
   - The same settings surfaces carry the maximum seats per registration (default 1 = no guests); it is optional and validated like the other configuration fields.

## 6. Contact From a Project Page Flow (introduced in [#2296](https://github.com/climateconnect/climateconnect/issues/2296))
- **Trigger**: Logged-in user clicks "Contact" on a project, idea or event page
- **Actions**:
   1. The contact chat drawer opens a private chat with the project's admin.
   2. Every message sent from the drawer carries `origin_project_url_slug` (POST `send_message` or WebSocket payload).
   3. The backend validates the project and that a project admin is in the chat, then stores `origin_type="project"` and `origin_id=<project id>`.
   4. Both participants see a chip ("This message is about the project/idea/event {name}") linking to the project page, resolved through `GET /api/project-origin/{id}/`.
- **Notes**:
   - Every message sent from the drawer shows the chip, with the same event icon as the registration chip.
   - If the project is deleted, the resolver returns 404 and the chip is omitted; messages are untouched.

## 7. Event Registration Flow (multiple seats per registration, introduced in [#2348](https://github.com/climateconnect/climatehub/issues/2348))
- **Actor**: Member (registrant)
- **Trigger**: Member opens the registration dialog on an event with registration enabled
- **Actions**:
   1. If the event allows more than 1 seat per registration, the member picks a number of seats (default 1 = themselves only), capped at the lower of the organiser's maximum per registration and the seats left.
   2. The member fills the custom registration fields once for the whole party.
   3. The system checks capacity under the per-event lock (seats left = `max_participants` − booked seats) and, if there is not enough room, refuses with a message naming the remaining seats — nothing is saved.
   4. The system stores one `EventRegistration` with the seat count and the answers; the seats-left display and the FULL status follow.
   5. The confirmation email shows the seat count; the organiser notification (when `notify_admins` is on) shows it too.
- **Notes**:
   - No guest data is collected: one registration row plus a number of seats (default 1; every pre-existing registration counts 1).
   - A time slot is taken once per registration; inventory `max_amount_per_guest` stays a limit per registration.
   - Changing the seat count is done by cancelling and registering again.

## 8. Event Registration Cancellation Flow (introduced in [#2348](https://github.com/climateconnect/climatehub/issues/2348))
- **Actor**: Member (self-cancel) or Organiser / Team Admin (guest cancellation)
- **Trigger**: Cancel action on the registration dialog or the attendee list
- **Actions**:
   1. The registration is soft-cancelled (`cancelled_at` / `cancelled_by` set; a self-cancel may carry a reason).
   2. All seats of the registration are freed; the event re-opens from FULL when seats become available.
   3. The attendee list and CSV keep showing the row with its former seat count, excluded from capacity.
- **Notes**:
   - Re-registration re-uses the row and replaces the answers and the seat count.

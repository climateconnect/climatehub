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
  2. User inputs project details (Title, Description, Location). The description may contain images (flow 12).
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

## 7. Contact From an Organization Page Flow (introduced in [#2327](https://github.com/climateconnect/climateconnect/issues/2327))
- **Trigger**: Logged-in user clicks "Contact" on an organization page
- **Actions**:
   1. A chat drawer opens on the organization page with the organization's creator as recipient (no navigation; the drawer creates or fetches the private chat).
   2. Every message sent from the drawer carries `origin_organization_url_slug` (POST `send_message` or WebSocket payload).
   3. The backend validates the organization and that an organization admin is in the chat, then stores `origin_type="organization"` and `origin_id=<organization id>`.
   4. Both participants see a chip ("This message is about the organization {name}") linking to the organization page, resolved through `GET /api/organization-origin/{id}/`.
- **Notes**:
   - No other participants are added to the chat.
   - If the organization is deleted, the resolver returns 404 and the chip is omitted; messages are untouched.

## 8. Event Registration Flow (multiple seats per registration, introduced in [#2348](https://github.com/climateconnect/climatehub/issues/2348))
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

## 9. Event Registration Cancellation Flow (introduced in [#2348](https://github.com/climateconnect/climatehub/issues/2348))
- **Actor**: Member (self-cancel) or Organiser / Team Admin (guest cancellation)
- **Trigger**: Cancel action on the registration dialog or the attendee list
- **Actions**:
   1. The registration is soft-cancelled (`cancelled_at` / `cancelled_by` set; a self-cancel may carry a reason).
   2. All seats of the registration are freed; the event re-opens from FULL when seats become available.
   3. The attendee list and CSV keep showing the row with its former seat count, excluded from capacity.
- **Notes**:
   - Re-registration re-uses the row and replaces the answers and the seat count.

## 10. Leave Organization Flow (introduced in [#2368](https://github.com/climateconnect/climatehub/issues/2368))
- **Actor**: Organization member (Member, Admin or Super-Admin)
- **Trigger**: Member clicks "Leave team" in the members section of the organization page
- **Actions**:
   1. If the member is a Super-Admin, the UI shows an error (hand over the role via "Manage Members" first, or delete the organization if they are the last member). No request is sent.
   2. Otherwise a confirmation dialog is shown; cancel sends nothing.
   3. On confirm the frontend calls `POST /api/organizations/<slug>/leave/`.
   4. System deletes the member's own `OrganizationMember` row. (If the API still returns 400, the `code` — `super_admin_must_hand_over` or `last_member` — selects the translated error.)
   5. The organization page reloads and shows a success message.

## 11. Twingle Donation Goal Update Flow (introduced in [#2388](https://github.com/climateconnect/climatehub/issues/2388))
- **Actor**: Twingle (external system); Admin (one-time setup and corrections)
- **Trigger**: Twingle sends a new or changed donation transaction of an enabled Twingle project to `POST /api/webhooks/twingle/`
- **Actions**:
   1. The system verifies the request signature against the raw body with the configured secret. If the signature is missing or wrong, it rejects the request with 401 and nothing changes. If no secret is configured, it rejects every request with 503.
   2. The system reads the transaction and finds the `DonationGoal` mapped to the transaction's Twingle project (no period check). Deliveries for unmapped projects are acknowledged and ignored. For a mapped project, the system records the time in the goal's `twingle_last_delivery_at` (liveness check), whether or not the delivery is counted.
   3. If the delivery is a new, first payment of a recurring EUR donation without an error, the system normalises the amount to a monthly amount and converts it into units with the goal's unit price (rounded down).
   4. The system adds the units to the goal's `current_amount` in one atomic database update and writes one log line (`twingle trx=… project=… goal=… +N units`).
   5. The crowdfunding page shows the new value on the next page load.
- **Notes**:
   - Stateless: no transaction or donor data is stored. The log line is the only trail.
   - Admins map a goal to a Twingle project and set the unit price (default 7 € per month) in the Django admin. They correct `current_amount` by hand for backfill and deviations. Webhook changes stack on top.
   - Sentry events from this endpoint carry no request body, headers or frame variables.
   - Not implemented (possible later task): subtracting units on stop or error updates. Stops are corrected by hand.

## 12. Rich-Text Image Upload and Usage Flow (spec `20260708_1302_rich_text_image_support.md`)
- **Actor**: Member (project author, project admin or translator)
- **Trigger**: Member clicks the image button in the project description editor (share project, edit project or translation editor)
- **Actions**:
   1. Member picks a JPEG, PNG or WebP file (max 20 MB) and enters optional alt text. The editor checks type and size and refuses at 10 images in this language version.
   2. The editor uploads the file at once to `POST /api/rich-text-images/` (multipart). While the upload runs, the project form can't be saved.
   3. The system checks the throttle (20 uploads per user per hour), size, format and pixel limit, removes location and camera metadata from the original without re-encoding, generates the 600 and 1200 px WebP variants and stores a `RichTextImage` owned by the member, without any usage.
   4. The system returns the image id, size and variant URLs. The editor inserts an image block (figure with optional caption; size full, alignment centre by default). Size, alignment and alt text are changed in a menu on the selected image.
   5. Member saves the project (create, edit or translation). Before writing anything the system sanitises each language version of the description, rewrites every image's URLs and size from the database, drops images the member may not use (not owner and not already used in this project) and rejects a language version with more than 10 images.
   6. After saving, the system reconciles the `RichTextImageUsage` rows with the image ids in the stored original and all translations: new ids are linked, missing ids are unlinked.
   7. The project page shows the images from the stored HTML; the browser picks the variant via `srcset`.
- **Notes**:
   - Over the throttle the member gets a message and Sentry receives one warning grouped per user.
   - Automatic (DeepL) translations keep the original's images; translators can use different images per language.
   - Deleting a project unlinks its images; unused images are kept (cleanup is a follow-up).
   - Pasted external images are removed by the editor; external or unknown images are removed by the server.

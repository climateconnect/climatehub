import { Project, RegistrationField, RegistrationFieldOption } from "../types";

/**
 * Determines if the event registration button should be displayed
 * @param project - The project object containing event registration data
 * @returns true if registration button should be shown
 */
export const shouldShowRegisterButton = (project: Project): boolean => {
  return !!(
    !project.is_draft &&
    project.registration_config &&
    !project.registration_config.is_draft &&
    project.registration_config.status !== "ended"
  );
};

/**
 * Gets the appropriate text label for the registration button based on event status
 * @param project - The project object containing event registration data
 * @param texts - Translation/text object containing button labels
 * @param isUserRegistered - Whether the current user is already registered
 * @returns The text to display on the registration button
 */
export const getRegisterButtonText = (
  project: Project,
  texts: any,
  isUserRegistered?: boolean
): string => {
  if (isUserRegistered) return texts.already_registered;
  const status = project.registration_config?.status;
  if (status === "open") return texts.register_now;
  if (status === "full") return texts.booked_out;
  return texts.booked_out;
};

/**
 * Determines if the registration button should be disabled
 * @param project - The project object containing event registration data
 * @param isUserRegistered - Whether the current user is already registered
 * @returns true if the button should be disabled
 */
export const isRegisterButtonDisabled = (project: Project, isUserRegistered?: boolean): boolean => {
  if (isUserRegistered) return true;
  const status = project.registration_config?.status;
  return ["closed", "full"].includes(status || "");
};

/**
 * Describes the UI state of the registration button area on the event detail page.
 *
 * Priority order (matches spec):
 *  1. attended   — user had an active registration when the event started
 *  2. cancel     — user is actively registered and event has not yet started
 *  3. adminClosed — user's registration was cancelled by a different user (admin)
 *  4. register   — registration is open and user is not registered
 *  5. closed     — registration is full/closed and user is not registered
 *  6. hidden     — feature disabled, no registration config, or status = "ended"
 */
export type RegistrationUIState =
  | "attended"
  | "cancel"
  | "adminClosed"
  | "register"
  | "closed"
  | "hidden";

/**
 * Returns the registration button area UI state for the event detail page.
 *
 * @param project - The project object containing event registration data
 * @param isUserRegistered - `is_registered` from my_interactions (active, non-cancelled)
 * @param hasAttended - `has_attended` from my_interactions
 * @param adminCancelled - `admin_cancelled` from my_interactions
 */
export const getRegistrationUIState = (
  project: Project,
  isUserRegistered?: boolean,
  hasAttended?: boolean,
  adminCancelled?: boolean
): RegistrationUIState => {
  if (!project.registration_config) return "hidden";

  // Draft projects should never show a registration button
  if (project.is_draft) return "hidden";

  // Draft registration configs are not visible to visitors
  if (project.registration_config.is_draft) return "hidden";

  // Priority 1 — always show attended label, even if status is ended
  if (hasAttended) return "attended";

  if (project.registration_config.status === "ended") return "hidden";

  // Priority 2 — active registration + event not yet started
  if (isUserRegistered) return "cancel";

  // Priority 3 — admin-cancelled member (blocked from re-registering)
  if (adminCancelled) return "adminClosed";

  // Priority 4 / 5 — open or closed registration
  if (project.registration_config.status === "open") return "register";
  return "closed";
};

/**
 * Validates custom registration fields for a published event.
 *
 * Returns an object with:
 * - errors: per-field/option error messages keyed by "field:{i}", "field:{i}:options", "option:{i}:{j}", etc.
 * - hasError: true if any validation error was found
 *
 * Skipped entirely when isDraft is true.
 */
export function validateRegistrationFields(
  fields: RegistrationField[] | undefined,
  isDraft: boolean,
  requiredText: string
): { errors: Record<string, string>; hasError: boolean } {
  const result: { errors: Record<string, string>; hasError: boolean } = {
    errors: {},
    hasError: false,
  };

  if (isDraft || !fields || fields.length === 0) return result;

  fields.forEach((field, fi) => {
    const fieldKey = `field:${fi}`;
    const settings = field.settings || {};

    if (field.field_type === "checkbox") {
      if (!settings.description || !settings.description.trim()) {
        result.errors[fieldKey] = requiredText;
        result.hasError = true;
      }
    } else if (field.field_type === "text") {
      if (!settings.title || !settings.title.trim()) {
        result.errors[fieldKey] = requiredText;
        result.hasError = true;
      }
    } else if (
      field.field_type === "option_select" ||
      field.field_type === "inventory" ||
      field.field_type === "time_slot_select"
    ) {
      if (!settings.title || !settings.title.trim()) {
        result.errors[fieldKey] = requiredText;
        result.hasError = true;
      }
      const options = field.options || [];
      // Count only "complete" options — same criteria as the strip filter in
      // formatProjectForRequest so that frontend validation matches what the
      // backend actually receives.
      const isComplete = (opt: RegistrationFieldOption) => {
        if (field.field_type === "time_slot_select") {
          return !!(opt.start_time || opt.end_time);
        }
        return !!(opt.title && opt.title.trim() !== "");
      };
      const completeCount = options.filter(isComplete).length;
      if (completeCount === 0) {
        result.errors[`${fieldKey}:options`] = requiredText;
        result.hasError = true;
      }
      if (field.field_type === "inventory") {
        options.forEach((opt, oi) => {
          if (!opt.available_amount) {
            result.errors[`option:${fi}:${oi}`] = requiredText;
            result.hasError = true;
          }
          if (!opt.max_amount_per_guest) {
            result.errors[`option:${fi}:${oi}:max`] = requiredText;
            result.hasError = true;
          }
        });
      }
    }
  });

  return result;
}

/**
 * Formats a seat count with the correct singular/plural copy,
 * e.g. "1 seat" / "2 seats" (EN) or "1 Platz" / "2 Plätze" (DE).
 * @param count - Number of seats
 * @param texts - Project texts containing `seat_count_one` / `seat_count_other`
 */
export const formatSeatCount = (count: number, texts: any): string =>
  (count === 1 ? texts.seat_count_one : texts.seat_count_other).replace("{count}", String(count));

/**
 * Highest number of seats a registrant may choose in the registration dialog:
 * the organiser's per-registration maximum, capped by the seats left
 * (unlimited-capacity events: the maximum alone). Never below 1.
 * @param maxSeatsPerRegistration - Organiser setting (absent = 1)
 * @param availableSeats - Seats left; null for unlimited capacity
 */
export const getSelectableSeatMax = (
  maxSeatsPerRegistration: number | undefined,
  availableSeats: number | null | undefined
): number => {
  const max = Math.max(1, maxSeatsPerRegistration ?? 1);
  if (availableSeats == null) return max;
  return Math.max(1, Math.min(max, availableSeats));
};

/** Seats booked by active (non-cancelled) registrations. */
export const sumActiveSeats = (
  registrations: { cancelled_at: string | null; number_of_seats?: number }[]
): number =>
  registrations
    .filter((r) => !r.cancelled_at)
    .reduce((sum, r) => sum + (r.number_of_seats ?? 1), 0);

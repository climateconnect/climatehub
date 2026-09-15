import { Dayjs } from "dayjs";
import type { PaletteColorOptions } from "@mui/material/styles";

export type RegistrationFieldOption = {
  id?: number | null;
  title: string;
  order: number;
  has_answers?: boolean;
  available_amount?: number | null;
  max_amount_per_guest?: number | null;
  remaining_amount?: number | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type RegistrationField = {
  id?: number | null;
  field_type: "checkbox" | "option_select" | "inventory" | "time_slot_select" | "text";
  order: number;
  is_required: boolean;
  label: string;
  settings: {
    description?: string;
    title?: string;
    is_multiline?: boolean;
  };
  options?: RegistrationFieldOption[];
  has_answers?: boolean;
  /** Client-only stable key for React list rendering before the field is saved. */
  _clientKey?: string;
};

export type EventRegistrationData = {
  max_participants: number | null;
  available_seats: number | null;
  registration_end_date: string | null; // ISO 8601 string from API
  status: "open" | "closed" | "full" | "ended";
  /** When true, team admins receive an email on registration/cancellation. */
  notify_admins: boolean;
  /** When true, the registration configuration is incomplete and not visible to visitors. */
  is_draft: boolean;
  /** When false, registration features are hidden. Config preserved for re-enable. */
  registration_enabled: boolean;
  /** Custom registration fields configured by the organiser (Phase 4a). */
  fields?: RegistrationField[];
  /** ISO 8601 timestamp of the last bulk email sent to guests. null if never sent. */
  last_guest_email_sent_at: string | null;
};

/** Local form state for one custom-field answer while the user is filling in the modal. */
export type RegistrationFieldAnswerValue = {
  fieldId: number;
  valueBoolean?: boolean;
  valueOption?: number;
  valueNumber?: number;
  valueText?: string;
};

/**
 * One stored custom-field answer as returned by
 * ``GET /api/projects/{slug}/registrations/`` for the organiser view.
 *
 * Field labels and option titles are resolved client-side from
 * ``EventRegistrationData.fields`` — only IDs are repeated here.
 */
export type RegistrationFieldAnswer = {
  field: number;
  value_boolean: boolean | null;
  value_option: number | null;
  value_number: number | null;
  value_text: string | null;
};

export type ChatMessage = {
  id?: number;
  content: string;
  sender: any;
  sent_at: string | Date;
  updated_at?: string | Date | null;
  unconfirmed?: boolean;
  origin_type?: string;
  origin_id?: number | null;
};

export type User = {
  id: string;
  first_name?: string;
  last_name?: string;
  url_slug?: string;
  email?: string;
  registered_event_slugs?: string[];
};

export type Role = {
  id: number;
  name: string;
  name_de_translation?: string;
  role_type: "all" | "read write" | "read only";
  explanation?: string;
  explanation_de_translation?: string;
};

export type SkillType = {
  id: number;
  key: number;
  name: string;
  original_name: string;
  parent_skill?: string;
  subcategories: SkillType[];
};

export type Project = {
  collaborators_welcome: boolean;
  collaborating_organizations: any[];
  loc: any;
  location?: any; //TODO: merge loc and location (loc used to post, location used when getting data from the backend currently)
  parent_organization: any;
  isPersonalProject: boolean;
  is_organization_project: boolean;
  team_members: any[];
  website: string;
  language: CcLocale;
  error?: boolean;
  is_draft?: boolean;
  url_slug?: string;
  name?: string;
  project_parents?: any[];
  project_type: ProjectType | any;
  start_date?: string | Dayjs | null;
  end_date?: string | Dayjs | null;
  additional_loc_info?: string;
  short_description?: string;
  description?: string;
  description_html?: string;
  creator?: User | Organization | any; //TODO: remove 'any' once User and Organization types are properly defined
  image?: string;
  hubName?: string;
  related_hubs?: any[];
  hubUrl?: string;
  thumbnail_image?: string;
  sectors?: Sector[];
  has_children?: boolean; // Indicates if project has child projects (e.g., festival with sub-events)
  is_online?: boolean; // Indicates if the project/event/idea takes place online
  parent_project_id?: number; // ID of parent project (detail view only)
  parent_project_name?: string; // Name of parent project (detail view only)
  parent_project_slug?: string; // URL slug of parent project (detail view only)
  // Event registration fields (UI state for the create/edit form)
  registrationEnabled?: boolean;
  max_participants?: number | null;
  registration_end_date?: Dayjs | null;
  notify_admins?: boolean;
  registration_fields?: RegistrationField[];
  // Event registration data from the API (detail view)
  registration_config?: EventRegistrationData | null;
  /** The requesting user's own active registration for this event (detail view only). */
  my_event_registration?: MyEventRegistration | null;
};

/**
 * The requesting user's own event registration as returned by
 * ``GET /api/projects/{slug}/`` when they have an active registration.
 * Only present on the detail endpoint; always derived from ``request.user``.
 */
export type MyEventRegistration = {
  id: number;
  user_first_name: string;
  user_last_name: string;
  user_url_slug: string | null;
  user_thumbnail_image: string | null;
  registered_at: string;
  cancelled_at: string | null;
  cancellation_reason?: string | null;
  field_answers: RegistrationFieldAnswer[];
};

// The three entity types that can be browsed on the main pages (projects,
// organisations, members). The events calendar is a different view and is
// not part of this union.
export type BrowseEntity = "projects" | "organizations" | "members";
export type ProjectType = "project" | "idea" | "event";

export type Organization = {
  location: any;
  name: string;
  thumbnail_image: string;
  url_slug: string;
};

export type CcLocale = "en" | "de";

declare module "@mui/material/styles" {
  // augment theme type with climateconnect custom properties
  // eslint-disable-next-line no-unused-vars
  interface Palette {
    yellow: PaletteColor;
    contrast: {
      main: string;
      contrastText: string;
    };
  }
  // eslint-disable-next-line no-unused-vars
  interface PaletteOptions {
    yellow: PaletteColorOptions;
    contrast: ContrastColor;
  }
  // eslint-disable-next-line no-unused-vars
  interface PaletteColor {
    extraLight?: string;
    // lightHover?: string;
  }
  // eslint-disable-next-line no-unused-vars
  interface SimplePaletteColorOptions {
    lightHover?: string;
    extraLight?: string;
  }

  interface ContrastColor {
    main: string;
    contrastText: string;
  }
}

declare module "@mui/material/TextField" {
  // eslint-disable-next-line no-unused-vars
  interface TextFieldPropsColorOverrides {
    contrast: true;
  }
}

declare module "@mui/material/Button" {
  // eslint-disable-next-line no-unused-vars
  interface ButtonPropsColorOverrides {
    grey: true;
    contrast: true;
  }
}

declare module "@mui/material/Checkbox" {
  // eslint-disable-next-line no-unused-vars
  interface CheckboxPropsColorOverrides {
    contrast: true;
  }
}

declare module "@mui/material/Switch" {
  // eslint-disable-next-line no-unused-vars
  interface SwitchPropsColorOverrides {
    contrast: true;
  }
}

export type Supporter = {
  name: string;
  subtitle: string;
  logo: string;
  importance: number;
  organization_url_slug: string;
};

export type Sector = {
  id: number;
  name: string;
  key: string;
  icon?: string;
  original_name?: string;
  image?: string;
};

export type LinkedHub = {
  hubName: string;
  hubUrl: string;
  icon: string;
  backgroundColor?: string;
};

export type LocaleType = "en" | "de" | undefined;

export interface HubData {
  landing_page_component: string;
  hub_type: string;
  [key: string]: any;
}

/**
 * Minimal shape of an item in the shared hubs list (from `/api/hubs/`).
 * `url_slug` and `name` are the fields consumed app-wide; the index signature
 * keeps the type permissive for optional fields like `icon` / `landing_page_component`.
 */
export interface HubListItem {
  url_slug: string;
  name: string;
  [key: string]: any;
}

export type DonationGoal = {
  goal_name: string | undefined;
  goal_start: string | undefined;
  goal_end: string | undefined;
  goal_amount: number | undefined;
  current_amount: number | undefined;
  hub: string | undefined;
  call_to_action_text: string | undefined;
  call_to_action_link: string | undefined;
};

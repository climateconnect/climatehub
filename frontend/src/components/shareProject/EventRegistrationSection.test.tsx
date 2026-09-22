import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import EventRegistrationSection from "./EventRegistrationSection";
import { Project } from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../general/DatePicker", () => ({
  __esModule: true,
  default: ({ label }: any) => <input aria-label={label} />,
}));

jest.mock("./CheckboxFieldEditor", () => ({
  __esModule: true,
  default: () => <div data-testid="checkbox-editor" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultContext = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    project_type: { type_id: "event" } as any,
    max_participants: null,
    registration_end_date: null,
    notify_admins: true,
    registration_fields: [],
    collaborators_welcome: false,
    collaborating_organizations: [],
    loc: {},
    parent_organization: null,
    isPersonalProject: true,
    is_organization_project: false,
    team_members: [],
    website: "",
    language: "en",
    ...overrides,
  } as Project;
}

function renderSection({
  project = makeProject(),
  handleSetProjectData = jest.fn(),
  errors = {},
}: {
  project?: Project;
  handleSetProjectData?: jest.Mock;
  errors?: Record<string, string>;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={defaultContext as any}>
          <EventRegistrationSection
            projectData={project}
            handleSetProjectData={handleSetProjectData}
            errors={errors}
          />
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EventRegistrationSection", () => {
  // ── Core registration fields always visible ───────────────────────────────

  describe("core registration settings", () => {
    it("renders max participants and registration end date inputs", () => {
      renderSection();
      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /end of registration/i })).toBeInTheDocument();
    });

    it("renders the notify admins toggle", () => {
      renderSection();
      expect(screen.getByRole("switch", { name: /send a notification/i })).toBeInTheDocument();
    });
  });

  // ── Spec test case 6: custom fields section ────────────────────────────────

  describe("custom fields section", () => {
    it("renders the custom fields section header and Add field button", () => {
      renderSection();
      expect(screen.getByText(/additional registration fields/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add field/i })).toBeInTheDocument();
    });
  });

  // ── Custom fields list pre-populated from projectData ─────────────────────

  describe("pre-populated fields from projectData", () => {
    it("renders existing fields passed via projectData.registration_fields", () => {
      const project = makeProject({
        registration_fields: [
          {
            field_type: "option_select",
            order: 0,
            is_required: false,
            label: "Single choice 1",
            settings: { title: "Meal preference?" },
            options: [],
            _clientKey: "k1",
          },
        ],
      });
      renderSection({ project });
      expect(screen.getByText(/single choice/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Meal preference?")).toBeInTheDocument();
    });
  });
});

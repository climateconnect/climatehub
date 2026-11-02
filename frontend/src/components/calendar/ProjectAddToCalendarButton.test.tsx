import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import ProjectAddToCalendarButton from "./ProjectAddToCalendarButton";
import { Project } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultContextValue = {
  locale: "en" as any,
  user: { id: 1 },
  locales: [],
  pathName: "/",
  donationGoals: [],
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    url_slug: "test-event",
    name: "Climate Summit",
    project_type: { type_id: "event" } as any,
    is_draft: false,
    team: [],
    registration_config: null,
    ...overrides,
  } as Project;
}

function renderButton({
  project = makeProject(),
  isUserRegistered = false,
  contextOverrides = {},
}: {
  project?: Project;
  isUserRegistered?: boolean;
  contextOverrides?: Partial<typeof defaultContextValue>;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={{ ...defaultContextValue, ...contextOverrides } as any}>
        <ProjectAddToCalendarButton project={project} isUserRegistered={isUserRegistered} />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectAddToCalendarButton", () => {
  // ── Rendering ─────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders a calendar icon button for events", () => {
      renderButton();
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("renders nothing when project is not an event", () => {
      renderButton({
        project: makeProject({ project_type: { type_id: "project" } as any }),
      });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders nothing when project_type is undefined", () => {
      renderButton({
        project: makeProject({ project_type: undefined as any }),
      });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  // ── Dialog interaction ────────────────────────────────────────────────────

  describe("dialog interaction", () => {
    it("opens the Add to Calendar dialog when the button is clicked", () => {
      renderButton();
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByText(/add to calendar/i)).toBeInTheDocument();
    });
  });
});

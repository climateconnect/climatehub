import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import AddToCalendarDialog from "./AddToCalendarDialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultTexts = {
  add_to_calendar: "Add to Calendar",
  add_to_google_calendar: "Google Calendar",
  add_to_apple_calendar: "Apple Calendar / iCal",
  you_are_registered_for_this_event: "You're registered for this event.",
  not_registered_yet_reminder: "Not registered yet — don't forget to sign up!",
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof AddToCalendarDialog>> = {}) {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    slug: "test-event",
    locale: "en",
    isEvent: true,
    registrationConfig: null,
    isUserRegistered: false,
    user: null,
    texts: defaultTexts,
    ...overrides,
  };
  return render(
    <ThemeProvider theme={theme}>
      <AddToCalendarDialog {...defaultProps} />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddToCalendarDialog", () => {
  // ── Rendering ─────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the dialog title", () => {
      renderDialog();
      expect(screen.getByText("Add to Calendar")).toBeInTheDocument();
    });

    it("renders Google Calendar and Apple Calendar / iCal links", () => {
      renderDialog();
      expect(screen.getByText("Google Calendar")).toBeInTheDocument();
      expect(screen.getByText("Apple Calendar / iCal")).toBeInTheDocument();
    });

    it("does not render when open=false", () => {
      renderDialog({ open: false });
      expect(screen.queryByText("Add to Calendar")).not.toBeInTheDocument();
    });
  });

  // ── Link URLs ─────────────────────────────────────────────────────────────

  describe("link URLs", () => {
    it("links Google Calendar to the correct redirect endpoint", () => {
      renderDialog({ slug: "my-event" });
      const link = screen.getByText("Google Calendar").closest("a");
      expect(link).toHaveAttribute("href", "/projects/my-event/add-to-google-calendar");
    });

    it("links Apple Calendar to the correct .ical endpoint", () => {
      renderDialog({ slug: "my-event" });
      const link = screen.getByText("Apple Calendar / iCal").closest("a");
      expect(link).toHaveAttribute("href", "/calendar/my-event.ical");
    });

    it("includes locale prefix in URLs when locale is not en", () => {
      renderDialog({ slug: "my-event", locale: "de" });
      const googleLink = screen.getByText("Google Calendar").closest("a");
      const icalLink = screen.getByText("Apple Calendar / iCal").closest("a");
      expect(googleLink).toHaveAttribute("href", "/de/projects/my-event/add-to-google-calendar");
      expect(icalLink).toHaveAttribute("href", "/de/calendar/my-event.ical");
    });
  });

  // ── Google Calendar link opens in new tab ──────────────────────────────────

  describe("Google Calendar link target", () => {
    it("opens in a new tab with target=_blank", () => {
      renderDialog();
      const link = screen.getByText("Google Calendar").closest("a");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("Apple Calendar link does not open in a new tab", () => {
      renderDialog();
      const link = screen.getByText("Apple Calendar / iCal").closest("a");
      expect(link).not.toHaveAttribute("target", "_blank");
    });
  });

  // ── Registration reminder ─────────────────────────────────────────────────

  describe("registration reminder", () => {
    it("does not show reminder when user is not logged in", () => {
      renderDialog({
        registrationConfig: { is_draft: false },
        user: null,
      });
      expect(screen.queryByText(/registered/)).not.toBeInTheDocument();
    });

    it("does not show reminder when registrationConfig is null", () => {
      renderDialog({
        registrationConfig: null,
        user: { id: 1 },
      });
      expect(screen.queryByText(/registered/)).not.toBeInTheDocument();
    });

    it("does not show reminder when registration is draft", () => {
      renderDialog({
        registrationConfig: { is_draft: true },
        user: { id: 1 },
      });
      expect(screen.queryByText(/registered/)).not.toBeInTheDocument();
    });

    it("shows success alert when user is registered", () => {
      renderDialog({
        registrationConfig: { is_draft: false },
        isUserRegistered: true,
        user: { id: 1 },
      });
      expect(screen.getByText("You're registered for this event.")).toBeInTheDocument();
    });

    it("shows info alert when user is not registered", () => {
      renderDialog({
        registrationConfig: { is_draft: false },
        isUserRegistered: false,
        user: { id: 1 },
      });
      expect(screen.getByText("Not registered yet — don't forget to sign up!")).toBeInTheDocument();
    });
  });

  // ── Dialog dismissal ──────────────────────────────────────────────────────

  describe("dismissal", () => {
    it("calls onClose when the dialog is closed", () => {
      const onClose = jest.fn();
      renderDialog({ onClose });
      // The GenericDialog calls onClose when its close button / backdrop is clicked.
      // We can trigger it via the escape key.
      screen.getByRole("dialog").parentElement && screen.getByText("Add to Calendar"); // verify dialog is open
      // GenericDialog typically has a close button
      const closeButton = screen.getByRole("button", { name: /close/i });
      if (closeButton) {
        closeButton.click();
        expect(onClose).toHaveBeenCalledWith(false);
      }
    });
  });
});

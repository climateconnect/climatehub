import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../../themes/theme";
import RegistrationActionButton from "./RegistrationActionButton";
import { Project } from "../../../types";
import { RegistrationUIState } from "../../../utils/eventRegistrationHelpers";
import UserContext from "../../context/UserContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEXTS = {
  you_attended_this_event: "You attended this event",
  modify_registration: "Modify registration",
  cancel_registration: "Cancel registration",
  registration_closed: "Registration closed",
  register_now: "Register now",
  booked_out: "Booked Out",
  already_registered: "Registered ✓",
  seats_available: "Seats available",
};

const MOCK_USER_CONTEXT = {
  user: null,
  locale: "en" as const,
  locales: ["en", "de"] as const,
  pathName: "/",
  donationGoals: [],
  hubUrl: "",
};

function makeProject(status: string, availableSeats?: number, maxParticipants?: number): Project {
  return {
    url_slug: "test-event",
    name: "Test Event",
    registration_config: {
      status,
      available_seats: availableSeats ?? null,
      max_participants: maxParticipants ?? null,
    },
  } as Project;
}

function renderButton({
  registrationState,
  project = makeProject("open"),
  isUserRegistered = false,
  handleRegisterClick = jest.fn(),
  onModifyRegistrationClick = jest.fn(),
  fallback = null,
  showSeatsCount = false,
}: {
  registrationState: RegistrationUIState;
  project?: Project;
  isUserRegistered?: boolean;
  handleRegisterClick?: jest.Mock;
  onModifyRegistrationClick?: jest.Mock;
  fallback?: React.ReactNode;
  showSeatsCount?: boolean;
}) {
  return render(
    <UserContext.Provider value={MOCK_USER_CONTEXT}>
      <ThemeProvider theme={theme}>
        <RegistrationActionButton
          registrationState={registrationState}
          project={project}
          texts={TEXTS}
          isUserRegistered={isUserRegistered}
          handleRegisterClick={handleRegisterClick}
          onModifyRegistrationClick={onModifyRegistrationClick}
          fallback={fallback}
          showSeatsCount={showSeatsCount}
        />
      </ThemeProvider>
    </UserContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RegistrationActionButton", () => {
  // ── attended ──────────────────────────────────────────────────────────────

  describe('state: "attended"', () => {
    it('does not render the "You attended this event" label in the button area', () => {
      renderButton({ registrationState: "attended" });
      expect(screen.queryByText("You attended this event")).not.toBeInTheDocument();
    });

    it("does not render a button", () => {
      renderButton({ registrationState: "attended" });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe('state: "cancel"', () => {
    it('renders the "Modify registration" button', () => {
      renderButton({ registrationState: "cancel" });
      expect(screen.getByRole("button", { name: /modify registration/i })).toBeInTheDocument();
    });

    it("calls onModifyRegistrationClick when clicked", () => {
      const onModifyRegistrationClick = jest.fn();
      renderButton({ registrationState: "cancel", onModifyRegistrationClick });
      fireEvent.click(screen.getByRole("button", { name: /modify registration/i }));
      expect(onModifyRegistrationClick).toHaveBeenCalledTimes(1);
    });

    it("button is not disabled", () => {
      renderButton({ registrationState: "cancel" });
      expect(screen.getByRole("button", { name: /modify registration/i })).not.toBeDisabled();
    });
  });

  // ── adminClosed ───────────────────────────────────────────────────────────

  describe('state: "adminClosed"', () => {
    it('renders a disabled "Booked out" button', () => {
      renderButton({ registrationState: "adminClosed" });
      const btn = screen.getByRole("button", { name: /booked out/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    });

    it("does not call any handler when clicked (disabled)", () => {
      const handleRegisterClick = jest.fn();
      const onModifyRegistrationClick = jest.fn();
      renderButton({
        registrationState: "adminClosed",
        handleRegisterClick,
        onModifyRegistrationClick,
      });
      const btn = screen.getByRole("button", { name: /booked out/i });
      fireEvent.click(btn);
      expect(handleRegisterClick).not.toHaveBeenCalled();
      expect(onModifyRegistrationClick).not.toHaveBeenCalled();
    });
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('state: "register"', () => {
    it('renders the "Register now" button for an open event', () => {
      renderButton({ registrationState: "register", project: makeProject("open") });
      expect(screen.getByRole("button", { name: /register now/i })).toBeInTheDocument();
    });

    it("button is enabled for an open event", () => {
      renderButton({ registrationState: "register", project: makeProject("open") });
      expect(screen.getByRole("button", { name: /register now/i })).not.toBeDisabled();
    });

    it("calls handleRegisterClick when clicked", () => {
      const handleRegisterClick = jest.fn();
      renderButton({
        registrationState: "register",
        project: makeProject("open"),
        handleRegisterClick,
      });
      fireEvent.click(screen.getByRole("button", { name: /register now/i }));
      expect(handleRegisterClick).toHaveBeenCalledTimes(1);
    });
  });

  // ── closed ────────────────────────────────────────────────────────────────

  describe('state: "closed"', () => {
    it('renders a disabled "Booked Out" button for a closed event', () => {
      renderButton({ registrationState: "closed", project: makeProject("closed") });
      const btn = screen.getByRole("button", { name: /booked out/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    });

    it('renders a disabled "Booked out" button for a full event', () => {
      renderButton({ registrationState: "closed", project: makeProject("full") });
      const btn = screen.getByRole("button", { name: /booked out/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    });
  });

  // ── hidden ────────────────────────────────────────────────────────────────

  describe('state: "hidden"', () => {
    it("renders the fallback node when provided", () => {
      renderButton({
        registrationState: "hidden",
        fallback: <span>Follow instead</span>,
      });
      expect(screen.getByText("Follow instead")).toBeInTheDocument();
    });

    it("renders nothing when no fallback is provided", () => {
      const { container } = renderButton({ registrationState: "hidden" });
      expect(container.firstChild).toBeNull();
    });
  });

  // ── showSeatsCount ────────────────────────────────────────────────────────

  describe("showSeatsCount prop", () => {
    it("displays available seats when showSeatsCount is true and registration data is present", () => {
      renderButton({
        registrationState: "register",
        project: makeProject("open", 15, 50),
        showSeatsCount: true,
      });
      expect(screen.getByText(/15 \/ 50/)).toBeInTheDocument();
      expect(screen.getByText(/seats available/i)).toBeInTheDocument();
    });

    it("does not display seats when showSeatsCount is false", () => {
      renderButton({
        registrationState: "register",
        project: makeProject("open", 15, 50),
        showSeatsCount: false,
      });
      expect(screen.queryByText(/seats available/i)).not.toBeInTheDocument();
    });

    it("does not display seats when available_seats is null", () => {
      renderButton({
        registrationState: "register",
        project: makeProject("open", null, 50),
        showSeatsCount: true,
      });
      expect(screen.queryByText(/seats available/i)).not.toBeInTheDocument();
    });

    it("does not display seats when max_participants is null", () => {
      renderButton({
        registrationState: "register",
        project: makeProject("open", 15, null),
        showSeatsCount: true,
      });
      expect(screen.queryByText(/seats available/i)).not.toBeInTheDocument();
    });

    it("does not display seats for closed/full events (seats only shown for register state)", () => {
      renderButton({
        registrationState: "closed",
        project: makeProject("full", 0, 50),
        showSeatsCount: true,
      });
      expect(screen.queryByText(/0 \/ 50/)).not.toBeInTheDocument();
      expect(screen.queryByText(/seats available/i)).not.toBeInTheDocument();
    });

    it("does not display seats for cancel state (seats only shown for register state)", () => {
      renderButton({
        registrationState: "cancel",
        project: makeProject("open", 15, 50),
        showSeatsCount: true,
      });
      expect(screen.queryByText(/15 \/ 50/)).not.toBeInTheDocument();
      expect(screen.queryByText(/seats available/i)).not.toBeInTheDocument();
    });
  });
});

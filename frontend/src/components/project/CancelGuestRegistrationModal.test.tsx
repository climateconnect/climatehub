import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import CancelGuestRegistrationModal, { RegistrationInfo } from "./CancelGuestRegistrationModal";
import { Project } from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("universal-cookie", () => {
  return jest.fn(() => ({ get: jest.fn(() => "test-token") }));
});

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const defaultContextValue = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    url_slug: "test-event",
    name: "Test Event",
    project_type: { type_id: "event" } as any,
    end_date: "2099-06-30T23:59:00.000Z",
    is_draft: false,
    team: [],
    ...overrides,
  } as Project;
}

function makeRegistration(overrides: Partial<RegistrationInfo> = {}): RegistrationInfo {
  return {
    id: 42,
    user_first_name: "Alice",
    user_last_name: "Smith",
    ...overrides,
  };
}

function renderModal({
  project = makeProject(),
  registration = makeRegistration(),
  onClose = jest.fn(),
  onCancelled = jest.fn(),
  open = true,
}: {
  project?: Project;
  registration?: RegistrationInfo | null;
  onClose?: jest.Mock;
  onCancelled?: jest.Mock;
  open?: boolean;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContextValue as any}>
        <CancelGuestRegistrationModal
          open={open}
          onClose={onClose}
          registration={registration}
          project={project}
          onCancelled={onCancelled}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Default: DELETE returns 204 (no content — axios resolves with empty data)
  mockApiRequest.mockResolvedValue({ data: undefined, status: 204 });
});

describe("CancelGuestRegistrationModal", () => {
  // ── Rendering ─────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("shows the guest name and event title in the confirmation text", () => {
      renderModal({
        registration: makeRegistration({ user_first_name: "Bob", user_last_name: "Jones" }),
        project: makeProject({ name: "Climate Summit" }),
      });
      expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();
      expect(screen.getByText(/Climate Summit/)).toBeInTheDocument();
    });

    it("renders the optional message textarea", () => {
      renderModal();
      expect(screen.getByRole("textbox", { name: /message to guest/i })).toBeInTheDocument();
    });

    it("renders 'Keep registration' and 'Yes, cancel registration' buttons", () => {
      renderModal();
      expect(screen.getByRole("button", { name: /keep registration/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /yes, cancel registration/i })).toBeInTheDocument();
    });

    it("does not render when open=false", () => {
      renderModal({ open: false });
      expect(screen.queryByRole("button", { name: /keep registration/i })).not.toBeInTheDocument();
    });
  });

  // ── Dismissal ─────────────────────────────────────────────────────────────

  describe("dismissal", () => {
    it("calls onClose when 'Keep registration' is clicked", () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole("button", { name: /keep registration/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  // ── Confirm with no message ────────────────────────────────────────────────

  describe("confirm without message", () => {
    it("calls PATCH endpoint without a message body when message is empty", async () => {
      const onCancelled = jest.fn();
      const onClose = jest.fn();
      renderModal({ onCancelled, onClose });

      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      const { method, url, payload } = mockApiRequest.mock.calls[0][0];
      expect(method).toBe("patch");
      expect(url).toBe("/api/projects/test-event/registrations/42/");
      expect(payload).toEqual({});
    });

    it("calls onCancelled with the registration id after success", async () => {
      const onCancelled = jest.fn();
      renderModal({ onCancelled, registration: makeRegistration({ id: 99 }) });

      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(99));
    });

    it("closes the modal after a successful cancellation", async () => {
      const onClose = jest.fn();
      renderModal({ onClose });

      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  // ── Confirm with message ───────────────────────────────────────────────────

  describe("confirm with message", () => {
    it("includes the trimmed message in the request body", async () => {
      renderModal();
      const textarea = screen.getByRole("textbox", { name: /message to guest/i });
      fireEvent.change(textarea, { target: { value: "  Please re-register later.  " } });

      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      const { payload } = mockApiRequest.mock.calls[0][0];
      expect(payload).toEqual({ message: "Please re-register later." });
    });
  });

  // ── API error handling ────────────────────────────────────────────────────

  describe("API error handling", () => {
    it("shows an inline error when the API returns a detail message", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { detail: "Registration already cancelled." } },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/registration already cancelled/i);
      });
    });

    it("does NOT call onCancelled or onClose on error", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { detail: "Forbidden." } },
      });
      const onCancelled = jest.fn();
      const onClose = jest.fn();
      renderModal({ onCancelled, onClose });

      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => screen.getByRole("alert"));

      expect(onCancelled).not.toHaveBeenCalled();
      // onClose is not called by the component on error (user must dismiss manually)
      expect(onClose).not.toHaveBeenCalled();
    });

    it("re-enables the buttons after an error", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { detail: "Something failed." } },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));
      await waitFor(() => screen.getByRole("alert"));
      expect(screen.getByRole("button", { name: /keep registration/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /yes, cancel registration/i })).not.toBeDisabled();
    });
  });

  // ── Form reset on re-open ─────────────────────────────────────────────────

  describe("form reset", () => {
    it("clears the message textarea when the modal is re-opened", () => {
      const { rerender } = renderModal({ open: false });

      rerender(
        <ThemeProvider theme={theme}>
          <UserContext.Provider value={defaultContextValue as any}>
            <CancelGuestRegistrationModal
              open={true}
              onClose={jest.fn()}
              registration={makeRegistration()}
              project={makeProject()}
              onCancelled={jest.fn()}
            />
          </UserContext.Provider>
        </ThemeProvider>
      );

      const textarea = screen.getByRole("textbox", { name: /message to guest/i });
      expect(textarea).toHaveValue("");
    });
  });
});

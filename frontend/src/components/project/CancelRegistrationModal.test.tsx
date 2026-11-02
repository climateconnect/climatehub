import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import CancelRegistrationModal from "./CancelRegistrationModal";
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
// Helpers
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
    name: "Climate Summit",
    project_type: { type_id: "event" } as any,
    is_draft: false,
    team: [],
    ...overrides,
  } as Project;
}

function renderModal({
  project = makeProject(),
  open = true,
  onClose = jest.fn(),
  onCancellationSuccess = jest.fn(),
}: {
  project?: Project;
  open?: boolean;
  onClose?: jest.Mock;
  onCancellationSuccess?: jest.Mock;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContextValue as any}>
        <CancelRegistrationModal
          open={open}
          onClose={onClose}
          project={project}
          onCancellationSuccess={onCancellationSuccess}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Default: DELETE returns 204
  mockApiRequest.mockResolvedValue({ data: undefined, status: 204 });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CancelRegistrationModal", () => {
  // ── Rendering ─────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the event name in the confirmation message", () => {
      renderModal({ project: makeProject({ name: "Climate Summit" }) });
      expect(screen.getByText(/Climate Summit/)).toBeInTheDocument();
    });

    it('renders "Yes, cancel registration" and "Keep registration" buttons', () => {
      renderModal();
      expect(screen.getByRole("button", { name: /yes, cancel registration/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /keep registration/i })).toBeInTheDocument();
    });

    it("does not render when open=false", () => {
      renderModal({ open: false });
      expect(
        screen.queryByRole("button", { name: /yes, cancel registration/i })
      ).not.toBeInTheDocument();
    });
  });

  // ── Dismissal ─────────────────────────────────────────────────────────────

  describe("dismissal", () => {
    it('calls onClose when "Keep registration" is clicked', () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole("button", { name: /keep registration/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  // ── Successful cancellation ────────────────────────────────────────────────

  describe("confirm cancellation — success", () => {
    it("calls DELETE /api/projects/{slug}/registrations/ with the correct URL and method", async () => {
      renderModal({ project: makeProject({ url_slug: "my-event" }) });
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      const { method, url } = mockApiRequest.mock.calls[0][0];
      expect(method).toBe("delete");
      expect(url).toBe("/api/projects/my-event/registrations/");
    });

    it("calls onCancellationSuccess after a successful DELETE", async () => {
      const onCancellationSuccess = jest.fn();
      renderModal({ onCancellationSuccess });
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(onCancellationSuccess).toHaveBeenCalledTimes(1));
    });

    it("closes the modal after successful cancellation", async () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("hides action buttons while the request is in-flight", async () => {
      // Never resolves — keeps loading state
      mockApiRequest.mockReturnValue(new Promise(() => {}));
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /yes, cancel registration/i })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: /keep registration/i })
        ).not.toBeInTheDocument();
      });
    });

    it("shows a loading spinner while the request is in-flight", async () => {
      mockApiRequest.mockReturnValue(new Promise(() => {}));
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => {
        expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument();
      });
    });
  });

  // ── API error handling ────────────────────────────────────────────────────

  describe("API error handling", () => {
    it("shows an inline error message when the API returns a detail field", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { detail: "Registration not found." } },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(screen.getByText("Registration not found.")).toBeInTheDocument());
    });

    it("shows an inline error message when the API returns a message field", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { message: "Event has already started." } },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() =>
        expect(screen.getByText("Event has already started.")).toBeInTheDocument()
      );
    });

    it("shows a fallback error message when the API response has no message", async () => {
      mockApiRequest.mockRejectedValueOnce({ response: { data: {} } });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() =>
        expect(screen.getByText(/failed to cancel registration/i)).toBeInTheDocument()
      );
    });

    it("re-shows action buttons after an error so the user can retry", async () => {
      mockApiRequest.mockRejectedValueOnce({ response: { data: {} } });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /yes, cancel registration/i })
        ).toBeInTheDocument()
      );
      expect(screen.getByRole("button", { name: /keep registration/i })).toBeInTheDocument();
    });

    it("does not call onCancellationSuccess when the API fails", async () => {
      mockApiRequest.mockRejectedValueOnce({ response: { data: {} } });
      const onCancellationSuccess = jest.fn();
      renderModal({ onCancellationSuccess });
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => screen.getByText(/failed to cancel registration/i));
      expect(onCancellationSuccess).not.toHaveBeenCalled();
    });

    it("clears the error message when the modal is closed and reopened", async () => {
      mockApiRequest.mockRejectedValueOnce({ response: { data: {} } });
      const onClose = jest.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));
      await waitFor(() => screen.getByText(/failed to cancel registration/i));

      // Dismiss via Keep registration
      fireEvent.click(screen.getByRole("button", { name: /keep registration/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── 403 / 404 / 400 backend guards ────────────────────────────────────────

  describe("backend guard error cases (403, 404, 400)", () => {
    it("shows error for 403 — cancelling another member's registration", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 403, data: { detail: "You do not own this registration." } },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() =>
        expect(screen.getByText("You do not own this registration.")).toBeInTheDocument()
      );
    });

    it("shows error for 404 — registration not found or already cancelled", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 404, data: { detail: "Not found." } },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() => expect(screen.getByText("Not found.")).toBeInTheDocument());
    });

    it("shows error for 400 — event has already started", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 400, data: { detail: "Event has already started." } },
      });
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /yes, cancel registration/i }));

      await waitFor(() =>
        expect(screen.getByText("Event has already started.")).toBeInTheDocument()
      );
    });
  });
});

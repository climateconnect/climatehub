import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import SendEmailToGuestsModal from "./SendEmailToGuestsModal";
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

// Mock OrganizerMessageEditor: renders a textarea that calls onChange
jest.mock("../richText/OrganizerMessageEditor", () => {
  const React = require("react");
  return {
    __esModule: true,
    stripHtml: (html: string) => html.replace(/<[^>]*>/g, "").trim(),
    default: ({ content, onChange, editable, error, ariaLabel }: any) => (
      <div>
        <div
          role="textbox"
          aria-label={ariaLabel || "message"}
          contentEditable={editable !== false}
          onInput={(e: any) => {
            const html = `<p>${e.target.textContent}</p>`;
            onChange(html === "<p></p>" ? "" : html);
          }}
          data-testid="rich-text-editor"
        >
          {content}
        </div>
        {error && <div data-testid="editor-error">{error}</div>}
      </div>
    ),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    url_slug: "test-event",
    name: "Test Event",
    project_type: { type_id: "event" } as any,
    is_draft: false,
    team: [],
    ...overrides,
  } as Project;
}

const ORGANISER_EMAIL = "organiser@example.com";

function makeContextValue(email?: string) {
  return {
    locale: "en" as const,
    user: email ? { id: "1", first_name: "Jane", email } : null,
    locales: [] as any,
    pathName: "/",
    donationGoals: [],
    hubUrl: "",
  };
}

function makeRegistration(
  overrides: Partial<{ id: number; registered_at: string; cancelled_at: string | null }> = {}
) {
  return {
    id: 1,
    registered_at: new Date().toISOString(),
    cancelled_at: null,
    ...overrides,
  };
}

function renderModal({
  project = makeProject(),
  onClose = jest.fn(),
  email = ORGANISER_EMAIL,
  activeGuestCount = 5,
  lastGuestEmailSentAt = null,
  registrations = [],
}: {
  project?: Project;
  onClose?: jest.Mock;
  email?: string;
  activeGuestCount?: number;
  lastGuestEmailSentAt?: string | null;
  registrations?: Array<{ id: number; registered_at: string; cancelled_at: string | null }>;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(email) as any}>
        <SendEmailToGuestsModal
          open={true}
          onClose={onClose}
          project={project}
          activeGuestCount={activeGuestCount}
          lastGuestEmailSentAt={lastGuestEmailSentAt}
          registrations={registrations}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

function typeInEditor(text: string) {
  const editor = screen.getByTestId("rich-text-editor");
  fireEvent.input(editor, { target: { textContent: text } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockApiRequest.mockResolvedValue({ data: { sent_count: 42 } });
});

describe("SendEmailToGuestsModal", () => {
  describe("initial render", () => {
    it("renders subject field and rich-text editor", () => {
      renderModal();
      expect(screen.getByRole("textbox", { name: /subject/i })).toHaveValue("");
      expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    });

    it("renders Send now, Send test, and Cancel buttons", () => {
      renderModal();
      expect(screen.getByRole("button", { name: /send now/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send test/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("does not show confirmation text initially", () => {
      renderModal();
      expect(screen.queryByText(/email sent to/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/test email sent to/i)).not.toBeInTheDocument();
    });
  });

  describe("client-side validation", () => {
    it("shows subject error when subject is empty", async () => {
      renderModal();
      typeInEditor("Hello guests!");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() => {
        expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
      });
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("shows message error when message is empty", async () => {
      renderModal();
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Important update" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() => {
        expect(screen.getByText(/message is required/i)).toBeInTheDocument();
      });
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("shows both errors when both fields are empty", async () => {
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() => {
        expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
        expect(screen.getByText(/message is required/i)).toBeInTheDocument();
      });
    });
  });

  describe("confirmation step", () => {
    async function fillAndClickSendNow(guestCount = 5) {
      renderModal({ activeGuestCount: guestCount });
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Event update" },
      });
      typeInEditor("Please note the time change.");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
    }

    it("shows confirmation step after clicking Send now with valid form", async () => {
      await fillAndClickSendNow();
      expect(mockApiRequest).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /confirm and send/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });

    it("shows the active guest count in the confirmation step", async () => {
      await fillAndClickSendNow(12);
      expect(screen.getByText(/12 registered guests/i)).toBeInTheDocument();
    });

    it("shows team admins notice in the confirmation step", async () => {
      await fillAndClickSendNow();
      expect(screen.getByText(/team admins will also receive a copy/i)).toBeInTheDocument();
    });

    it("Back button returns to the compose form with subject and message preserved", async () => {
      await fillAndClickSendNow();
      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(screen.getByRole("textbox", { name: /subject/i })).toHaveValue("Event update");
      expect(screen.getByTestId("rich-text-editor")).toHaveTextContent(
        "Please note the time change."
      );
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe("Confirm and send", () => {
    async function fillAndConfirmSend(guestCount = 5) {
      renderModal({ activeGuestCount: guestCount });
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Event update" },
      });
      typeInEditor("Please note the time change.");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /confirm and send/i })).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirm and send/i }));
      });
    }

    it("calls the API with is_test=false and the correct payload", async () => {
      await fillAndConfirmSend();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
      const { payload, url } = mockApiRequest.mock.calls[0][0];
      expect(url).toContain("/registrations/email/");
      expect(payload.is_test).toBe(false);
      expect(payload.subject).toBe("Event update");
    });

    it("shows the bulk confirmation with the recipient count after success", async () => {
      await fillAndConfirmSend();
      await waitFor(() => {
        expect(screen.getByText(/email sent to 42 registered guests/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole("textbox", { name: /subject/i })).not.toBeInTheDocument();
    });

    it("shows a Close button in the success view", async () => {
      await fillAndConfirmSend();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
      });
    });
  });

  describe("Send test", () => {
    async function fillAndSendTest() {
      renderModal();
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Test subject" },
      });
      typeInEditor("Test body");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send test/i }));
      });
    }

    it("calls the API immediately with is_test=true", async () => {
      await fillAndSendTest();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
      expect(mockApiRequest.mock.calls[0][0].payload.is_test).toBe(true);
      expect(screen.queryByRole("button", { name: /confirm and send/i })).not.toBeInTheDocument();
    });

    it("returns to the form after a test send", async () => {
      await fillAndSendTest();
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /subject/i })).toBeInTheDocument();
        expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
      });
    });

    it("shows an inline success notice with the organiser's email after a test send", async () => {
      await fillAndSendTest();
      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(`test email sent to ${ORGANISER_EMAIL}`, "i"))
        ).toBeInTheDocument();
      });
    });

    it("shows Send now and Send test buttons after a test send", async () => {
      await fillAndSendTest();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /send now/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /send test/i })).toBeInTheDocument();
      });
    });
  });

  describe("API error handling", () => {
    it("shows a general error when the confirm-send API fails", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { detail: "Something went wrong." } },
      });
      renderModal();
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Hi" },
      });
      typeInEditor("Body");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /confirm and send/i })).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirm and send/i }));
      });
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
      });
      expect(screen.getByRole("textbox", { name: /subject/i })).toBeInTheDocument();
    });

    it("shows field-level errors returned by the API", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { subject: ["Subject is too long."] } },
      });
      renderModal();
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "x".repeat(201) },
      });
      typeInEditor("Body");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /confirm and send/i })).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirm and send/i }));
      });
      await waitFor(() => {
        expect(screen.getByText(/subject is too long/i)).toBeInTheDocument();
      });
    });
  });

  describe("close behaviour", () => {
    it("calls onClose when Cancel is clicked", () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Close is clicked after a bulk send", async () => {
      const onClose = jest.fn();
      render(
        <ThemeProvider theme={theme}>
          <UserContext.Provider value={makeContextValue(ORGANISER_EMAIL) as any}>
            <SendEmailToGuestsModal
              open={true}
              onClose={onClose}
              project={makeProject()}
              activeGuestCount={3}
              lastGuestEmailSentAt={null}
              registrations={[]}
            />
          </UserContext.Provider>
        </ThemeProvider>
      );
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Hi" },
      });
      typeInEditor("Body");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /confirm and send/i })).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirm and send/i }));
      });
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
      );
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps Cancel available after a test send", async () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Hi" },
      });
      typeInEditor("Body");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /send test/i }));
      });
      await waitFor(() =>
        expect(screen.getByText(new RegExp(ORGANISER_EMAIL))).toBeInTheDocument()
      );
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("new guests only toggle", () => {
    it("hides toggle when lastGuestEmailSentAt is null", () => {
      renderModal({ lastGuestEmailSentAt: null });
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows toggle with formatted date when lastGuestEmailSentAt exists and newGuestCount > 0", () => {
      const lastSend = "2026-06-05T10:00:00Z";
      const registrations = [
        makeRegistration({ id: 1, registered_at: "2026-06-01T10:00:00Z" }),
        makeRegistration({ id: 2, registered_at: "2026-06-10T10:00:00Z" }),
      ];
      renderModal({ lastGuestEmailSentAt: lastSend, registrations });
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it("hides toggle when lastGuestEmailSentAt exists but newGuestCount is 0", () => {
      const lastSend = "2026-06-15T10:00:00Z";
      const registrations = [
        makeRegistration({ id: 1, registered_at: "2026-06-01T10:00:00Z" }),
        makeRegistration({ id: 2, registered_at: "2026-06-10T10:00:00Z" }),
      ];
      renderModal({ lastGuestEmailSentAt: lastSend, registrations });
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("updates recipient count when toggle is changed", async () => {
      const lastSend = "2026-06-05T10:00:00Z";
      const registrations = [
        makeRegistration({ id: 1, registered_at: "2026-06-01T10:00:00Z" }),
        makeRegistration({ id: 2, registered_at: "2026-06-10T10:00:00Z" }),
      ];
      renderModal({
        activeGuestCount: 2,
        lastGuestEmailSentAt: lastSend,
        registrations,
      });

      // Toggle defaults to OFF — confirmation should show 2 guests
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Hi" },
      });
      typeInEditor("Body");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() => expect(screen.getByText(/2 registered guests/i)).toBeInTheDocument());
    });

    it("toggle defaults to OFF", () => {
      const lastSend = "2026-06-05T10:00:00Z";
      const registrations = [makeRegistration({ id: 2, registered_at: "2026-06-10T10:00:00Z" })];
      renderModal({ lastGuestEmailSentAt: lastSend, registrations });
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("API payload includes send_to_new_guests_only: true when toggle is on", async () => {
      const lastSend = "2026-06-05T10:00:00Z";
      const registrations = [makeRegistration({ id: 2, registered_at: "2026-06-10T10:00:00Z" })];
      renderModal({
        activeGuestCount: 1,
        lastGuestEmailSentAt: lastSend,
        registrations,
      });

      // Turn on the toggle
      fireEvent.click(screen.getByRole("checkbox"));

      // Fill and send
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Update" },
      });
      typeInEditor("Body");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /confirm and send/i })).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirm and send/i }));
      });

      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
      expect(mockApiRequest.mock.calls[0][0].payload.send_to_new_guests_only).toBe(true);
    });

    it("API payload includes send_to_new_guests_only: false when toggle is off", async () => {
      const lastSend = "2026-06-05T10:00:00Z";
      const registrations = [makeRegistration({ id: 2, registered_at: "2026-06-10T10:00:00Z" })];
      renderModal({
        activeGuestCount: 1,
        lastGuestEmailSentAt: lastSend,
        registrations,
      });

      // Leave toggle OFF, fill and send
      fireEvent.change(screen.getByRole("textbox", { name: /subject/i }), {
        target: { value: "Update" },
      });
      typeInEditor("Body");
      fireEvent.click(screen.getByRole("button", { name: /send now/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /confirm and send/i })).toBeInTheDocument()
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /confirm and send/i }));
      });

      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
      expect(mockApiRequest.mock.calls[0][0].payload.send_to_new_guests_only).toBe(false);
    });
  });
});

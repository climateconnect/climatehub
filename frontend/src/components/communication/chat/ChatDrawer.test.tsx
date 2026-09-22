import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../../themes/theme";
import UserContext from "../../context/UserContext";
import ChatDrawer from "./ChatDrawer";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("universal-cookie", () => {
  return jest.fn(() => ({ get: jest.fn(() => "test-token") }));
});

const mockApiRequest = jest.fn();
jest.mock("../../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

jest.mock("next/router", () => ({
  useRouter: () => ({ locale: "en", query: {}, asPath: "/" }),
}));

// IntersectionObserver is not available in JSDOM (used by useChatScroll)
beforeAll(() => {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const me = {
  id: 2,
  url_slug: "me",
  first_name: "My",
  last_name: "Self",
  name: "My Self",
  thumbnail_image: null,
};

const partner = {
  id: 1,
  url_slug: "jane-doe",
  first_name: "Jane",
  last_name: "Doe",
  name: "Jane Doe",
  thumbnail_image: null,
};

const contactPerson = {
  id: 1,
  url_slug: "jane-doe",
  first_name: "Jane",
  last_name: "Doe",
  name: "Jane Doe",
  thumbnail_image: null,
};

const defaultContextValue = {
  locale: "en" as any,
  user: me,
  chatSocket: null,
  socketConnectionState: undefined,
  notifications: [],
  pathName: "/projects/test-project",
};

function mockChatApiResponses(messages: any[] = []) {
  mockApiRequest.mockImplementation(({ method, url }: any) => {
    if (method === "post" && url === "/api/start_private_chat/") {
      return Promise.resolve({ data: { chat_uuid: "chat-1", id: 5 } });
    }
    if (method === "get" && url === "/api/chat/chat-1/") {
      return Promise.resolve({
        data: {
          participants: [
            { user_profile: partner, role: { role_type: 100 }, participant_id: 1 },
            { user_profile: me, role: { role_type: 100 }, participant_id: 2 },
          ],
          user: { id: me.id },
          name: "",
          id: 5,
          related_idea: null,
        },
      });
    }
    if (method === "get" && url?.includes("/api/messages/")) {
      return Promise.resolve({
        data: { results: messages, next: null },
      });
    }
    if (method === "get" && url === "/roles/") {
      return Promise.resolve({
        data: { results: [{ role_type: 100, name: "Project organizer" }] },
      });
    }
    if (method === "post" && url === "/api/chat/chat-1/send_message/") {
      return Promise.resolve({ data: { detail: "Message successfully sent!" } });
    }
    return Promise.reject(new Error("Unexpected api call: " + method + " " + url));
  });
}

function renderDrawer({
  open = true,
  onClose = jest.fn(),
  contextTerm = 'the project "Test Project"',
  contactRole = "Project Creator",
}: {
  open?: boolean;
  onClose?: jest.Mock;
  contextTerm?: string;
  contactRole?: string;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={defaultContextValue as any}>
          <ChatDrawer
            open={open}
            onClose={onClose}
            contactPerson={contactPerson}
            contextTerm={contextTerm}
            contactRole={contactRole}
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
  mockChatApiResponses();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatDrawer", () => {
  describe("opening and partner/context rendering", () => {
    it("starts the chat via the create-or-get call when opened", async () => {
      renderDrawer();
      await waitFor(() => {
        const startCall = mockApiRequest.mock.calls.find(
          (call: any[]) => call[0].url === "/api/start_private_chat/"
        );
        expect(startCall).toBeTruthy();
        expect(startCall![0].method).toBe("post");
        expect(startCall![0].payload.profile_url_slug).toBe("jane-doe");
      });
    });

    it("renders the chatting partner with the caller-provided role and no header context line", async () => {
      renderDrawer();
      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
      expect(screen.getByText("Project Creator")).toBeInTheDocument();
      expect(
        screen.queryByText('This chat is about the project "Test Project".')
      ).not.toBeInTheDocument();
    });

    it("does not show the generic chat membership role", async () => {
      renderDrawer();
      await waitFor(() => expect(screen.getByText("Project Creator")).toBeInTheDocument());
      expect(screen.queryByText("Member")).not.toBeInTheDocument();
    });

    it("renders a context-aware empty conversation text for a new thread", async () => {
      renderDrawer();
      await waitFor(() =>
        expect(
          screen.getByText(
            'This is the very beginning of your conversation about the project "Test Project" with Jane Doe.'
          )
        ).toBeInTheDocument()
      );
    });

    it("renders an existing thread's messages", async () => {
      mockChatApiResponses([
        {
          id: 1,
          content: "Hello there!",
          sender: partner,
          sent_at: new Date("2026-09-01T10:00:00Z"),
        },
      ]);
      renderDrawer();
      await waitFor(() => expect(screen.getByText("Hello there!")).toBeInTheDocument());
    });
  });

  // ── Sending messages ──────────────────────────────────────────────────────

  describe("sending messages", () => {
    it("sends a message through the same chat send path", async () => {
      renderDrawer();
      await waitFor(() => expect(screen.getByPlaceholderText("Message")).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText("Message"), {
        target: { value: "Is the event accessible?" },
      });
      const sendButton = document.querySelector('button[type="submit"]');
      fireEvent.click(sendButton!);

      await waitFor(() => {
        const sendCall = mockApiRequest.mock.calls.find(
          (call: any[]) => call[0].url === "/api/chat/chat-1/send_message/"
        );
        expect(sendCall).toBeTruthy();
        expect(sendCall![0].payload.message_content).toBe("Is the event accessible?");
        expect(sendCall![0].method).toBe("post");
      });
      await waitFor(() => expect(screen.getByText("Is the event accessible?")).toBeInTheDocument());
    });
  });

  // ── Dismissal ─────────────────────────────────────────────────────────────

  describe("dismissal", () => {
    it("calls onClose when the close button is clicked", async () => {
      const onClose = jest.fn();
      renderDrawer({ onClose });
      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: /close chat/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not render anything when closed", () => {
      renderDrawer({ open: false });
      expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe("error handling", () => {
    it("shows an inline error message when the chat cannot be started", async () => {
      mockApiRequest.mockImplementation(({ url }: any) => {
        if (url === "/api/start_private_chat/") return Promise.reject(new Error("boom"));
        return Promise.reject(new Error("Unexpected api call"));
      });
      renderDrawer();
      await waitFor(() =>
        expect(
          screen.getByText("The chat could not be started. Please try again later.")
        ).toBeInTheDocument()
      );
    });
  });
});

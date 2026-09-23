import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

function mockChatApiResponses(messages: any[] = [], opts: { messagesFail?: boolean } = {}) {
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
      if (opts.messagesFail) return Promise.reject(new Error("boom"));
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
    if (method === "get" && url?.startsWith("/api/message/")) {
      return Promise.resolve({
        data: {
          id: 42,
          content: "Incoming socket message",
          sender: partner,
          sent_at: new Date("2026-09-22T09:00:00Z"),
        },
      });
    }
    return Promise.reject(new Error("Unexpected api call: " + method + " " + url));
  });
}

function drawerTree({
  open = true,
  onClose = jest.fn(),
  contextTerm = 'the project "Test Project"',
  contactRole = "Contact person",
  chatSocket = null,
}: {
  open?: boolean;
  onClose?: jest.Mock;
  contextTerm?: string;
  contactRole?: string;
  chatSocket?: any;
} = {}) {
  return (
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={{ ...defaultContextValue, chatSocket } as any}>
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

function renderDrawer(options: Parameters<typeof drawerTree>[0] = {}) {
  return render(drawerTree(options));
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
      expect(screen.getByText("Contact person")).toBeInTheDocument();
      expect(
        screen.queryByText('This chat is about the project "Test Project".')
      ).not.toBeInTheDocument();
    });

    it("does not show the generic chat membership role", async () => {
      renderDrawer();
      await waitFor(() => expect(screen.getByText("Contact person")).toBeInTheDocument());
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

  // ── Reopen / refetch ──────────────────────────────────────────────────────

  describe("refetch on reopen", () => {
    it("refetches the latest messages each time the drawer is opened, without re-starting the chat", async () => {
      mockChatApiResponses([
        {
          id: 1,
          content: "Hello there!",
          sender: partner,
          sent_at: new Date("2026-09-01T10:00:00Z"),
        },
      ]);
      const { rerender } = renderDrawer();
      await waitFor(() => expect(screen.getByText("Hello there!")).toBeInTheDocument());

      mockChatApiResponses([
        {
          id: 1,
          content: "Hello there!",
          sender: partner,
          sent_at: new Date("2026-09-01T10:00:00Z"),
        },
        {
          id: 7,
          content: "Fresh reply",
          sender: partner,
          sent_at: new Date("2026-09-22T11:00:00Z"),
        },
      ]);

      rerender(drawerTree({ open: false }));
      await waitFor(() => expect(screen.queryByText("Hello there!")).not.toBeInTheDocument());
      rerender(drawerTree({ open: true }));

      await waitFor(() => expect(screen.getByText("Fresh reply")).toBeInTheDocument());
      const pageFetches = mockApiRequest.mock.calls.filter((call: any[]) =>
        call[0].url?.includes("/api/messages/")
      );
      expect(pageFetches.length).toBe(2);
      const startCalls = mockApiRequest.mock.calls.filter(
        (call: any[]) => call[0].url === "/api/start_private_chat/"
      );
      expect(startCalls.length).toBe(1);
    });

    it("shows an inline error when the message history cannot be loaded", async () => {
      mockChatApiResponses([], { messagesFail: true });
      renderDrawer();
      await waitFor(() =>
        expect(
          screen.getByText("The messages could not be loaded. Please try again later.")
        ).toBeInTheDocument()
      );
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

    it("shows an inline error when sending fails", async () => {
      renderDrawer();
      await waitFor(() => expect(screen.getByPlaceholderText("Message")).toBeInTheDocument());
      mockApiRequest.mockImplementation(({ method, url }: any) => {
        if (method === "post" && url === "/api/chat/chat-1/send_message/") {
          return Promise.reject({ response: { status: 500, data: {} } });
        }
        return Promise.reject(new Error("Unexpected api call: " + method + " " + url));
      });

      fireEvent.change(screen.getByPlaceholderText("Message"), { target: { value: "Hello" } });
      fireEvent.click(document.querySelector('button[type="submit"]')!);

      await waitFor(() =>
        expect(
          screen.getByText("The message could not be sent. Please try again later.")
        ).toBeInTheDocument()
      );
    });
  });

  // ── Live incoming messages (socket) ───────────────────────────────────────

  describe("live incoming messages", () => {
    it("binds its own socket handler while keeping the app-wide handler chained, and restores it on unmount", async () => {
      const previousOnMessage = jest.fn();
      const chatSocket: any = { onmessage: previousOnMessage, send: jest.fn() };
      const { unmount } = renderDrawer({ chatSocket });
      await waitFor(() => expect(chatSocket.onmessage).not.toBe(previousOnMessage));
      const boundHandler = chatSocket.onmessage;

      const rawEvent = { data: JSON.stringify({ chat_uuid: "chat-1", message_id: 42 }) };
      await act(async () => {
        await boundHandler(rawEvent);
      });
      expect(previousOnMessage).toHaveBeenCalledWith(rawEvent);
      expect(screen.getByText("Incoming socket message")).toBeInTheDocument();

      unmount();
      expect(chatSocket.onmessage).toBe(previousOnMessage);
    });

    it("does not touch the socket before a chat is resolved", async () => {
      const previousOnMessage = jest.fn();
      const chatSocket: any = { onmessage: previousOnMessage, send: jest.fn() };
      renderDrawer({ open: false, chatSocket });
      expect(chatSocket.onmessage).toBe(previousOnMessage);
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

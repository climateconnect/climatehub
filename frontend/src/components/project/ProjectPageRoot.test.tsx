import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import FeedbackContext from "../context/FeedbackContext";
import ROLE_TYPES from "../../../public/data/role_types";
import ProjectPageRoot from "./ProjectPageRoot";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("universal-cookie", () => {
  return jest.fn(() => ({ get: jest.fn(() => "test-token") }));
});

const mockApiRequest = jest.fn();
const mockRedirect = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  redirect: (...args: any[]) => mockRedirect(...args),
}));

const mockRouterPush = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({
    locale: "en",
    query: {},
    asPath: "/projects/test-project",
    push: mockRouterPush,
  }),
}));

// use-long-press ships untranspiled ESM; the long-press bindings only reach the
// stubbed interaction buttons
jest.mock("use-long-press", () => ({
  useLongPress: () => () => ({}),
}));

// Heavy child components are stubbed; the contact trigger is the part under test
jest.mock("./ProjectOverview", () => {
  return {
    __esModule: true,
    default: ({ handleClickContact }: any) => (
      <button onClick={handleClickContact}>Contact creator</button>
    ),
  };
});
jest.mock("./Buttons/ProjectInteractionButtons", () => ({ __esModule: true, default: () => null }));
jest.mock("./ProjectContent", () => ({ __esModule: true, default: () => null }));
jest.mock("./ProjectRegistrationsContent", () => ({ __esModule: true, default: () => null }));
jest.mock("./ProjectTeamContent", () => ({ __esModule: true, default: () => null }));
jest.mock("./ProjectCommentsContent", () => ({ __esModule: true, default: () => null }));
jest.mock("./ProjectSideBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../calendar/ProjectAddToCalendarButton", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../shareContent/ProjectSocialMediaShareButton", () => ({
  __esModule: true,
  ProjectSocialMediaShareButton: () => null,
  default: () => null,
}));
jest.mock("./EventRegistrationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("./CancelRegistrationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("./ViewRegistrationAnswersModal", () => ({ __esModule: true, default: () => null }));

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

const me = { id: 2, url_slug: "me", first_name: "My", last_name: "Self" };

const creator = {
  id: 1,
  url_slug: "jane-doe",
  first_name: "Jane",
  last_name: "Doe",
  name: "Jane Doe",
  thumbnail_image: null,
  permission: ROLE_TYPES.all_type,
  role: { role_type: 100, name: "Project organizer" },
};

function makeProject(overrides: any = {}) {
  return {
    url_slug: "test-project",
    name: "Test Project",
    comments: [],
    team: [creator],
    project_type: { type_id: "project" },
    registration_config: null,
    ...overrides,
  };
}

const userContextValue = {
  locale: "en" as any,
  user: me,
  pathName: "/projects/test-project",
  notifications: [],
  setNotificationsRead: jest.fn(),
  refreshNotifications: jest.fn(),
  isLoading: false,
  ReactGA: undefined,
};

function renderProjectPage({
  project = makeProject(),
  user = me,
  isLoading = false,
}: { project?: any; user?: any; isLoading?: boolean } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={{ ...userContextValue, user, isLoading } as any}>
          <FeedbackContext.Provider value={{ showFeedbackMessage: jest.fn() }}>
            <ProjectPageRoot
              project={project}
              setMessage={jest.fn()}
              isUserFollowing={false}
              isUserLiking={false}
              setCurComments={jest.fn()}
              followingChangePending={false}
              likingChangePending={false}
              projectAdmin={creator}
              numberOfLikes={0}
              numberOfFollowers={0}
              handleLike={jest.fn()}
              handleFollow={jest.fn()}
              similarProjects={[]}
              showSimilarProjects={false}
              handleHideContent={jest.fn()}
              requestedToJoinProject={false}
              handleJoinRequest={jest.fn()}
              hubSupporters={[]}
              hubPage={null}
              siblingProjects={[]}
              isWasseraktionswochenEnabled={false}
              isRegistered={false}
              hasAttended={false}
              adminCancelled={false}
              onMembersRefreshed={jest.fn()}
            />
          </FeedbackContext.Provider>
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

function mockChatApiResponses(messages: any[] = []) {
  mockApiRequest.mockImplementation(({ method, url }: any) => {
    if (method === "post" && url === "/api/start_private_chat/") {
      return Promise.resolve({ data: { chat_uuid: "chat-1", id: 5 } });
    }
    if (method === "get" && url === "/api/chat/chat-1/") {
      return Promise.resolve({
        data: {
          participants: [
            { user_profile: creator, role: { role_type: 100 }, participant_id: 1 },
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
      return Promise.resolve({ data: { results: messages, next: null } });
    }
    if (method === "get" && url === "/roles/") {
      return Promise.resolve({
        data: { results: [{ role_type: 100, name: "Project organizer" }] },
      });
    }
    return Promise.reject(new Error("Unexpected api call: " + method + " " + url));
  });
}

function setWindowUrl(path: string) {
  window.history.replaceState(null, "", path);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockChatApiResponses();
  setWindowUrl("/projects/test-project");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectPageRoot contact chat drawer", () => {
  describe("contact click", () => {
    it("opens the chat drawer instead of navigating to the chat page", async () => {
      renderProjectPage();
      fireEvent.click(screen.getByRole("button", { name: /contact creator/i }));

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
      expect(screen.getByText("Contact person")).toBeInTheDocument();
      expect(mockRouterPush).not.toHaveBeenCalled();
    });

    it("uses event wording and the event owner role for event projects", async () => {
      renderProjectPage({ project: makeProject({ project_type: { type_id: "event" } }) });
      fireEvent.click(screen.getByRole("button", { name: /contact creator/i }));

      await waitFor(() => expect(screen.getByText("Contact person")).toBeInTheDocument());
      await waitFor(() =>
        expect(
          screen.getByText(
            "This is the very beginning of your conversation about the event “Test Project” with Jane Doe."
          )
        ).toBeInTheDocument()
      );
    });
  });

  describe("auto-open deep link", () => {
    it("opens the drawer automatically for a logged-in user", async () => {
      setWindowUrl("/projects/test-project?openContactChat=true");
      renderProjectPage();

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    });

    it("does not open the drawer on a plain visit", async () => {
      renderProjectPage();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
      const startCall = mockApiRequest.mock.calls.find(
        (call: any[]) => call[0].url === "/api/start_private_chat/"
      );
      expect(startCall).toBeUndefined();
    });

    it("redirects a logged-out user to sign-in, preserving the current URL", async () => {
      setWindowUrl("/projects/test-project?openContactChat=true");
      renderProjectPage({ user: null });

      await waitFor(() => expect(mockRedirect).toHaveBeenCalled());
      expect(mockRedirect).toHaveBeenCalledWith(
        "/signin",
        expect.objectContaining({
          redirect: "projects/test-project?openContactChat=true",
          errorMessage: expect.any(String),
        })
      );
    });
  });

  describe("logged-out contact click", () => {
    it("redirects to sign-in with the auto-open flag so the drawer opens after login", async () => {
      renderProjectPage({ user: null });
      fireEvent.click(screen.getByRole("button", { name: /contact creator/i }));

      await waitFor(() => expect(mockRedirect).toHaveBeenCalled());
      expect(mockRedirect).toHaveBeenCalledWith(
        "/signin",
        expect.objectContaining({
          redirect: "projects/test-project?openContactChat=true",
          errorMessage: expect.any(String),
        })
      );
    });

    it("keeps the auto-open flag before the hash when a tab hash is present", async () => {
      setWindowUrl("/projects/test-project#team");
      renderProjectPage({ user: null });
      fireEvent.click(screen.getByRole("button", { name: /contact creator/i }));

      await waitFor(() => expect(mockRedirect).toHaveBeenCalled());
      expect(mockRedirect).toHaveBeenCalledWith(
        "/signin",
        expect.objectContaining({
          redirect: "projects/test-project?openContactChat=true#team",
        })
      );
    });
  });
});

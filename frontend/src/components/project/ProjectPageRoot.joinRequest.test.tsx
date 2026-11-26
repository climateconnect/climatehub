import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import FeedbackContext from "../context/FeedbackContext";
import ROLE_TYPES from "../../../public/data/role_types";
import ProjectPageRoot from "./ProjectPageRoot";

// Tests the POST payload built by `handleSendProjectJoinRequest` in ProjectPageRoot.
// ProjectContent is stubbed with buttons that call the real handler prop, so the
// production handler runs unchanged (issue #2308).

// ---------------------------------------------------------------------------
// Mocks (same set as ProjectPageRoot.test.tsx)
// ---------------------------------------------------------------------------

jest.mock("universal-cookie", () => {
  return jest.fn(() => ({ get: jest.fn(() => "test-token") }));
});

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  redirect: jest.fn(),
}));

jest.mock("next/router", () => ({
  useRouter: () => ({
    locale: "en",
    query: {},
    asPath: "/projects/test-project",
    push: jest.fn(),
  }),
}));

jest.mock("use-long-press", () => ({
  useLongPress: () => () => ({}),
}));

jest.mock("./ProjectOverview", () => ({ __esModule: true, default: () => null }));
jest.mock("./Buttons/ProjectInteractionButtons", () => ({ __esModule: true, default: () => null }));
jest.mock("./ProjectContent", () => ({
  __esModule: true,
  default: ({ handleSendProjectJoinRequest }: any) => (
    <>
      <button onClick={() => handleSendProjectJoinRequest()}>send without message</button>
      <button onClick={() => handleSendProjectJoinRequest("")}>send empty message</button>
      <button onClick={() => handleSendProjectJoinRequest("I <3 climate & Tom &amp; Jerry\nBye")}>
        send typed message
      </button>
    </>
  ),
}));
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

jest.mock("../featureToggle", () => ({
  useFeatureToggles: () => ({
    isEnabled: (_name: string, fallback = false) => fallback,
    isLoading: false,
    toggles: {},
  }),
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

const OLD_DEFAULT_TEXT = "Would like to join the project!";

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

const project = {
  url_slug: "test-project",
  name: "Test Project",
  comments: [],
  team: [creator],
  project_type: { type_id: "project" },
  registration_config: null,
};

const handleJoinRequest = jest.fn();

function renderProjectPage() {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider
        value={
          {
            locale: "en",
            user: me,
            pathName: "/projects/test-project",
            notifications: [],
            setNotificationsRead: jest.fn(),
            refreshNotifications: jest.fn(),
            isLoading: false,
            ReactGA: undefined,
          } as any
        }
      >
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
            handleJoinRequest={handleJoinRequest}
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
    </ThemeProvider>
  );
}

const joinRequestCalls = () =>
  mockApiRequest.mock.calls
    .map((call: any[]) => call[0])
    .filter((arg: any) => arg.url?.includes("/request_membership/"));

beforeEach(() => {
  jest.clearAllMocks();
  mockApiRequest.mockResolvedValue({ data: {} });
  window.history.replaceState(null, "", "/projects/test-project");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectPageRoot join request payload", () => {
  it("posts an empty message and not the old default text when called without a message", async () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole("button", { name: "send without message" }));

    await waitFor(() => expect(joinRequestCalls()).toHaveLength(1));
    const request = joinRequestCalls()[0];
    expect(request.method).toBe("post");
    expect(request.url).toBe("/api/projects/test-project/request_membership/me/");
    expect(request.payload.message).toBe("");
    expect(request.payload.message).not.toBe(OLD_DEFAULT_TEXT);
    expect(JSON.stringify(request.payload)).not.toContain(OLD_DEFAULT_TEXT);
    expect(request.payload.user_availability).toBe("4");
    await waitFor(() => expect(handleJoinRequest).toHaveBeenCalledWith(true));
  });

  it("posts an empty message when the confirmation dialog sends no text", async () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole("button", { name: "send empty message" }));

    await waitFor(() => expect(joinRequestCalls()).toHaveLength(1));
    expect(joinRequestCalls()[0].payload.message).toBe("");
  });

  it("posts the typed message unchanged when a message is given", async () => {
    renderProjectPage();
    fireEvent.click(screen.getByRole("button", { name: "send typed message" }));

    await waitFor(() => expect(joinRequestCalls()).toHaveLength(1));
    expect(joinRequestCalls()[0].payload.message).toBe("I <3 climate & Tom &amp; Jerry\nBye");
    expect(joinRequestCalls()[0].payload.user_availability).toBe("4");
  });
});

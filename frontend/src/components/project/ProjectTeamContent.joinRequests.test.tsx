import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import { useFeatureToggles } from "../featureToggle";
import ProjectTeamContent from "./ProjectTeamContent";
import { getMembershipRequests } from "../../../public/lib/projectOperations";
import ROLE_TYPES from "../../../public/data/role_types";

let mockQuery: any = {};
const mockReplace = jest.fn();
let mockAsPath = "/projects/proj?join_request=9";
jest.mock("next/router", () => ({
  useRouter: () => ({
    query: mockQuery,
    pathname: "/projects/[id]",
    asPath: mockAsPath,
    replace: mockReplace,
  }),
}));
jest.mock("universal-cookie", () => jest.fn().mockImplementation(() => ({ get: () => "token" })));
jest.mock("../featureToggle");
jest.mock("../../../public/lib/projectOperations");
jest.mock("./JoinRequestDetailDialog", () => ({
  __esModule: true,
  default: ({ open, requestId, onClose, onDecided }) =>
    open ? (
      <div>
        dialog-{requestId}
        <button onClick={onClose}>close-dialog</button>
        <button onClick={() => onDecided("approve")}>approve-dialog</button>
      </div>
    ) : null,
}));
jest.mock("../../../public/lib/joinRequestOperations");
jest.mock("./../profile/ProfilePreviews", () => ({ __esModule: true, default: () => null }));

const setToggle = (enabled: boolean) =>
  (useFeatureToggles as jest.Mock).mockReturnValue({
    isEnabled: (n: string, f = false) => (n === "PROJECT_JOIN_REQUEST_CONFIRMATION" ? enabled : f),
    isLoading: false,
    toggles: {},
  });

const project = (permission) => ({
  url_slug: "proj",
  team: [{ id: 1, permission }],
});

const renderTeam = (permission, onMembersRefreshed = jest.fn()) =>
  render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={{ locale: "en", user: { id: 1 } } as any}>
        <ProjectTeamContent
          project={project(permission)}
          handleReadNotifications={jest.fn()}
          onMembersRefreshed={onMembersRefreshed}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );

describe("ProjectTeamContent join requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = {};
    (getMembershipRequests as jest.Mock).mockResolvedValue([
      { id: 5, user_profile: { url_slug: "a", first_name: "Alice", last_name: "A" } },
    ]);
  });

  it("shows the list for admins when the toggle is on", async () => {
    setToggle(true);
    renderTeam(ROLE_TYPES.all_type);
    expect(await screen.findByText("Alice A")).toBeInTheDocument();
  });

  it("hides the list for non-admins", async () => {
    setToggle(true);
    renderTeam(ROLE_TYPES.read_only_type);
    await waitFor(() => expect(screen.queryByText("Alice A")).not.toBeInTheDocument());
    expect(getMembershipRequests).not.toHaveBeenCalled();
  });

  it("hides the list and ignores the param when the toggle is off", () => {
    setToggle(false);
    mockQuery = { join_request: "9" };
    renderTeam(ROLE_TYPES.all_type);
    expect(screen.queryByText("Alice A")).not.toBeInTheDocument();
    expect(screen.queryByText("dialog-9")).not.toBeInTheDocument();
  });

  it("opens the dialog from the join_request param", async () => {
    setToggle(true);
    mockQuery = { join_request: "9" };
    renderTeam(ROLE_TYPES.all_type);
    expect(await screen.findByText("dialog-9")).toBeInTheDocument();
  });

  it("removes the param and keeps the hash when the dialog is closed", async () => {
    setToggle(true);
    mockQuery = { join_request: "9" };
    mockAsPath = "/projects/proj?foo=1&join_request=9";
    window.location.hash = "#team";
    renderTeam(ROLE_TYPES.all_type);
    fireEvent.click(await screen.findByText("close-dialog"));
    expect(mockReplace).toHaveBeenCalledWith("/projects/proj?foo=1#team", undefined, {
      shallow: true,
      scroll: false,
    });
    window.location.hash = "";
  });

  it("reloads the list and refreshes members after an approval", async () => {
    setToggle(true);
    mockQuery = { join_request: "9" };
    const onMembersRefreshed = jest.fn();
    const changed = jest.fn();
    window.addEventListener("join-requests-changed", changed);
    renderTeam(ROLE_TYPES.all_type, onMembersRefreshed);
    fireEvent.click(await screen.findByText("approve-dialog"));
    await waitFor(() => expect(onMembersRefreshed).toHaveBeenCalled());
    expect(getMembershipRequests).toHaveBeenCalledTimes(2);
    expect(changed).toHaveBeenCalled();
    window.removeEventListener("join-requests-changed", changed);
  });
});

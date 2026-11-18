import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../themes/theme";
import { apiRequest } from "../../../public/lib/apiOperations";
import UserContext from "../context/UserContext";
import FeedbackContext from "../context/FeedbackContext";
import { useFeatureToggles } from "../featureToggle";
import ProjectRequestersDialog from "./ProjectRequestersDialog";

jest.mock("../featureToggle");
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock("next/router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockedToggles = useFeatureToggles as jest.MockedFunction<any>;
const mockedApi = apiRequest as jest.MockedFunction<any>;
const setToggle = (enabled: boolean) =>
  mockedToggles.mockReturnValue({
    isEnabled: (name: string, fallback = false) =>
      name === "PROJECT_JOIN_REQUEST_RESPOND_CHAT" ? enabled : fallback,
    isLoading: false,
    toggles: {},
  });

const requesters = (responseChatUuid: string | null) => [
  {
    requestId: 7,
    responseChatUuid,
    user: { url_slug: "req", first_name: "Re", last_name: "Quester", image: null },
  },
];

function renderDialog(responseChatUuid: string | null = null) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={{ locale: "en", user: { url_slug: "me" } } as any}>
        <FeedbackContext.Provider value={{ showFeedbackMessage: jest.fn() } as any}>
          <ProjectRequestersDialog
            loading={false}
            onClose={() => {}}
            open
            project={{ url_slug: "p" }}
            requesters={requesters(responseChatUuid)}
            user={{ url_slug: "me" }}
            user_permission
          />
        </FeedbackContext.Provider>
      </UserContext.Provider>
    </ThemeProvider>
  );
}

describe("ProjectRequestersDialog respond button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setToggle(true);
  });

  it("calls the respond endpoint and opens the chat", async () => {
    mockedApi.mockResolvedValue({ data: { chat_uuid: "abc", created: true } });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Respond" }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/api/projects/p/request_membership/7/respond/" })
      )
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/chat/abc/"))
    );
  });

  it("shows inline error feedback on failure", async () => {
    mockedApi.mockRejectedValue(new Error("fail"));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Respond" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the indicator only when a chat exists", () => {
    const { unmount } = renderDialog(null);
    expect(screen.queryByLabelText("Conversation started")).not.toBeInTheDocument();
    unmount();
    renderDialog("abc");
    expect(screen.getByLabelText("Conversation started")).toBeInTheDocument();
  });

  it("renders no button when the toggle is off", () => {
    setToggle(false);
    renderDialog();
    expect(screen.queryByRole("button", { name: "Respond" })).not.toBeInTheDocument();
  });
});

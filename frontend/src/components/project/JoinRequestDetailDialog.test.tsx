import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import FeedbackContext from "../context/FeedbackContext";
import JoinRequestDetailDialog from "./JoinRequestDetailDialog";
import { decideJoinRequest, getJoinRequest } from "../../../public/lib/joinRequestOperations";

jest.mock("universal-cookie", () => {
  return jest.fn().mockImplementation(() => ({ get: () => "token" }));
});
jest.mock("../../../public/lib/joinRequestOperations");

const mockedGet = getJoinRequest as jest.Mock;
const mockedDecide = decideJoinRequest as jest.Mock;

const profile = (slug: string) => ({
  url_slug: slug,
  first_name: slug,
  last_name: "Doe",
  image: null,
  location: "Berlin",
});

const baseRequest = {
  id: 7,
  user_profile: profile("alice"),
  message: "Hello\n<b>team</b>",
  requested_at: "2026-11-01T10:00:00Z",
  request_status: "pending",
  decided_at: null,
};

function renderDialog(user: any = { id: 1 }, onDecided = jest.fn()) {
  const showFeedbackMessage = jest.fn();
  render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={{ locale: "en", user } as any}>
        <FeedbackContext.Provider value={{ showFeedbackMessage } as any}>
          <JoinRequestDetailDialog
            open
            projectUrlSlug="proj"
            requestId={7}
            onClose={jest.fn()}
            onDecided={onDecided}
          />
        </FeedbackContext.Provider>
      </UserContext.Provider>
    </ThemeProvider>
  );
  return { showFeedbackMessage, onDecided };
}

describe("JoinRequestDetailDialog", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedDecide.mockReset();
  });

  it("renders fields, message as text, and admin actions for a pending request", async () => {
    mockedGet.mockResolvedValue({ ...baseRequest, decided_by: null });
    renderDialog();
    expect(await screen.findByText(/alice Doe/)).toBeInTheDocument();
    expect(screen.getByText("Berlin")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(/<b>team<\/b>/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("approves, reloads, and notifies the parent", async () => {
    mockedGet.mockResolvedValueOnce({ ...baseRequest, decided_by: null }).mockResolvedValueOnce({
      ...baseRequest,
      request_status: "approved",
      decided_at: "2026-11-02T10:00:00Z",
      decided_by: profile("boss"),
    });
    mockedDecide.mockResolvedValue({});
    const { onDecided } = renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(mockedDecide).toHaveBeenCalledWith("proj", 7, "approve", "en", "token")
    );
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith("approve"));
    expect(await screen.findByText(/Approved by/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("declines with the reject endpoint", async () => {
    mockedGet.mockResolvedValue({ ...baseRequest, decided_by: null });
    mockedDecide.mockResolvedValue({});
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    await waitFor(() =>
      expect(mockedDecide).toHaveBeenCalledWith("proj", 7, "reject", "en", "token")
    );
  });

  it("shows no actions and no decider to the requester", async () => {
    mockedGet.mockResolvedValue({
      ...baseRequest,
      request_status: "approved",
      decided_at: "2026-11-02T10:00:00Z",
    });
    renderDialog();
    expect(await screen.findByText(/Approved/)).toBeInTheDocument();
    expect(screen.queryByText(/Approved by/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("shows no message placeholder when empty", async () => {
    mockedGet.mockResolvedValue({ ...baseRequest, message: "", decided_by: null });
    renderDialog();
    expect(await screen.findByText("No message")).toBeInTheDocument();
  });

  it.each([
    [404, "This join request could not be found."],
    [403, "You don't have permission to view this join request."],
  ])("shows an error state for %s", async (status, text) => {
    mockedGet.mockRejectedValue({ response: { status } });
    renderDialog();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("prompts to log in when logged out and does not fetch", () => {
    renderDialog(null);
    expect(screen.getByText("Please log in to view this join request.")).toBeInTheDocument();
    expect(mockedGet).not.toHaveBeenCalled();
  });
});

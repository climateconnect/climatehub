import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import LeaveOrganizationButton from "./LeaveOrganizationButton";
import { apiRequest } from "../../../public/lib/apiOperations";

jest.mock("../../../public/lib/apiOperations", () => ({ apiRequest: jest.fn() }));
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  useMediaQuery: () => false,
}));

const texts = {
  leave_team: "Leave team",
  do_you_really_want_to_leave_this_organization: "Really leave?",
  are_you_sure_that_you_want_to_leave_this_organization: "Sure?",
  you_cant_leave_an_organization_as_the_super_admin: "Hand over first",
  you_are_the_last_member_delete_organization_instead: "Delete instead",
  could_not_leave_the_organization: "Failed",
  yes: "Yes",
  no: "No",
};

function setup(props: Record<string, any> = {}) {
  const onLeft = jest.fn();
  const onError = jest.fn();
  render(
    <ThemeProvider theme={theme}>
      <LeaveOrganizationButton
        organizationUrlSlug="my-org"
        isSuperAdmin={false}
        memberCount={3}
        token="t"
        locale="en"
        texts={texts}
        onLeft={onLeft}
        onError={onError}
        {...props}
      />
    </ThemeProvider>
  );
  return { onLeft, onError };
}

describe("LeaveOrganizationButton", () => {
  beforeEach(() => (apiRequest as jest.Mock).mockReset());

  it("posts to the leave endpoint after confirming", async () => {
    (apiRequest as jest.Mock).mockResolvedValue({ status: 200 });
    const { onLeft } = setup();
    fireEvent.click(screen.getByText("Leave team"));
    fireEvent.click(screen.getByText("Yes"));
    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    expect(apiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: "post", url: "/api/organizations/my-org/leave/" })
    );
  });

  it("does not send a request when cancelled", () => {
    setup();
    fireEvent.click(screen.getByText("Leave team"));
    fireEvent.click(screen.getByText("No"));
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("shows an error and no dialog for a Super-Admin", () => {
    const { onError } = setup({ isSuperAdmin: true });
    fireEvent.click(screen.getByText("Leave team"));
    expect(onError).toHaveBeenCalledWith("Hand over first");
    expect(screen.queryByText("Really leave?")).not.toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("shows an error when the API fails", async () => {
    (apiRequest as jest.Mock).mockRejectedValue({ response: { status: 500 } });
    const { onLeft, onError } = setup();
    fireEvent.click(screen.getByText("Leave team"));
    fireEvent.click(screen.getByText("Yes"));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Failed"));
    expect(onLeft).not.toHaveBeenCalled();
  });
});

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";

import theme from "../../../themes/theme";
import UserContext from "../../context/UserContext";
import { useFeatureToggles } from "../../featureToggle";
import JoinButton from "./JoinButton";

jest.mock("../../featureToggle");
const mockedUseFeatureToggles = useFeatureToggles as jest.MockedFunction<any>;

const setToggle = (enabled: boolean) =>
  mockedUseFeatureToggles.mockReturnValue({
    isEnabled: (name: string, fallback = false) =>
      name === "PROJECT_JOIN_REQUEST_CONFIRMATION" ? enabled : fallback,
    isLoading: false,
    toggles: {},
  });

function renderButton(handler: jest.Mock, user: any = { url_slug: "me" }) {
  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={{ locale: "en", user } as any}>
          <JoinButton handleSendProjectJoinRequest={handler} requestedToJoin={false} />
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

const openDialog = () => fireEvent.click(screen.getByRole("button", { name: /join/i }));

describe("JoinButton with confirmation toggle on", () => {
  beforeEach(() => setToggle(true));

  it("opens the dialog on click and sends nothing", () => {
    const handler = jest.fn();
    renderButton(handler);
    openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(handler).not.toHaveBeenCalled();
  });

  it("Cancel sends nothing and discards the draft", async () => {
    const handler = jest.fn();
    renderButton(handler);
    openDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(handler).not.toHaveBeenCalled();
    openDialog();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("sends the trimmed plain-text message and closes on success", async () => {
    const handler = jest.fn().mockResolvedValue(true);
    renderButton(handler);
    openDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  <b>Hi</b> I <3 it  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send join request" }));
    await waitFor(() => expect(handler).toHaveBeenCalledWith("Hi I <3 it"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sends an empty string when no message was entered", async () => {
    const handler = jest.fn().mockResolvedValue(true);
    renderButton(handler);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Send join request" }));
    await waitFor(() => expect(handler).toHaveBeenCalledWith(""));
  });

  it("truncates pasted text to 500 characters and shows the counter", () => {
    renderButton(jest.fn());
    openDialog();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a".repeat(600) } });
    expect(screen.getByText("500 / 500")).toBeInTheDocument();
  });

  it("disables the buttons while sending", async () => {
    let resolve: (_v: boolean) => void = () => {};
    const handler = jest.fn().mockReturnValue(new Promise<boolean>((r) => (resolve = r)));
    renderButton(handler);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Send join request" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send join request" })).toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Send join request" }));
    expect(handler).toHaveBeenCalledTimes(1);
    resolve(true);
  });

  it("keeps the dialog open on error", async () => {
    const handler = jest.fn().mockResolvedValue(false);
    renderButton(handler);
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Send join request" }));
    await waitFor(() => expect(handler).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send join request" })).toBeEnabled()
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps legacy behaviour for logged-out users", () => {
    const handler = jest.fn();
    renderButton(handler, null);
    openDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(handler).toHaveBeenCalledWith();
  });
});

describe("JoinButton with confirmation toggle off", () => {
  it("sends immediately without a dialog", () => {
    setToggle(false);
    const handler = jest.fn();
    renderButton(handler);
    openDialog();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(handler).toHaveBeenCalledWith();
  });
});

describe("JoinButton when already requested", () => {
  it("does not open the dialog or send on click", () => {
    setToggle(true);
    const handler = jest.fn();
    render(
      <ThemeProvider theme={theme}>
        <StylesThemeProvider theme={theme}>
          <UserContext.Provider value={{ locale: "en", user: { url_slug: "me" } } as any}>
            <JoinButton
              handleSendProjectJoinRequest={handler}
              requestedToJoin
              screenSize={{ belowSmall: true }}
            />
          </UserContext.Provider>
        </StylesThemeProvider>
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole("button").parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(handler).not.toHaveBeenCalled();
  });
});

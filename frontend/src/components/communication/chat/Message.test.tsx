import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../../themes/theme";
import UserContext from "../../context/UserContext";
import Message from "./Message";

jest.mock("universal-cookie", () => jest.fn(() => ({ get: jest.fn(() => "test-token") })));

const mockApiRequest = jest.fn();
jest.mock("../../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

const classes = {};
const me = { url_slug: "me" };
const sender = { url_slug: "other", first_name: "Other", last_name: "Person" };

const renderMessage = (message: any, locale = "en") =>
  render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={{ user: me, locale } as any}>
          <Message
            message={{ content: "Hi", sender, sent_at: new Date(), ...message }}
            classes={classes}
            isPrivateChat={true}
          />
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );

// ids are unique per test because the origin context cache is module-level
let nextId = 1000;
const projectOrigin = (type: string, name = "Solar Roofs") => {
  const id = nextId++;
  mockApiRequest.mockResolvedValue({
    data: { project_name: name, project_url_slug: "solar-roofs", project_type: type },
  });
  return { origin_type: "project", origin_id: id };
};

beforeEach(() => jest.clearAllMocks());

describe("Message project origin chip", () => {
  it.each([
    ["PR", "This message is about the project"],
    ["ID", "This message is about the idea"],
    ["EV", "This message is about the event"],
  ])("renders the %s wording", async (type, expected) => {
    renderMessage(projectOrigin(type));
    await waitFor(() => expect(screen.getByText("Solar Roofs")).toBeInTheDocument());
    expect(screen.getByText(/This message is about the/).textContent).toContain(expected);
    expect(screen.getByRole("link", { name: "Solar Roofs" })).toHaveAttribute(
      "href",
      "/projects/solar-roofs"
    );
  });

  it("renders German wording", async () => {
    renderMessage(projectOrigin("EV"), "de");
    await waitFor(() => expect(screen.getByText("Solar Roofs")).toBeInTheDocument());
    expect(screen.getByText(/Diese Nachricht betrifft die Veranstaltung/)).toBeInTheDocument();
  });

  it("renders no chip when resolving fails", async () => {
    const origin = { origin_type: "project", origin_id: nextId++ };
    mockApiRequest.mockRejectedValue({ response: { status: 404 } });
    jest.spyOn(console, "warn").mockImplementation(() => {});
    renderMessage(origin);
    await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
    expect(screen.queryByText(/This message is about/)).not.toBeInTheDocument();
  });

  it("keeps the event registration chip", async () => {
    mockApiRequest.mockResolvedValue({
      data: { event_name: "Hitzefrei", event_url_slug: "hitzefrei" },
    });
    renderMessage({ origin_type: "event_registration", origin_id: nextId++ });
    await waitFor(() => expect(screen.getByText("Hitzefrei")).toBeInTheDocument());
    expect(screen.getByText(/This message is about the registration for/)).toBeInTheDocument();
  });
});

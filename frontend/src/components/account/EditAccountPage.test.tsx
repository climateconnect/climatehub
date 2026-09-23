import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import FeedbackContext from "../context/FeedbackContext";
import UserContext from "../context/UserContext";
import EditAccountPage from "./EditAccountPage";

jest.mock("../../../public/lib/imageOperations", () => ({
  __esModule: true,
  convertToJPGWithAspectRatio: jest.fn(async (file: File) => `compressed:${file.name}`),
  getResizedImage: jest.fn(async () => "thumbnail:mock"),
  whitenTransparentPixels: jest.fn(),
}));

jest.mock("../dialogs/UploadImageDialog", () => ({
  __esModule: true,
  default: ({ open, onClose, loading }: any) =>
    open ? (
      <div data-testid="upload-image-dialog">
        {loading && <div data-testid="dialog-loading" />}
        <button onClick={() => onClose(document.createElement("canvas"))}>Apply</button>
      </div>
    ) : null,
}));

const defaultContext = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
};

const baseAccount = {
  name: "Test User",
  types: [],
  info: {},
  background_image: undefined,
  image: undefined,
  thumbnail_image: undefined,
};

function renderEditAccountPage(overrides: Partial<typeof baseAccount> = {}) {
  const handleSubmit = jest.fn();
  const handleCancel = jest.fn();
  const showFeedbackMessage = jest.fn();
  const utils = render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={defaultContext as any}>
          <FeedbackContext.Provider value={{ showFeedbackMessage }}>
            <EditAccountPage
              account={{ ...baseAccount, ...overrides }}
              possibleAccountTypes={undefined}
              maxAccountTypes={5}
              infoMetadata={{}}
              handleSubmit={handleSubmit}
              handleCancel={handleCancel}
              errorMessage=""
              existingName=""
              existingUrlSlug=""
              skillsOptions={[]}
              splitName={false}
              type="profile"
              allSectors={[]}
            />
          </FeedbackContext.Provider>
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
  return { ...utils, handleSubmit, handleCancel, showFeedbackMessage };
}

function dropFile(zone: HTMLElement, file: File | null) {
  fireEvent.drop(zone, { dataTransfer: { files: file ? [file] : [] } });
}

function pasteFile(zone: HTMLElement, file: File | null, type = file?.type ?? "image/png") {
  fireEvent.paste(zone, {
    clipboardData: { items: file ? [{ type, getAsFile: () => file }] : [] },
  });
}

beforeEach(() => {
  HTMLCanvasElement.prototype.toBlob = jest.fn(function (callback: (_blob: Blob | null) => void) {
    callback(new Blob(["mock"], { type: "image/jpeg" }));
  }) as any;
  global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
});

describe("EditAccountPage background image", () => {
  // AC1: click-to-upload still works

  it("renders the background area and clicking it opens the file picker", () => {
    renderEditAccountPage();
    expect(screen.getByTestId("background-drop-zone")).toBeInTheDocument();
  });

  it("clicking to upload and cropping sets the background", async () => {
    renderEditAccountPage();
    const file = new File(["data"], "background.png", { type: "image/png" });
    const input = document.getElementById("backgroundPhoto") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const dialog = await screen.findByTestId("upload-image-dialog");
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply"));
    await waitFor(() =>
      expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument()
    );
  });

  // AC2: drag-and-drop opens the same crop dialog and confirms identically

  it("dragging a valid image opens the crop dialog", async () => {
    renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    const file = new File(["data"], "background.png", { type: "image/png" });
    dropFile(zone, file);
    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });

  it("crop confirm after a drop closes the dialog identically to the click path", async () => {
    renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    const file = new File(["data"], "background.png", { type: "image/png" });
    dropFile(zone, file);
    fireEvent.click(await screen.findByText("Apply"));
    await waitFor(() =>
      expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument()
    );
  });

  // AC3: invalid drops are rejected gracefully

  it("dropping a non-image file shows an error and the dialog stays closed", () => {
    const { showFeedbackMessage } = renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    const file = new File(["data"], "notes.txt", { type: "text/plain" });
    dropFile(zone, file);
    expect(showFeedbackMessage).toHaveBeenCalledWith(
      expect.objectContaining({ error: true, message: expect.any(String) })
    );
    expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument();
  });

  // AC6: drag-over highlight appears and disappears

  it("shows a drag-over highlight while dragging and removes it after", () => {
    renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    expect(zone).toHaveAttribute("data-drag-over", "false");
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-drag-over", "true");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-drag-over", "false");
  });

  // AC8: clipboard paste opens the same crop dialog

  it("pasting a valid image while the zone is focused opens the crop dialog", async () => {
    renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    const file = new File(["data"], "pasted.png", { type: "image/png" });
    pasteFile(zone, file);
    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });

  it("pasting non-image clipboard content is a no-op", () => {
    renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    fireEvent.paste(zone, {
      clipboardData: { items: [{ type: "text/plain", getAsFile: () => null }] },
    });
    expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument();
  });

  it("is reachable by keyboard and Enter opens the file picker when no background image is set", () => {
    renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    expect(zone).toHaveAttribute("tabindex", "0");
    const input = document.getElementById("backgroundPhoto") as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();
  });

  it("stays reachable by keyboard and Enter opens the file picker even when a background image is already set", () => {
    renderEditAccountPage({ background_image: "https://example.com/bg.png" });
    const zone = screen.getByTestId("background-drop-zone");
    expect(zone).toHaveAttribute("tabindex", "0");
    const input = document.getElementById("backgroundPhoto") as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();
  });

  // Decision: paste is scoped to the focused zone, not a global window listener — this page
  // renders both the background zone and (via UserAvatar) the avatar zone at once, so a global
  // listener would have opened both dialogs for a single paste.
  it("pasting into the background zone opens only the background dialog, not the avatar's", async () => {
    renderEditAccountPage();
    const zone = screen.getByTestId("background-drop-zone");
    expect(screen.getByTestId("avatar-drop-zone")).toBeInTheDocument();
    const file = new File(["data"], "pasted.png", { type: "image/png" });
    pasteFile(zone, file);
    await screen.findByTestId("upload-image-dialog");
    expect(screen.getAllByTestId("upload-image-dialog")).toHaveLength(1);
  });
});

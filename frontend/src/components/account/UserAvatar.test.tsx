import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import { UserAvatar } from "./UserAvatar";

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

function renderUserAvatar(props: Partial<React.ComponentProps<typeof UserAvatar>> = {}) {
  const onAvatarChanged = jest.fn();
  const utils = render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContext as any}>
        <UserAvatar mode="edit" onAvatarChanged={onAvatarChanged} {...props} />
      </UserContext.Provider>
    </ThemeProvider>
  );
  return { ...utils, onAvatarChanged };
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

describe("UserAvatar", () => {
  // AC1: click-to-upload still works

  it("renders the avatar in edit mode with a click target to open the dialog", () => {
    renderUserAvatar();
    expect(screen.getByTestId("avatar-drop-zone")).toBeInTheDocument();
  });

  it("clicking to upload and cropping sets the avatar", async () => {
    const { onAvatarChanged } = renderUserAvatar();
    const file = new File(["data"], "avatar.png", { type: "image/png" });
    const input = document.getElementById("avatarPhoto") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply"));
    await waitFor(() =>
      expect(onAvatarChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: expect.any(String),
          thumbnailImageUrl: expect.any(String),
        })
      )
    );
  });

  // AC2: drag-and-drop opens the same crop dialog and confirms identically

  it("dragging a valid image opens the crop dialog", async () => {
    renderUserAvatar();
    const zone = screen.getByTestId("avatar-drop-zone");
    const file = new File(["data"], "avatar.png", { type: "image/png" });
    dropFile(zone, file);
    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });

  it("crop confirm after a drop sets the avatar identically to the click path", async () => {
    const { onAvatarChanged } = renderUserAvatar();
    const zone = screen.getByTestId("avatar-drop-zone");
    const file = new File(["data"], "avatar.png", { type: "image/png" });
    dropFile(zone, file);
    fireEvent.click(await screen.findByText("Apply"));
    await waitFor(() =>
      expect(onAvatarChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: expect.any(String),
          thumbnailImageUrl: expect.any(String),
        })
      )
    );
  });

  // AC3: invalid drops are rejected gracefully

  it("dropping a non-image file shows an error", () => {
    window.alert = jest.fn();
    renderUserAvatar();
    const zone = screen.getByTestId("avatar-drop-zone");
    const file = new File(["data"], "notes.txt", { type: "text/plain" });
    dropFile(zone, file);
    expect(window.alert).toHaveBeenCalled();
    expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument();
  });

  // AC6: drag-over highlight appears and disappears

  it("shows a drag-over highlight while dragging and removes it after", () => {
    renderUserAvatar();
    const zone = screen.getByTestId("avatar-drop-zone");
    expect(zone).toHaveAttribute("data-drag-over", "false");
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-drag-over", "true");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-drag-over", "false");
  });

  // AC8: clipboard paste opens the same crop dialog

  it("pasting a valid image while the zone is focused opens the crop dialog", async () => {
    renderUserAvatar();
    const zone = screen.getByTestId("avatar-drop-zone");
    const file = new File(["data"], "pasted.png", { type: "image/png" });
    pasteFile(zone, file);
    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });

  it("is reachable by keyboard and Enter opens the file picker", () => {
    renderUserAvatar();
    const zone = screen.getByTestId("avatar-drop-zone");
    expect(zone).toHaveAttribute("tabindex", "0");
    const input = document.getElementById("avatarPhoto") as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");
    fireEvent.keyDown(zone, { key: "Enter" });
    expect(clickSpy).toHaveBeenCalled();
  });
});

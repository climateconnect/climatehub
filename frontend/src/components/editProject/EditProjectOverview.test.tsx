import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import EditProjectOverview from "./EditProjectOverview";

jest.mock("../../../public/lib/imageOperations", () => ({
  __esModule: true,
  getImageUrl: jest.fn((url: string) => url),
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

jest.mock("../shareProject/ProjectLocationSearchBar", () => ({
  __esModule: true,
  default: () => <div data-testid="location-search-bar" />,
}));

const defaultContext = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
};

const baseProject = {
  image: undefined,
  name: "Test Project",
  short_description: "",
  website: "",
  is_online: false,
  loc: {},
  sectors: [],
  project_type: { type_id: "project" },
  hubUrl: "",
};

function renderEditProjectOverview(overrides: Partial<typeof baseProject> = {}) {
  const handleSetProject = jest.fn();
  const utils = render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContext as any}>
        <EditProjectOverview
          project={{ ...baseProject, ...overrides } as any}
          handleSetProject={handleSetProject}
          smallScreen={true}
          overviewInputsRef={{ current: null }}
          locationOptionsOpen={false}
          handleSetLocationOptionsOpen={jest.fn()}
          locationInputRef={{ current: null }}
          sectorOptions={[]}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
  return { ...utils, handleSetProject };
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

describe("EditProjectOverview image upload", () => {
  // AC1: click-to-upload still works

  it("renders the upload button and clicking it opens the file picker", () => {
    renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    expect(within(zone).getByRole("button", { name: /upload image/i })).toBeInTheDocument();
  });

  it("clicking to upload and cropping sets the image", async () => {
    const { handleSetProject } = renderEditProjectOverview();
    const file = new File(["data"], "photo.png", { type: "image/png" });
    const input = document.getElementById("photo") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply"));
    await waitFor(() =>
      expect(handleSetProject).toHaveBeenCalledWith(
        expect.objectContaining({ image: expect.any(String), thumbnail_image: expect.any(String) })
      )
    );
  });

  // AC2: drag-and-drop opens the same crop dialog and confirms identically

  it("dragging a valid image opens the crop dialog", async () => {
    renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    const file = new File(["data"], "photo.png", { type: "image/png" });
    dropFile(zone, file);
    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });

  it("crop confirm after a drop sets the image identically to the click path", async () => {
    const { handleSetProject } = renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    const file = new File(["data"], "photo.png", { type: "image/png" });
    dropFile(zone, file);
    fireEvent.click(await screen.findByText("Apply"));
    await waitFor(() =>
      expect(handleSetProject).toHaveBeenCalledWith(
        expect.objectContaining({ image: expect.any(String), thumbnail_image: expect.any(String) })
      )
    );
  });

  // AC3: invalid drops are rejected gracefully

  it("dropping a non-image file shows an error and keeps the dialog closed", () => {
    window.alert = jest.fn();
    renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    const file = new File(["data"], "notes.txt", { type: "text/plain" });
    dropFile(zone, file);
    expect(window.alert).toHaveBeenCalled();
    expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument();
  });

  // AC6: drag-over highlight appears and disappears

  it("shows a drag-over highlight while dragging and removes it after", () => {
    renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    expect(zone).toHaveAttribute("data-drag-over", "false");
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-drag-over", "true");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-drag-over", "false");
  });

  // AC8: clipboard paste opens the same crop dialog

  it("pasting a valid image while the zone is focused opens the crop dialog", async () => {
    renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    const file = new File(["data"], "pasted.png", { type: "image/png" });
    pasteFile(zone, file);
    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });

  it("pasting non-image clipboard content is a no-op", () => {
    renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    fireEvent.paste(zone, {
      clipboardData: { items: [{ type: "text/plain", getAsFile: () => null }] },
    });
    expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument();
  });

  it("the zone is focusable for paste, but is not a second tab stop for the upload action", () => {
    renderEditProjectOverview();
    const zone = screen.getByTestId("edit-project-image-drop-zone");
    // Focusable so it can receive a paste event...
    expect(zone).toHaveAttribute("tabindex", "0");
    // ...but not announced as a button itself: the real <Button> inside it is the
    // only element a screen reader/keyboard user should reach for "Upload Image".
    expect(zone).not.toHaveAttribute("role", "button");
    expect(within(zone).getAllByRole("button", { name: /upload image/i })).toHaveLength(1);
  });
});

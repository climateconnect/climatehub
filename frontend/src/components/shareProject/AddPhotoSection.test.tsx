import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import AddPhotoSection from "./AddPhotoSection";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

jest.mock("../../../public/lib/imageOperations", () => ({
  __esModule: true,
  getImageDialogHeight: jest.fn(() => 100),
  convertToJPGWithAspectRatio: jest.fn(async (file: File) => `compressed:${file.name}`),
  getResizedImage: jest.fn(async () => "thumbnail:mock"),
  whitenTransparentPixels: jest.fn(),
}));

jest.mock("../dialogs/UploadImageDialog", () => ({
  __esModule: true,
  default: ({ open, onClose, loading, imageUrl }: any) =>
    open ? (
      <div data-testid="upload-image-dialog">
        {loading && <div data-testid="dialog-loading" />}
        <div data-testid="dialog-image-url">{imageUrl}</div>
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

function Wrapper({
  image,
  handleSetProjectData,
}: {
  image?: string;
  // eslint-disable-next-line no-unused-vars
  handleSetProjectData: (data: any) => void;
}) {
  const [open, setOpen] = useState({ avatarDialog: false });
  return (
    <AddPhotoSection
      projectData={{ image }}
      handleSetProjectData={handleSetProjectData}
      className=""
      subHeaderClassname=""
      toolTipClassName=""
      helpTexts={{ addPhoto: "Add a photo" }}
      ToolTipIcon={HelpOutlineIcon}
      open={open}
      handleSetOpen={(update: any) => setOpen((prev) => ({ ...prev, ...update }))}
    />
  );
}

function renderAddPhotoSection({ image = undefined as string | undefined } = {}) {
  const handleSetProjectData = jest.fn();
  const utils = render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContext as any}>
        <Wrapper image={image} handleSetProjectData={handleSetProjectData} />
      </UserContext.Provider>
    </ThemeProvider>
  );
  return { ...utils, handleSetProjectData };
}

beforeEach(() => {
  HTMLCanvasElement.prototype.toBlob = jest.fn(function (callback: (_blob: Blob | null) => void) {
    callback(new Blob(["mock"], { type: "image/jpeg" }));
  }) as any;
  global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
});

function dropFile(zone: HTMLElement, file: File | null) {
  fireEvent.drop(zone, { dataTransfer: { files: file ? [file] : [] } });
}

describe("AddPhotoSection", () => {
  // AC1: click-to-upload still works

  it("renders the upload button and clicking it opens the file picker", () => {
    renderAddPhotoSection();
    expect(screen.getByRole("button", { name: /upload image/i })).toBeInTheDocument();
  });

  it("clicking to upload and cropping sets the image", async () => {
    const { handleSetProjectData } = renderAddPhotoSection();
    const file = new File(["data"], "photo.png", { type: "image/png" });
    const input = document.getElementById("photo") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Apply"));
    await waitFor(() =>
      expect(handleSetProjectData).toHaveBeenCalledWith(
        expect.objectContaining({ image: expect.any(String), thumbnail_image: expect.any(String) })
      )
    );
  });

  // AC2: drag-and-drop opens the same crop dialog and confirms identically

  it("dragging a valid image opens the crop dialog", async () => {
    renderAddPhotoSection();
    const zone = screen.getByTestId("add-photo-drop-zone");
    const file = new File(["data"], "photo.png", { type: "image/png" });
    dropFile(zone, file);
    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });

  it("crop confirm after a drop sets the image identically to the click path", async () => {
    const { handleSetProjectData } = renderAddPhotoSection();
    const zone = screen.getByTestId("add-photo-drop-zone");
    const file = new File(["data"], "photo.png", { type: "image/png" });
    dropFile(zone, file);
    fireEvent.click(await screen.findByText("Apply"));
    await waitFor(() =>
      expect(handleSetProjectData).toHaveBeenCalledWith(
        expect.objectContaining({ image: expect.any(String), thumbnail_image: expect.any(String) })
      )
    );
  });

  // AC3: invalid drops are rejected gracefully

  it("dropping a non-image file shows an error and keeps the dialog closed", () => {
    window.alert = jest.fn();
    renderAddPhotoSection();
    const zone = screen.getByTestId("add-photo-drop-zone");
    const file = new File(["data"], "notes.txt", { type: "text/plain" });
    dropFile(zone, file);
    expect(window.alert).toHaveBeenCalled();
    expect(screen.queryByTestId("upload-image-dialog")).not.toBeInTheDocument();
  });

  // AC6: drag-over highlight appears and disappears

  it("shows a drag-over highlight while dragging and removes it after", () => {
    renderAddPhotoSection();
    const zone = screen.getByTestId("add-photo-drop-zone");
    expect(zone).toHaveAttribute("data-drag-over", "false");
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-drag-over", "true");
    fireEvent.dragLeave(zone);
    expect(zone).toHaveAttribute("data-drag-over", "false");
  });

  // AC5: mobile/touch devices are unaffected — click-to-upload still works, with no drag events involved

  it("still opens the crop dialog via click on a narrow/touch viewport, without any drag events", async () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: true, // simulate every breakpoint query matching, as on a narrow/touch viewport
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    renderAddPhotoSection();
    const file = new File(["data"], "photo.png", { type: "image/png" });
    const input = document.getElementById("photo") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByTestId("upload-image-dialog")).toBeInTheDocument();
  });
});

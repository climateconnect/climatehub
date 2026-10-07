import { convertToJPGWithAspectRatio } from "./imageOperations";

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 1600;
  height = 900;
  private _src = "";

  static shouldFail = false;

  set src(value: string) {
    this._src = value;
    if (MockImage.shouldFail) {
      this.onerror?.();
    } else {
      this.onload?.();
    }
  }

  get src() {
    return this._src;
  }
}

describe("convertToJPGWithAspectRatio", () => {
  beforeEach(() => {
    MockImage.shouldFail = false;
    (global as any).Image = MockImage;
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      fillStyle: "",
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    })) as any;
    HTMLCanvasElement.prototype.toBlob = jest.fn(function (callback: (_blob: Blob | null) => void) {
      callback(new Blob(["mock"], { type: "image/jpeg" }));
    }) as any;
  });

  it("resolves with an object URL for a valid image", async () => {
    const file = new File(["data"], "photo.png", { type: "image/png" });
    const result = await convertToJPGWithAspectRatio(file);
    expect(result).toBe("blob:mock-url");
  });

  it("rejects instead of hanging when the image is corrupt or truncated", async () => {
    MockImage.shouldFail = true;
    const file = new File(["not really an image"], "corrupt.png", { type: "image/png" });
    await expect(convertToJPGWithAspectRatio(file)).rejects.toThrow(/corrupt|truncated/i);
  });
});

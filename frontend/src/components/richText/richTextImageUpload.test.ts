import axios from "axios";
import {
  RICH_TEXT_IMAGE_MAX_FILE_SIZE,
  RichTextImageUploadError,
  checkRichTextImageFile,
  uploadRichTextImage,
} from "./richTextImageUpload";

function file(type: string, size = 1000) {
  const f = new File(["x"], "image", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

function axiosError(status: number, data: object) {
  return new axios.AxiosError("failed", "ERR", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as any,
  });
}

describe("checkRichTextImageFile", () => {
  it("accepts JPEG, PNG and WebP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(checkRichTextImageFile(file(type))).toBeNull();
    }
  });

  it("rejects other types and files over 20 MB", () => {
    expect(checkRichTextImageFile(file("image/gif"))).toBe("unsupported_type");
    expect(checkRichTextImageFile(file("image/svg+xml"))).toBe("unsupported_type");
    expect(checkRichTextImageFile(file("image/jpeg", RICH_TEXT_IMAGE_MAX_FILE_SIZE + 1))).toBe(
      "file_too_large"
    );
  });
});

describe("uploadRichTextImage", () => {
  afterEach(() => jest.restoreAllMocks());

  const upload = () => uploadRichTextImage(file("image/jpeg"), { token: "t", locale: "en" });

  it("sends the file as multipart form data with the token", async () => {
    const post = jest
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { id: 1, width: 1, height: 1, variants: [] } });
    await upload();
    const [url, body, config] = post.mock.calls[0] as any[];
    expect(url).toMatch(/\/api\/rich-text-images\/$/);
    expect(body).toBeInstanceOf(FormData);
    expect(config.headers.Authorization).toBe("Token t");
    expect(config.headers["Content-Type"]).toBeUndefined();
  });

  it.each([
    [400, { code: "too_many_pixels" }, "too_many_pixels"],
    [400, { code: "something_new" }, "generic"],
    [429, {}, "too_many_requests"],
    [500, {}, "generic"],
  ])("maps HTTP %s %j to %s", async (status, data, expected) => {
    jest.spyOn(axios, "post").mockRejectedValue(axiosError(status, data));
    await expect(upload()).rejects.toEqual(new RichTextImageUploadError(expected as any));
    await upload().catch((error) => expect(error.code).toBe(expected));
  });
});

import axios from "axios";
import type { CcLocale } from "../../types";
import { getLocaleHeader } from "../../utils/locationUtils";

export const RICH_TEXT_IMAGE_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const RICH_TEXT_IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const RICH_TEXT_IMAGE_MAX_COUNT = 10;
export const RICH_TEXT_IMAGE_MAX_ALT_LENGTH = 150;

export type RichTextImageVariant = { url: string; width: number; height: number };

export type UploadedRichTextImage = {
  id: number;
  width: number;
  height: number;
  variants: RichTextImageVariant[];
};

// Error codes of POST /api/rich-text-images/, plus client-side ones.
export type RichTextImageErrorCode =
  | "unsupported_type"
  | "file_too_large"
  | "too_many_pixels"
  | "unreadable_image"
  | "too_many_requests"
  | "generic";

export class RichTextImageUploadError extends Error {
  code: RichTextImageErrorCode;

  constructor(code: RichTextImageErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Checks done before uploading, so the user doesn't wait for an upload that will fail. */
export function checkRichTextImageFile(file: File): RichTextImageErrorCode | null {
  if (!RICH_TEXT_IMAGE_ACCEPTED_TYPES.includes(file.type)) return "unsupported_type";
  if (file.size > RICH_TEXT_IMAGE_MAX_FILE_SIZE) return "file_too_large";
  return null;
}

const SERVER_CODES: RichTextImageErrorCode[] = [
  "unsupported_type",
  "file_too_large",
  "too_many_pixels",
  "unreadable_image",
];

/**
 * Uploads one image. `onUploadProgress` gets 0–100 while the file is sent;
 * after 100 the server creates the WebP versions until the promise resolves.
 */
export async function uploadRichTextImage(
  file: File,
  {
    token,
    locale,
    signal,
    onUploadProgress,
  }: {
    token: string;
    locale: CcLocale;
    signal?: AbortSignal;
    onUploadProgress?: (_percent: number) => void;
  }
): Promise<UploadedRichTextImage> {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const response = await axios.post<UploadedRichTextImage>(
      process.env.API_URL + "/api/rich-text-images/",
      formData,
      {
        // No Content-Type: the browser sets multipart/form-data with its boundary.
        headers: { Authorization: `Token ${token}`, ...getLocaleHeader(locale) },
        signal,
        onUploadProgress: (event) => {
          if (onUploadProgress && event.total) {
            onUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || !axios.isAxiosError(error)) throw error;
    const status = error.response?.status;
    const code = (error.response?.data as { code?: RichTextImageErrorCode } | undefined)?.code;
    if (status === 429) throw new RichTextImageUploadError("too_many_requests");
    if (code && SERVER_CODES.includes(code)) throw new RichTextImageUploadError(code);
    throw new RichTextImageUploadError("generic");
  }
}

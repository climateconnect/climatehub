import type { Theme } from "@mui/material/styles";

/**
 * Display rules for rich-text image blocks (spec 20260708_1302, D9–D12).
 * Used by the editor and by every page that renders the stored HTML, so both
 * look the same.
 *
 * The <img> carries its natural width/height as attributes. They set the
 * rendered width, so an image is never enlarged; max-width keeps it inside the
 * column (or the size preset) and height: auto keeps the aspect ratio. When the
 * max height limits a tall image, object-fit keeps it undistorted and
 * object-position follows the alignment.
 */

// Tuned in the PoC (D11).
export const RICH_TEXT_IMAGE_MAX_HEIGHT = "65vh";
const SIZE_MAX_WIDTH = { small: "33%", medium: "50%", full: "100%" };

export const richTextImageStyles = (theme: Theme) => ({
  "& figure": {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    margin: theme.spacing(2, 0),
  },
  "& figure.image-align-left": { alignItems: "flex-start" },
  "& figure.image-align-right": { alignItems: "flex-end" },
  "& figure img[data-image-id]": {
    display: "block",
    maxWidth: SIZE_MAX_WIDTH.full,
    height: "auto",
    maxHeight: RICH_TEXT_IMAGE_MAX_HEIGHT,
    objectFit: "contain" as const,
  },
  "& figure.image-size-medium img[data-image-id]": { maxWidth: SIZE_MAX_WIDTH.medium },
  "& figure.image-size-small img[data-image-id]": { maxWidth: SIZE_MAX_WIDTH.small },
  "& figure.image-align-left img[data-image-id]": { objectPosition: "left" },
  "& figure.image-align-right img[data-image-id]": { objectPosition: "right" },
  // On phones, small and medium images use the full column width (D11).
  [theme.breakpoints.down("sm")]: {
    "& figure.image-size-medium img[data-image-id], & figure.image-size-small img[data-image-id]": {
      maxWidth: SIZE_MAX_WIDTH.full,
    },
  },
  "& figcaption": {
    width: "100%",
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    textAlign: "center" as const,
  },
  "& figure.image-align-left figcaption": { textAlign: "left" as const },
  "& figure.image-align-right figcaption": { textAlign: "right" as const },
});

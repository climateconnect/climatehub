import type { Theme } from "@mui/material/styles";
import type { RichTextImageSize } from "./RichTextImageExtension";

/**
 * Display rules for rich-text image blocks (spec 20260708_1302, D9–D12).
 * Used by the editor and by every page that renders the stored HTML, so both
 * look the same.
 *
 * Each size is a box (max width of the column, max height of the screen) and
 * the image is scaled proportionally to fit into it: landscape images are
 * limited by the width, portrait images by the height, and none is wider than
 * its natural width. The <figure> carries two facts about the image, set by
 * the server: --w (natural width in px) and --r (width / height). With them
 * the width is known before the image has loaded (no layout jump), and the
 * caption gets exactly the image's width. All layout values stay here, so
 * changing them never requires changing stored HTML.
 */

// Tuned in the PoC (D11).
export const RICH_TEXT_IMAGE_BOXES = {
  small: { "--box-w": "33%", "--box-h": "30vh" },
  medium: { "--box-w": "50%", "--box-h": "45vh" },
  full: { "--box-w": "100%", "--box-h": "65vh" },
};

// Phones: wider boxes than on desktop, so small images don't get too small,
// but the sizes still differ.
export const RICH_TEXT_IMAGE_BOXES_MOBILE = {
  small: { "--box-w": "50%", "--box-h": "30vh" },
  medium: { "--box-w": "75%", "--box-h": "45vh" },
};

// min(natural width, box width, box height × aspect ratio)
const IMAGE_WIDTH = "min(calc(var(--w) * 1px), var(--box-w), calc(var(--box-h) * var(--r)))";

export const richTextImageStyles = (theme: Theme) => ({
  "& figure": {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    margin: theme.spacing(2, 0),
    ...RICH_TEXT_IMAGE_BOXES.full,
  },
  "& figure.image-size-medium": RICH_TEXT_IMAGE_BOXES.medium,
  "& figure.image-size-small": RICH_TEXT_IMAGE_BOXES.small,
  [theme.breakpoints.down("sm")]: {
    "& figure.image-size-medium": RICH_TEXT_IMAGE_BOXES_MOBILE.medium,
    "& figure.image-size-small": RICH_TEXT_IMAGE_BOXES_MOBILE.small,
  },
  "& figure.image-align-left": { alignItems: "flex-start" },
  "& figure.image-align-right": { alignItems: "flex-end" },
  "& figure img[data-image-id]": {
    display: "block",
    width: IMAGE_WIDTH,
    maxWidth: "100%",
    height: "auto",
    aspectRatio: "var(--r)",
  },
  "& figcaption": {
    width: IMAGE_WIDTH,
    maxWidth: "100%",
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    textAlign: "center" as const,
  },
  "& figure.image-align-left figcaption": { textAlign: "left" as const },
  "& figure.image-align-right figcaption": { textAlign: "right" as const },
});

// Widest slot per size on desktop: the column is at most 1168 px wide.
const DESKTOP_SLOT: Record<RichTextImageSize, number> = { small: 390, medium: 584, full: 1168 };
// Share of the screen width per size on phones (RICH_TEXT_IMAGE_BOXES_MOBILE).
const MOBILE_SLOT_VW: Record<RichTextImageSize, number> = { small: 50, medium: 75, full: 100 };
const MOBILE_BREAKPOINT = 600;

/**
 * The `sizes` attribute does two things: it lets the browser pick the right
 * variant, and with srcset it sets the size the browser treats as the image's
 * own size. It must therefore never exceed the natural width, or a small image
 * would be enlarged. On phones each size takes a share of the screen width (D11).
 */
export function sizesAttribute(size: RichTextImageSize, naturalWidth: number | null) {
  const width = naturalWidth && naturalWidth > 0 ? naturalWidth : DESKTOP_SLOT.full;
  const desktop = `${Math.min(width, DESKTOP_SLOT[size] ?? DESKTOP_SLOT.full)}px`;
  const vw = MOBILE_SLOT_VW[size] ?? MOBILE_SLOT_VW.full;
  // Screen width at which the image reaches its natural width.
  const limit = Math.floor((width * 100) / vw);
  if (limit >= MOBILE_BREAKPOINT) {
    return `(max-width: ${MOBILE_BREAKPOINT}px) ${vw}vw, ${desktop}`;
  }
  // Small image: its share of the screen only below that width.
  return `(max-width: ${limit}px) ${vw}vw, (max-width: ${MOBILE_BREAKPOINT}px) ${width}px, ${desktop}`;
}

/** The figure's style: natural width (--w) and aspect ratio (--r). Same as image_style on the server. */
export function imageStyle(width: number | null, height: number | null) {
  if (!width || !height) return undefined;
  const ratio = Number((width / height).toFixed(4));
  return `--w: ${width}; --r: ${ratio};`;
}

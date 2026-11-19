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
  // On phones every size uses the full column width and height limit (D11).
  [theme.breakpoints.down("sm")]: {
    "& figure.image-size-medium, & figure.image-size-small": RICH_TEXT_IMAGE_BOXES.full,
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
const MOBILE_BREAKPOINT = 600;

/**
 * The `sizes` attribute does two things: it lets the browser pick the right
 * variant, and with srcset it sets the size the browser treats as the image's
 * own size. It must therefore never exceed the natural width, or a small image
 * would be enlarged. On phones every size is shown at full width (D11).
 */
export function sizesAttribute(size: RichTextImageSize, naturalWidth: number | null) {
  const width = naturalWidth && naturalWidth > 0 ? naturalWidth : DESKTOP_SLOT.full;
  const desktop = `${Math.min(width, DESKTOP_SLOT[size] ?? DESKTOP_SLOT.full)}px`;
  if (width >= MOBILE_BREAKPOINT) {
    return `(max-width: ${MOBILE_BREAKPOINT}px) 100vw, ${desktop}`;
  }
  // Narrower than a phone breakpoint: full width only below its own width.
  return `(max-width: ${width}px) 100vw, (max-width: ${MOBILE_BREAKPOINT}px) ${width}px, ${desktop}`;
}

/** The figure's style: natural width (--w) and aspect ratio (--r). Same as image_style on the server. */
export function imageStyle(width: number | null, height: number | null) {
  if (!width || !height) return undefined;
  const ratio = Number((width / height).toFixed(4));
  return `--w: ${width}; --r: ${ratio};`;
}

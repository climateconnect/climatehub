import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import RichTextImageView from "./RichTextImageView";
import type { UploadedRichTextImage } from "./richTextImageUpload";

export type RichTextImageSize = "small" | "medium" | "full";
export type RichTextImageAlign = "left" | "center" | "right";

export const RICH_TEXT_IMAGE_SIZES: RichTextImageSize[] = ["small", "medium", "full"];
export const RICH_TEXT_IMAGE_ALIGNS: RichTextImageAlign[] = ["left", "center", "right"];

// Which variant the browser should pick: the column is at most 1168 px wide,
// and on phones every size is shown at full width (D11).
const SIZES_ATTRIBUTE: Record<RichTextImageSize, string> = {
  small: "(max-width: 600px) 100vw, 390px",
  medium: "(max-width: 600px) 100vw, 584px",
  full: "(max-width: 600px) 100vw, 1168px",
};

function pickClass<T extends string>(
  element: HTMLElement,
  prefix: string,
  options: T[],
  fallback: T
) {
  return options.find((option) => element.classList.contains(`${prefix}${option}`)) ?? fallback;
}

function imageAttribute(name: string) {
  return (element: HTMLElement) => element.querySelector("img")?.getAttribute(name) ?? null;
}

function numberAttribute(name: string) {
  return (element: HTMLElement) => {
    const value = Number(element.querySelector("img")?.getAttribute(name));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
}

declare module "@tiptap/core" {
  // eslint-disable-next-line no-unused-vars -- module augmentation
  interface Commands<ReturnType> {
    richTextImage: {
      insertRichTextImage: (_image: UploadedRichTextImage, _alt: string) => ReturnType;
    };
  }
}

/**
 * An image block: <figure> with the image and an optional plain-text caption
 * (spec 20260708_1302, D8, D20, D27). Size and alignment are stored as classes.
 * The server rewrites the image URLs on save, so the attributes here only need
 * to be right for display in the editor.
 */
const RichTextImage = Node.create({
  name: "richTextImage",
  group: "block",
  content: "text*",
  marks: "",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: (element) => numberAttribute("data-image-id")(element),
        rendered: false,
      },
      src: { default: null, parseHTML: imageAttribute("src"), rendered: false },
      srcset: { default: null, parseHTML: imageAttribute("srcset"), rendered: false },
      width: { default: null, parseHTML: numberAttribute("width"), rendered: false },
      height: { default: null, parseHTML: numberAttribute("height"), rendered: false },
      alt: { default: "", parseHTML: (el) => imageAttribute("alt")(el) ?? "", rendered: false },
      size: {
        default: "full",
        parseHTML: (el) => pickClass(el, "image-size-", RICH_TEXT_IMAGE_SIZES, "full"),
        rendered: false,
      },
      align: {
        default: "center",
        parseHTML: (el) => pickClass(el, "image-align-", RICH_TEXT_IMAGE_ALIGNS, "center"),
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (element) => (element.querySelector("img[data-image-id]") ? null : false),
        contentElement: (element) =>
          element.querySelector("figcaption") ?? element.ownerDocument.createElement("figcaption"),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { imageId, src, srcset, width, height, alt, size, align } = node.attrs;
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { class: `image-size-${size} image-align-${align}` }),
      [
        "img",
        {
          src,
          srcset,
          sizes: SIZES_ATTRIBUTE[size as RichTextImageSize] ?? SIZES_ATTRIBUTE.full,
          width,
          height,
          alt: alt ?? "",
          "data-image-id": imageId,
          loading: "lazy",
        },
      ],
      ["figcaption", 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichTextImageView);
  },

  addCommands() {
    return {
      insertRichTextImage: (image, alt) => ({ state, commands }) => {
        const largest = image.variants[image.variants.length - 1];
        const content = {
          type: this.name,
          attrs: {
            imageId: image.id,
            src: largest.url,
            srcset: image.variants.map((v) => `${v.url} ${v.width}w`).join(", "),
            width: image.width,
            height: image.height,
            alt,
          },
        };
        // Inserting while a block is selected, or while the cursor is in an
        // image's caption (e.g. right after inserting an image), would replace
        // that block. Add the new image after it instead.
        const { selection } = state;
        if (selection instanceof NodeSelection) {
          return commands.insertContentAt(selection.to, content);
        }
        const { $from } = selection;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === this.name) {
            return commands.insertContentAt($from.after(depth), content);
          }
        }
        return commands.insertContent(content);
      },
    };
  },
});

export default RichTextImage;

export function countRichTextImages(doc: { descendants: (_fn: (_node: any) => void) => void }) {
  let count = 0;
  doc.descendants((node) => {
    if (node.type.name === RichTextImage.name) count += 1;
  });
  return count;
}

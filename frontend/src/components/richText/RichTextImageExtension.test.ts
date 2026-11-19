import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
// eslint-disable-next-line import/no-named-as-default
import StarterKit from "@tiptap/starter-kit";
import RichTextImage, { countRichTextImages } from "./RichTextImageExtension";

// The React node view needs a React editor; the schema, parsing and commands don't.
const HeadlessRichTextImage = RichTextImage.extend({ addNodeView: () => () => ({} as any) });

const VARIANT = (name: string) => `http://localhost:8000/media/rich_text_images/${name}.webp`;

const STORED = `<figure class="image-size-medium image-align-left"><img src="${VARIANT(
  "b"
)}" srcset="${VARIANT("a")} 600w, ${VARIANT(
  "b"
)} 1200w" sizes="(max-width: 600px) 100vw, 584px" width="1200" height="800" alt="Trees" data-image-id="7" loading="lazy"><figcaption>Photo: Jane</figcaption></figure>`;

function makeEditor(content = "") {
  return new Editor({ extensions: [StarterKit, HeadlessRichTextImage], content });
}

const uploaded = (id: number) => ({
  id,
  width: 600,
  height: 400,
  variants: [{ url: VARIANT(`v${id}`), width: 600, height: 400 }],
});

describe("RichTextImage", () => {
  it("parses the stored HTML and renders it back unchanged", () => {
    const editor = makeEditor(STORED);
    expect(editor.getHTML()).toBe(STORED);
    editor.destroy();
  });

  it("renders no caption text and default classes for a new image", () => {
    const editor = makeEditor("<p>Text</p>");
    editor.commands.insertRichTextImage(uploaded(1), "");
    const html = editor.getHTML();
    expect(html).toContain('class="image-size-full image-align-center"');
    expect(html).toContain('data-image-id="1"');
    expect(html).toContain('sizes="(max-width: 600px) 100vw, 1168px"');
    expect(html).toContain('loading="lazy"');
    editor.destroy();
  });

  it("ignores figures without a stored image", () => {
    const editor = makeEditor('<figure><img src="https://example.org/x.png"></figure><p>a</p>');
    expect(countRichTextImages(editor.state.doc)).toBe(0);
    editor.destroy();
  });

  it("adds a new image after a selected image instead of replacing it", () => {
    const editor = makeEditor(STORED);
    editor.commands.command(({ tr }) => {
      tr.setSelection(NodeSelection.create(tr.doc, 0));
      return true;
    });
    editor.commands.insertRichTextImage(uploaded(2), "Second");
    expect(countRichTextImages(editor.state.doc)).toBe(2);
    const html = editor.getHTML();
    expect(html.indexOf('data-image-id="7"')).toBeLessThan(html.indexOf('data-image-id="2"'));
    editor.destroy();
  });
});

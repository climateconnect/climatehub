import React, { useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { Extensions } from "@tiptap/core";
// eslint-disable-next-line import/no-named-as-default
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
// eslint-disable-next-line import/no-named-as-default
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
// eslint-disable-next-line import/no-named-as-default
import Emoji from "@tiptap/extension-emoji";
import type { RichTextEditorRef } from "mui-tiptap";
import {
  RichTextEditor,
  MenuControlsContainer,
  MenuDivider,
  MenuButtonBold,
  MenuButtonItalic,
  MenuButtonBulletedList,
  MenuButtonOrderedList,
  MenuButtonAlignLeft,
  MenuButtonAlignCenter,
  MenuButtonAlignRight,
  MenuButtonEditLink,
  MenuButtonAddTable,
  LinkBubbleMenu,
  LinkBubbleMenuHandler,
  TableMenuControls,
} from "mui-tiptap";

import { emojiItems, emojiRender } from "./emojiSuggestion";
import type { LinkBubbleMenuLabels, TableMenuControlLabels } from "./richTextLabels";

const CHARACTER_LIMIT = 5000;

const TABLE_HEADER_STYLE = "background-color: #f0f0f0;";

const EXTENSIONS: Extensions = [
  StarterKit.configure({
    italic: true,
    strike: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    blockquote: false,
    bulletList: true,
    orderedList: true,
    listItem: true,
    link: {
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer" },
    },
  }),
  TextAlign.configure({
    types: ["paragraph", "tableCell", "tableHeader"],
  }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader.configure({
    HTMLAttributes: {
      style: TABLE_HEADER_STYLE,
    },
  }),
  Emoji.configure({
    suggestion: {
      items: emojiItems,
      render: emojiRender,
    },
  }),
  LinkBubbleMenuHandler,
  CharacterCount.configure({ limit: CHARACTER_LIMIT }),
];

const CharCount = styled(Box)(({ theme }) => ({
  textAlign: "right",
  padding: theme.spacing(0.5, 1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const ErrorText = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: "0.875rem",
  marginTop: theme.spacing(0.5),
}));

const EditorWrapper = styled("div", {
  shouldForwardProp: (p) => p !== "hasError",
})<{ hasError?: boolean }>(({ theme, hasError }) => ({
  ...(hasError && {
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: theme.shape.borderRadius,
  }),
}));

type TooltipLabels = {
  bold: string;
  italic: string;
  bulletList: string;
  orderedList: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  editLink: string;
  addTable: string;
};

type Props = {
  content: string;
  onChange: (_html: string) => void;
  editable?: boolean;
  error?: string;
  showCharCount?: boolean;
  ariaLabel?: string;
  tooltipLabels?: TooltipLabels;
  linkBubbleMenuLabels?: LinkBubbleMenuLabels;
  tableMenuControlLabels?: TableMenuControlLabels;
};

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

export default function OrganizerMessageEditor({
  content,
  onChange,
  editable = true,
  error,
  showCharCount = true,
  ariaLabel,
  tooltipLabels,
  linkBubbleMenuLabels,
  tableMenuControlLabels,
}: Props) {
  const rteRef = useRef<RichTextEditorRef>(null);
  const [charCount, setCharCount] = useState(0);

  const t = tooltipLabels;

  return (
    <EditorWrapper hasError={!!error}>
      <RichTextEditor
        ref={rteRef}
        immediatelyRender={false}
        extensions={EXTENSIONS}
        content={content || ""}
        editable={editable}
        onCreate={({ editor }) => {
          setCharCount(editor.storage.characterCount.characters());
        }}
        onUpdate={({ editor }) => {
          const html = editor.getHTML();
          onChange(html === "<p></p>" ? "" : html);
          setCharCount(editor.storage.characterCount.characters());
        }}
        editorProps={{
          attributes: ariaLabel ? { "aria-label": ariaLabel } : undefined,
        }}
        renderControls={() => (
          <MenuControlsContainer>
            <MenuButtonBold tooltipLabel={t?.bold ?? "Bold"} />
            <MenuButtonItalic tooltipLabel={t?.italic ?? "Italic"} />
            <MenuDivider />
            <MenuButtonBulletedList tooltipLabel={t?.bulletList ?? "Bullet list"} />
            <MenuButtonOrderedList tooltipLabel={t?.orderedList ?? "Ordered list"} />
            <MenuDivider />
            <MenuButtonAlignLeft tooltipLabel={t?.alignLeft ?? "Align left"} />
            <MenuButtonAlignCenter tooltipLabel={t?.alignCenter ?? "Align center"} />
            <MenuButtonAlignRight tooltipLabel={t?.alignRight ?? "Align right"} />
            <MenuDivider />
            <MenuButtonEditLink tooltipLabel={t?.editLink ?? "Edit link"} />
            <MenuButtonAddTable tooltipLabel={t?.addTable ?? "Add table"} />
            <TableMenuControls labels={tableMenuControlLabels} />
          </MenuControlsContainer>
        )}
        RichTextFieldProps={{
          footer: showCharCount ? (
            <CharCount>
              <Typography
                variant="caption"
                color={charCount >= CHARACTER_LIMIT ? "error" : "textSecondary"}
              >
                {charCount}/{CHARACTER_LIMIT}
              </Typography>
            </CharCount>
          ) : undefined,
        }}
      >
        {() => <LinkBubbleMenu labels={linkBubbleMenuLabels} />}
      </RichTextEditor>
      {error && <ErrorText>{error}</ErrorText>}
    </EditorWrapper>
  );
}

export { CHARACTER_LIMIT, stripHtml };

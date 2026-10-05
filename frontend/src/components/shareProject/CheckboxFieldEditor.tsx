import React, { useContext, useEffect, useRef, useState } from "react";
import type { Extensions } from "@tiptap/core";
// eslint-disable-next-line import/no-named-as-default
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import { Box, Typography } from "@mui/material";
import type { RichTextEditorRef } from "mui-tiptap";
import {
  RichTextEditor,
  MenuControlsContainer,
  MenuButtonBold,
  MenuButtonEditLink,
  LinkBubbleMenu,
  LinkBubbleMenuHandler,
} from "mui-tiptap";
import { styled } from "@mui/material/styles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { getLinkBubbleMenuLabels } from "../richText/richTextLabels";

const CHARACTER_LIMIT = 500;

// Defined outside component to avoid recreating extensions on each render
const EXTENSIONS: Extensions = [
  StarterKit.configure({
    italic: false,
    strike: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    // Configure the Link extension through StarterKit to avoid duplicate
    // extension warnings. openOnClick: false prevents Tiptap from calling
    // window.open() on click so the LinkBubbleMenu can handle it instead.
    link: {
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer" },
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

type Props = {
  description: string;
  onChange: (_html: string) => void;
  disabled?: boolean;
  isDraft?: boolean;
  error?: string;
};

export default function CheckboxFieldEditor({
  description,
  onChange,
  disabled,
  isDraft,
  error,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });
  const rteRef = useRef<RichTextEditorRef>(null);
  const [charCount, setCharCount] = useState(0);

  // Sync external description changes into the editor without affecting typing
  useEffect(() => {
    const editor = rteRef.current?.editor;
    if (editor && !editor.isFocused) {
      const currentHtml = editor.getHTML();
      const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml;
      if (normalizedCurrent !== (description || "")) {
        editor.commands.setContent(description || "");
      }
    }
  }, [description]);

  return (
    <>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {texts.registration_field_description}
        {!isDraft && !disabled && " *"}
      </Typography>
      {error && (
        <Typography variant="caption" color="error" display="block" sx={{ mb: 0.5 }}>
          {error}
        </Typography>
      )}
      <RichTextEditor
        ref={rteRef}
        immediatelyRender={false}
        extensions={EXTENSIONS}
        content={description || ""}
        editable={!disabled}
        onCreate={({ editor }) => {
          setCharCount((editor.storage as Record<string, any>).characterCount.characters());
        }}
        onUpdate={({ editor }) => {
          const html = editor.getHTML();
          onChange(html === "<p></p>" ? "" : html);
          setCharCount((editor.storage as Record<string, any>).characterCount.characters());
        }}
        renderControls={
          disabled
            ? () => null
            : () => (
                <MenuControlsContainer>
                  <MenuButtonBold />
                  <MenuButtonEditLink tooltipLabel={texts.editor_edit_link} />
                </MenuControlsContainer>
              )
        }
        RichTextFieldProps={{
          disabled: disabled,
          sx: disabled
            ? {
                "& .MuiTiptap-RichTextContent-readonly p": {
                  color: "text.disabled",
                },
              }
            : undefined,
          footer: disabled ? undefined : (
            <CharCount>
              <Typography
                variant="caption"
                color={charCount >= CHARACTER_LIMIT ? "error" : "textSecondary"}
              >
                {charCount}/{CHARACTER_LIMIT}
              </Typography>
            </CharCount>
          ),
        }}
      >
        {/* render prop ensures LinkBubbleMenu re-renders on every editor transaction */}
        {() => <LinkBubbleMenu labels={getLinkBubbleMenuLabels(locale)} />}
      </RichTextEditor>
    </>
  );
}

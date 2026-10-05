import React, { useContext, useEffect, useRef, useState } from "react";
import type { Extensions } from "@tiptap/core";
// eslint-disable-next-line import/no-named-as-default
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
// eslint-disable-next-line import/no-named-as-default
import Youtube from "@tiptap/extension-youtube";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import YouTubeIcon from "@mui/icons-material/YouTube";
import type { RichTextEditorRef } from "mui-tiptap";
import {
  RichTextEditor,
  MenuControlsContainer,
  MenuButton,
  MenuButtonBold,
  MenuButtonItalic,
  MenuButtonBulletedList,
  MenuButtonOrderedList,
  MenuButtonEditLink,
  LinkBubbleMenu,
  LinkBubbleMenuHandler,
} from "mui-tiptap";
import { styled } from "@mui/material/styles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { getLinkBubbleMenuLabels } from "../richText/richTextLabels";

const CHARACTER_LIMIT = 4000;

const YOUTUBE_URL_RE = /^((?:https?:)\/\/)?((?:www|m|music)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)(?:\/(?:[\w-]+\?v=|embed\/|v\/)?|\/)([\w-]+)(\S+)?$/;

// Defined outside component to avoid recreating extensions on each render
const EXTENSIONS: Extensions = [
  StarterKit.configure({
    strike: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    blockquote: false,
    link: {
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer" },
    },
  }),
  Youtube.configure({
    controls: true,
    nocookie: true,
    modestBranding: true,
  }),
  LinkBubbleMenuHandler,
  CharacterCount.configure({ limit: CHARACTER_LIMIT }),
];

const CharCount = styled("div")(({ theme }) => ({
  textAlign: "right",
  padding: theme.spacing(0.5, 1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

type Props = {
  descriptionHtml: string;
  onChange: (_html: string) => void;
  disabled?: boolean;
  error?: string;
};

export default function ProjectDescriptionEditor({
  descriptionHtml,
  onChange,
  disabled,
  error,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });
  const rteRef = useRef<RichTextEditorRef>(null);
  const [charCount, setCharCount] = useState(0);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState("");

  // Sync external descriptionHtml changes into the editor without affecting typing
  useEffect(() => {
    const editor = rteRef.current?.editor;
    if (editor && !editor.isFocused) {
      const currentHtml = editor.getHTML();
      const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml;
      if (normalizedCurrent !== (descriptionHtml || "")) {
        editor.commands.setContent(descriptionHtml || "");
      }
    }
  }, [descriptionHtml]);

  const handleOpenYoutubeModal = () => {
    setYoutubeUrl("");
    setYoutubeError("");
    setYoutubeModalOpen(true);
  };

  const handleCloseYoutubeModal = () => {
    setYoutubeModalOpen(false);
    setYoutubeUrl("");
    setYoutubeError("");
  };

  const handleInsertYoutube = () => {
    if (!YOUTUBE_URL_RE.test(youtubeUrl.trim())) {
      setYoutubeError(texts.project_description_youTube_url_invalid);
      return;
    }
    const editor = rteRef.current?.editor;
    if (editor) {
      editor.commands.setYoutubeVideo({ src: youtubeUrl.trim() });
    }
    handleCloseYoutubeModal();
  };

  return (
    <>
      {error && (
        <Typography variant="caption" color="error" display="block" sx={{ mb: 0.5 }}>
          {error}
        </Typography>
      )}
      <RichTextEditor
        ref={rteRef}
        immediatelyRender={false}
        extensions={EXTENSIONS}
        content={descriptionHtml || ""}
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
                  <MenuButtonItalic />
                  <MenuButtonBulletedList />
                  <MenuButtonOrderedList />
                  <MenuButtonEditLink tooltipLabel={texts.editor_edit_link} />
                  <MenuButton
                    tooltipLabel={texts.project_description_youTube_button}
                    IconComponent={YouTubeIcon}
                    onClick={handleOpenYoutubeModal}
                  />
                </MenuControlsContainer>
              )
        }
        RichTextFieldProps={{
          disabled: disabled,
          sx: {
            "& iframe": {
              maxWidth: 640,
              width: "100%",
              height: "auto",
              aspectRatio: "16 / 9",
            },
            ...(disabled
              ? {
                  "& .MuiTiptap-RichTextContent-readonly p": {
                    color: "text.disabled",
                  },
                }
              : {}),
          },
          footer: disabled ? undefined : (
            <CharCount>
              <Typography
                variant="caption"
                color={charCount >= CHARACTER_LIMIT ? "error" : "textSecondary"}
              >
                {charCount}/{CHARACTER_LIMIT} {texts.project_description_character_counter}
              </Typography>
            </CharCount>
          ),
        }}
      >
        {() => <LinkBubbleMenu labels={getLinkBubbleMenuLabels(locale)} />}
      </RichTextEditor>

      <Dialog open={youtubeModalOpen} onClose={handleCloseYoutubeModal} maxWidth="sm" fullWidth>
        <DialogTitle>{texts.project_description_youTube_button}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={texts.project_description_youTube_url_label}
            fullWidth
            variant="outlined"
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value);
              setYoutubeError("");
            }}
            error={!!youtubeError}
            helperText={youtubeError}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleInsertYoutube();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseYoutubeModal}>
            {texts.project_description_youTube_cancel}
          </Button>
          <Button onClick={handleInsertYoutube} variant="contained">
            {texts.project_description_youTube_insert}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

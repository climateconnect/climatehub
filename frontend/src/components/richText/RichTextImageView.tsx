import React, { useContext, useState } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { RICH_TEXT_IMAGE_MAX_ALT_LENGTH } from "./richTextImageUpload";
import { sizesAttribute } from "./richTextImageStyles";

// The same --w / --r custom properties the stored HTML carries on <figure>.
function imageStyleProperties(width: number | null, height: number | null) {
  if (!width || !height) return undefined;
  return { "--w": width, "--r": Number((width / height).toFixed(4)) } as React.CSSProperties;
}

const SIZE_LABELS = { small: "S", medium: "M", full: "L" };
const ALIGN_ICONS = {
  left: FormatAlignLeftIcon,
  center: FormatAlignCenterIcon,
  right: FormatAlignRightIcon,
};

/**
 * How an image block looks inside the editor: the same <figure> as on the page,
 * plus, when the image is selected, a menu for size, alignment, alt text and
 * removal (D10), and a reminder when alt text is missing (D21).
 */
export default function RichTextImageView({
  node,
  selected,
  editor,
  getPos,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale });
  const [altDialogOpen, setAltDialogOpen] = useState(false);
  const [altDraft, setAltDraft] = useState("");
  const { src, srcset, width, height, alt, size, align, imageId } = node.attrs;
  const editable = editor.isEditable;

  const openAltDialog = () => {
    setAltDraft(alt ?? "");
    setAltDialogOpen(true);
  };

  const selectImage = () => {
    const pos = typeof getPos === "function" ? getPos() : undefined;
    if (editable && typeof pos === "number") editor.commands.setNodeSelection(pos);
  };

  // Changing an attribute replaces the node and drops the selection; select it
  // again so the menu stays open for the next change.
  const updateAndKeepSelected = (attributes: Record<string, unknown>) => {
    updateAttributes(attributes);
    selectImage();
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={`image-size-${size} image-align-${align}${selected ? " is-selected" : ""}`}
      style={imageStyleProperties(width, height)}
    >
      <img
        src={src}
        srcSet={srcset ?? undefined}
        sizes={sizesAttribute(size, width)}
        width={width ?? undefined}
        height={height ?? undefined}
        alt={alt ?? ""}
        data-image-id={imageId}
        contentEditable={false}
        draggable={false}
        onClick={selectImage}
      />
      {editable && selected && (
        <Paper
          contentEditable={false}
          elevation={3}
          // Keep the image selected while the menu is used; otherwise the
          // editor moves the selection on mousedown and the menu disappears
          // before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          sx={{
            position: "absolute",
            top: 8,
            // Follow the image's alignment so the menu stays next to it.
            ...(align === "left"
              ? { left: 0 }
              : align === "right"
              ? { right: 0 }
              : { left: "50%", transform: "translateX(-50%)" }),
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            p: 0.5,
            zIndex: 1,
          }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={size}
            onChange={(_event, value) => value && updateAndKeepSelected({ size: value })}
          >
            {Object.entries(SIZE_LABELS).map(([value, label]) => (
              <ToggleButton
                key={value}
                value={value}
                aria-label={texts[`rich_text_image_size_${value}`]}
              >
                <Tooltip title={texts[`rich_text_image_size_${value}`]}>
                  <span>{label}</span>
                </Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={align}
            onChange={(_event, value) => value && updateAndKeepSelected({ align: value })}
          >
            {Object.entries(ALIGN_ICONS).map(([value, Icon]) => (
              <ToggleButton
                key={value}
                value={value}
                aria-label={texts[`rich_text_image_align_${value}`]}
              >
                <Tooltip title={texts[`rich_text_image_align_${value}`]}>
                  <Icon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button size="small" onClick={openAltDialog}>
            {texts.rich_text_image_edit_alt}
          </Button>
          <Tooltip title={texts.rich_text_image_remove}>
            <IconButton size="small" aria-label={texts.rich_text_image_remove} onClick={deleteNode}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>
      )}
      <NodeViewContent<"figcaption">
        as="figcaption"
        className={node.content.size === 0 ? "is-empty" : undefined}
        data-placeholder={texts.rich_text_image_caption_placeholder}
      />
      {editable && !alt && (
        <Box
          component="button"
          type="button"
          contentEditable={false}
          onClick={openAltDialog}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            mt: 0.5,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "warning.dark",
            fontSize: "0.75rem",
            p: 0,
          }}
        >
          <WarningAmberIcon fontSize="inherit" />
          {texts.rich_text_image_missing_alt}
        </Box>
      )}
      <Dialog open={altDialogOpen} onClose={() => setAltDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{texts.rich_text_image_edit_alt}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label={texts.rich_text_image_alt_label}
            value={altDraft}
            onChange={(event) =>
              setAltDraft(event.target.value.slice(0, RICH_TEXT_IMAGE_MAX_ALT_LENGTH))
            }
            helperText={`${texts.rich_text_image_alt_hint} (${altDraft.length}/${RICH_TEXT_IMAGE_MAX_ALT_LENGTH})`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAltDialogOpen(false)}>{texts.rich_text_image_cancel}</Button>
          <Button
            variant="contained"
            onClick={() => {
              updateAttributes({ alt: altDraft.trim() });
              setAltDialogOpen(false);
            }}
          >
            {texts.rich_text_image_save}
          </Button>
        </DialogActions>
      </Dialog>
    </NodeViewWrapper>
  );
}

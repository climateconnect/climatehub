import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import Cookies from "universal-cookie";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import {
  RICH_TEXT_IMAGE_ACCEPTED_TYPES,
  RICH_TEXT_IMAGE_MAX_ALT_LENGTH,
  RichTextImageErrorCode,
  RichTextImageUploadError,
  UploadedRichTextImage,
  checkRichTextImageFile,
  uploadRichTextImage,
} from "./richTextImageUpload";

type Phase = "select" | "uploading" | "processing";

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (_image: UploadedRichTextImage, _alt: string) => void;
};

/**
 * Pick an image, add alt text, upload it. The image is inserted only after the
 * upload succeeded, so no placeholder or broken image ends up in the text.
 * While uploading, the dialog can only be left with "Cancel", which aborts the
 * upload; the form behind it can't be saved meanwhile (D16).
 */
export default function RichTextImageUploadDialog({ open, onClose, onInsert }: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState(0);
  const [errorCode, setErrorCode] = useState<RichTextImageErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = phase !== "select";

  useEffect(() => {
    if (!open) {
      setFile(null);
      setAlt("");
      setPhase("select");
      setProgress(0);
      setErrorCode(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    const problem = checkRichTextImageFile(chosen);
    setErrorCode(problem);
    setFile(problem ? null : chosen);
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    onClose();
  };

  const handleUpload = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setErrorCode(null);
    setProgress(0);
    setPhase("uploading");
    try {
      const image = await uploadRichTextImage(file, {
        token: new Cookies().get("auth_token"),
        locale,
        signal: controller.signal,
        onUploadProgress: (percent) => {
          setProgress(percent);
          if (percent >= 100) setPhase("processing");
        },
      });
      abortRef.current = null;
      onInsert(image, alt.trim());
      onClose();
    } catch (error) {
      if (controller.signal.aborted) return;
      abortRef.current = null;
      setPhase("select");
      setErrorCode(error instanceof RichTextImageUploadError ? error.code : "generic");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        // Only "Cancel" ends a running upload, so it can't be left by accident.
        if (busy && reason) return;
        handleCancel();
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{texts.rich_text_image_insert}</DialogTitle>
      <DialogContent>
        <input
          ref={inputRef}
          type="file"
          accept={RICH_TEXT_IMAGE_ACCEPTED_TYPES.join(",")}
          hidden
          onChange={handleFileChange}
          data-testid="rich-text-image-file-input"
        />
        {previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt=""
            sx={{ display: "block", maxWidth: "100%", maxHeight: 240, mx: "auto", mb: 1 }}
          />
        ) : null}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <Button variant="outlined" disabled={busy} onClick={() => inputRef.current?.click()}>
            {file ? texts.rich_text_image_choose_other_file : texts.rich_text_image_choose_file}
          </Button>
          <Typography variant="caption" color="textSecondary">
            {texts.rich_text_image_file_hint}
          </Typography>
        </Box>
        <TextField
          label={texts.rich_text_image_alt_label}
          fullWidth
          value={alt}
          disabled={busy}
          onChange={(event) => setAlt(event.target.value.slice(0, RICH_TEXT_IMAGE_MAX_ALT_LENGTH))}
          helperText={`${texts.rich_text_image_alt_hint} (${alt.length}/${RICH_TEXT_IMAGE_MAX_ALT_LENGTH})`}
        />
        {busy && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {phase === "uploading"
                ? `${texts.rich_text_image_uploading} ${progress}%`
                : texts.rich_text_image_processing}
            </Typography>
            <LinearProgress
              variant={phase === "uploading" ? "determinate" : "indeterminate"}
              value={progress}
            />
          </Box>
        )}
        {errorCode && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }} role="alert">
            {texts[`rich_text_image_error_${errorCode}`]}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>{texts.rich_text_image_cancel}</Button>
        <Button variant="contained" disabled={!file || busy} onClick={handleUpload}>
          {texts.rich_text_image_insert}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

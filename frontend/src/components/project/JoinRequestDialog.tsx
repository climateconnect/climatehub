import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";

import getTexts from "../../../public/texts/texts";
import { codePointLength, toPlainText, truncateCodePoints } from "../../utils/plainText";
import UserContext from "../context/UserContext";

export const JOIN_REQUEST_MESSAGE_MAX_LENGTH = 500;

const Counter = styled(Typography)(({ theme }) => ({
  textAlign: "right",
  marginTop: theme.spacing(0.5),
  color: theme.palette.text.secondary,
}));

type Props = {
  open: boolean;
  onClose: () => void;
  /** Resolves to true if the dialog should close (request sent or already existing). */
  onSend: (_message: string) => Promise<boolean>;
};

export default function JoinRequestDialog({ open, onClose, onSend }: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Discard the draft whenever the dialog is (re)opened
  useEffect(() => {
    if (open) {
      setMessage("");
      setSending(false);
    }
  }, [open]);

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    let shouldClose = false;
    try {
      shouldClose = await onSend(toPlainText(message));
    } finally {
      setSending(false);
    }
    if (shouldClose) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="join-request-dialog-title"
    >
      <DialogTitle id="join-request-dialog-title">{texts.join_request_dialog_title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {texts.join_request_dialog_explanation}
        </DialogContentText>
        <TextField
          fullWidth
          multiline
          minRows={4}
          autoFocus
          label={texts.join_request_message_label}
          value={message}
          onChange={(e) =>
            setMessage(truncateCodePoints(e.target.value, JOIN_REQUEST_MESSAGE_MAX_LENGTH))
          }
          disabled={sending}
        />
        <Counter variant="caption" component="div" aria-live="polite">
          {codePointLength(message)} / {JOIN_REQUEST_MESSAGE_MAX_LENGTH}
        </Counter>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
        <Button onClick={handleClose} disabled={sending}>
          {texts.cancel}
        </Button>
        <Button
          variant="contained"
          sx={{ whiteSpace: "nowrap" }}
          onClick={handleSend}
          disabled={sending}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {texts.send_join_request}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

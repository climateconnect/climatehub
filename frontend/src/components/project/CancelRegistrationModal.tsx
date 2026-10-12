import React, { useContext, useEffect, useState } from "react";
import { Button, CircularProgress, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Cookies from "universal-cookie";

import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import { Project } from "../../types";
import UserContext from "../context/UserContext";
import GenericDialog from "../dialogs/GenericDialog";

const Content = styled("div")(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(2, 0),
}));

const ErrorText = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  marginTop: theme.spacing(2),
}));

const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(3),
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    justifyContent: "center",
  },
}));

const LoadingContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: "center",
}));

interface CancelRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  onCancellationSuccess: () => void;
}

export default function CancelRegistrationModal({
  open,
  onClose,
  project,
  onCancellationSuccess,
}: CancelRegistrationModalProps) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale, project });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMessage("");
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    setError(null);
    setMessage("");
    onClose();
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = new Cookies().get("auth_token");
      const trimmedMessage = message.trim();
      await apiRequest({
        method: "delete",
        url: `/api/projects/${project.url_slug}/registrations/`,
        payload: trimmedMessage ? { message: trimmedMessage } : {},
        token,
        locale,
      });
      setLoading(false);
      onCancellationSuccess();
      onClose();
    } catch (e: any) {
      setLoading(false);
      setError(
        e?.response?.data?.message || e?.response?.data?.detail || texts.cancel_registration_error
      );
    }
  };

  const confirmMessage = (texts.cancel_registration_confirm as string).replace(
    "{event}",
    project.name ?? ""
  );

  return (
    <GenericDialog
      open={open}
      onClose={handleClose}
      title={texts.cancel_registration}
      maxWidth="sm"
    >
      <Content>
        <Typography variant="body1">{confirmMessage}</Typography>

        <TextField
          fullWidth
          multiline
          rows={3}
          margin="normal"
          label={texts.cancellation_message_to_organizer_label as string}
          placeholder={texts.cancellation_message_to_organizer_placeholder as string}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          inputProps={{ maxLength: 1000 }}
          disabled={loading}
        />

        {error && <ErrorText variant="body2">{error}</ErrorText>}

        {loading ? (
          <LoadingContainer>
            <CircularProgress size={32} />
          </LoadingContainer>
        ) : (
          <Actions>
            <Button variant="contained" color="error" onClick={handleConfirm}>
              {texts.yes_cancel_registration}
            </Button>
            <Button variant="outlined" onClick={handleClose}>
              {texts.keep_registration}
            </Button>
          </Actions>
        )}
      </Content>
    </GenericDialog>
  );
}

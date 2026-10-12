import React, { useContext, useEffect, useState } from "react";
import { Button, CircularProgress, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Cookies from "universal-cookie";

import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import { Project } from "../../types";
import UserContext from "../context/UserContext";
import GenericDialog from "../dialogs/GenericDialog";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ConfirmText = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const MessageField = styled(TextField)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const ActionRow = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  gap: theme.spacing(1),
  marginTop: theme.spacing(3),
}));

const ErrorText = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: "0.875rem",
  marginTop: theme.spacing(1),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegistrationInfo = {
  /** Backend PK of the EventRegistration record — used to build the DELETE URL. */
  id: number;
  user_first_name: string;
  user_last_name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The registration row to be cancelled. Null while the modal is closed. */
  registration: RegistrationInfo | null;
  project: Project;
  /**
   * Called after a successful cancellation with the ID of the cancelled
   * registration, so the parent can update local state.
   */
  onCancelled: (_registrationId: number) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CancelGuestRegistrationModal({
  open,
  onClose,
  registration,
  project,
  onCancelled,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });
  const token = new Cookies().get("auth_token");

  const [message, setMessage] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form every time the modal opens.
  useEffect(() => {
    if (open) {
      setMessage("");
      setCancelling(false);
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!registration) return;

    setCancelling(true);
    setError(null);

    try {
      const trimmedMessage = message.trim();
      await apiRequest({
        method: "patch",
        url: `/api/projects/${project.url_slug}/registrations/${registration.id}/`,
        payload: trimmedMessage ? { message: trimmedMessage } : {},
        token,
        locale,
      });
      onCancelled(registration.id);
      onClose();
    } catch (err: any) {
      const data = err?.response?.data;
      const errorMessage =
        data?.detail ??
        (Array.isArray(data?.non_field_errors) ? data.non_field_errors[0] : null) ??
        String(err?.message ?? texts.error_loading_registrations);
      setError(errorMessage);
    } finally {
      setCancelling(false);
    }
  };

  const guestName = registration
    ? `${registration.user_first_name} ${registration.user_last_name}`.trim()
    : "";
  const eventTitle = String(project.name ?? "");

  const confirmText = (texts.cancel_guest_registration_confirm as string)
    .replace("{name}", guestName)
    .replace("{event}", eventTitle);

  return (
    <GenericDialog
      open={open}
      onClose={onClose}
      title={texts.cancel_guest_registration as string}
      maxWidth="sm"
    >
      <ConfirmText>{confirmText}</ConfirmText>

      <MessageField
        fullWidth
        multiline
        minRows={3}
        variant="outlined"
        label={texts.message_to_guest_optional as string}
        placeholder={texts.cancellation_message_placeholder as string}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={cancelling}
        aria-label={texts.message_to_guest_optional as string}
        inputProps={{ maxLength: 1000 }}
        helperText={`${message.length} / 1000`}
      />

      {error && <ErrorText role="alert">{error}</ErrorText>}

      <ActionRow>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={cancelling}
          aria-label={texts.keep_registration as string}
        >
          {texts.keep_registration as string}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={cancelling}
          startIcon={cancelling ? <CircularProgress size={16} color="inherit" /> : undefined}
          aria-label={texts.yes_cancel_registration as string}
        >
          {cancelling
            ? `${texts.yes_cancel_registration}…`
            : (texts.yes_cancel_registration as string)}
        </Button>
      </ActionRow>
    </GenericDialog>
  );
}

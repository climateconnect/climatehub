import { styled } from "@mui/material/styles";
import React, { useContext, useEffect, useState } from "react";
import { Alert, Box, CircularProgress, IconButton, Typography } from "@mui/material";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ArrowBack from "@mui/icons-material/ArrowBack";

const Header = styled(Typography)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(4),
    paddingBottom: theme.spacing(2),
    textAlign: "center",
    fontSize: 35,
    fontWeight: "bold",
  },
}));

interface AuthForgotPasswordProps {
  email: string;
  onBack: () => void;
  hubUrl?: string;
}

type Status = "loading" | "success" | "error";

export default function AuthForgotPassword({ email, onBack, hubUrl }: AuthForgotPasswordProps) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "profile", locale, hubName: hubUrl });
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiRequest({
      method: "post",
      url: "/api/send_reset_password_email/",
      payload: { email },
      locale,
    })
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch((err: any) => {
        if (!cancelled) {
          setErrorMessage(
            err.response?.data?.message ||
              texts.server_error ||
              "Something went wrong. Please try again."
          );
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
    // Run once on mount — email is stable for the lifetime of this step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <IconButton aria-label="go back" onClick={onBack} size="small" style={{ marginRight: 8 }}>
          <ArrowBack />
        </IconButton>
        <Header variant="h1">{texts.reset_password}</Header>
      </div>

      {status === "loading" && (
        <Box display="flex" alignItems="center" gap={2} style={{ marginTop: 32, marginBottom: 32 }}>
          <CircularProgress size={24} />
          <Typography variant="body1">
            {(texts.sending_reset_link || "Sending a reset link to {email}…").replace(
              "{email}",
              email
            )}
          </Typography>
        </Box>
      )}

      {status === "success" && (
        <Box style={{ marginTop: 24, marginBottom: 24 }}>
          <Box display="flex" alignItems="center" gap={1} style={{ marginBottom: 12 }}>
            <MarkEmailReadOutlinedIcon color="primary" />
            <Typography variant="body1" style={{ fontWeight: 500 }}>
              {texts.check_your_inbox || "Check your inbox"}
            </Typography>
          </Box>
          <Typography variant="body2" color="textSecondary">
            {(
              texts.reset_link_sent_to ||
              "We've sent a password reset link to {email}. Follow the link in the email to set a new password."
            ).replace("{email}", email)}
          </Typography>
        </Box>
      )}

      {status === "error" && (
        <Alert severity="error" role="alert" style={{ marginTop: 16, marginBottom: 16 }}>
          {errorMessage}
        </Alert>
      )}
    </>
  );
}

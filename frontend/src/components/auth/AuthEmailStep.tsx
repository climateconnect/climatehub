import { styled } from "@mui/material/styles";
import React, { useContext, useState } from "react";
import { Alert, Button, CircularProgress, IconButton, TextField, Typography } from "@mui/material";
import Close from "@mui/icons-material/Close";
import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { trackAuthEvent } from "../../utils/analytics";
import RequiredFieldsNotice from "../general/RequiredFieldsNotice";

interface AuthEmailStepProps {
  onUserStatusDetermined: (
    _status: "new" | "returning_password" | "returning_otp",
    _email: string
  ) => void;
  hubUrl?: string;
  showHeader?: boolean;
}

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

const NoticeWrapper = styled(RequiredFieldsNotice)(({ theme }) => ({
  display: "block",
  marginBottom: theme.spacing(1),
}));

export default function AuthEmailStep({
  onUserStatusDetermined,
  hubUrl,
  showHeader = true,
}: AuthEmailStepProps) {
  const { locale, ReactGA } = useContext(UserContext);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const texts = getTexts({ page: "profile", locale: locale, hubName: hubUrl });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    // Reset any existing auth session to ensure fresh flow
    sessionStorage.removeItem("auth_session_key");

    const normalizedEmail = email.toLowerCase().trim();

    try {
      const response = await apiRequest({
        method: "post",
        url: "/api/auth/check-email",
        payload: { email: normalizedEmail },
        locale: locale,
      });

      trackAuthEvent(
        "auth_email_entered",
        { locale, hub_slug: hubUrl, user_status: response.data.user_status },
        ReactGA
      );
      onUserStatusDetermined(response.data.user_status, normalizedEmail);
    } catch (err: any) {
      let errorType = "network";
      if (err.response?.status === 429) {
        errorType = "rate_limit";
      } else if (err.response?.status >= 500) {
        errorType = "server_error";
      } else if (err.response?.data?.email) {
        errorType = "validation";
      }

      trackAuthEvent(
        "auth_email_error",
        { locale, hub_slug: hubUrl, error_type: errorType },
        ReactGA
      );

      if (err.response?.data?.detail) {
        setErrorMessage(err.response.data.detail);
      } else if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else if (err.response?.data?.email) {
        // Field-level validation error from Django (e.g. {"email": ["Enter a valid email address."]})
        const emailErrors = err.response.data.email;
        setErrorMessage(Array.isArray(emailErrors) ? emailErrors[0] : emailErrors);
      } else {
        setErrorMessage(texts.server_error || "Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {showHeader && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <IconButton aria-label="close" onClick={() => window.history.back()} size="small">
              <Close />
            </IconButton>
          </div>
          <Header variant="h1">{texts.welcome_to_climate_connect}</Header>
        </>
      )}

      <Typography variant="body1" style={{ marginBottom: 24 }}>
        {texts.welcome_to_climate_connect_subtitle}
      </Typography>

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          id="auth-email-input"
          label={texts.email || "Email"}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          autoComplete="email"
          aria-label={texts.email || "Email address"}
          disabled={isLoading}
          style={{ marginBottom: 16 }}
        />
        <NoticeWrapper />

        {errorMessage && (
          <Alert severity="error" role="alert" style={{ marginBottom: 16 }}>
            {errorMessage}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isLoading || !email.trim()}
          aria-busy={isLoading}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : texts.next || "Next"}
        </Button>
      </form>
    </>
  );
}

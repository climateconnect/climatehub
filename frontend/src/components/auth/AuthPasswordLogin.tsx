import { styled } from "@mui/material/styles";
import React, { useContext, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { trackAuthEvent } from "../../utils/analytics";

interface AuthPasswordLoginProps {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
  onForgotPassword: () => void;
  onSwitchToOtp: () => void;
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

export default function AuthPasswordLogin({
  email,
  onBack,
  onSuccess,
  onForgotPassword,
  onSwitchToOtp,
  hubUrl,
  showHeader = true,
}: AuthPasswordLoginProps) {
  const { locale, signIn, ReactGA } = useContext(UserContext);
  const texts = getTexts({ page: "profile", locale: locale, hubName: hubUrl });

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<React.ReactNode | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setErrorMessage(texts.please_enter_your_password || "Please enter your password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest({
        method: "post",
        url: "/login/",
        payload: { username: email.toLowerCase(), password },
        locale: locale,
      });
      trackAuthEvent("auth_password_entered", { locale, hub_slug: hubUrl }, ReactGA);
      await signIn(response.data.token, response.data.expiry);
      trackAuthEvent(
        "auth_completed",
        { locale, hub_slug: hubUrl, auth_type: "password", user_type: "returning" },
        ReactGA
      );
      onSuccess();
    } catch (err: any) {
      setPassword("");
      let failureReason: string;
      if (err.response?.data?.type === "not_verified") {
        failureReason = "not_verified";
        setErrorMessage(texts.not_verified_error_message);
      } else if (err.response?.status === 429) {
        failureReason = "rate_limit";
        setErrorMessage(texts.too_many_attempts || "Too many attempts. Please try again later.");
      } else if (err.response?.data?.message) {
        failureReason = "invalid_credentials";
        setErrorMessage(err.response.data.message);
      } else {
        failureReason = "network";
        setErrorMessage(texts.server_error || "Something went wrong. Please try again.");
      }
      trackAuthEvent(
        "auth_password_failed",
        { locale, hub_slug: hubUrl, failure_reason: failureReason },
        ReactGA
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <IconButton aria-label="go back" onClick={onBack} size="small" style={{ marginRight: 8 }}>
            <ArrowBack />
          </IconButton>
          <Header variant="h1">{texts.log_in}</Header>
        </div>
      )}

      <Typography variant="body1" style={{ marginBottom: 24 }}>
        {texts.enter_password}
      </Typography>

      <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
        <TextField
          label={texts.password || "Password"}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          autoComplete="current-password"
          inputProps={{ "aria-label": texts.password || "Password" }}
          disabled={isLoading}
          style={{ marginBottom: 16 }}
          autoFocus
        />

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
          disabled={isLoading}
          aria-busy={isLoading}
          style={{ marginBottom: 12 }}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : texts.log_in || "Log in"}
        </Button>
      </form>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        style={{ marginBottom: 16 }}
      >
        <Button
          variant="text"
          size="small"
          onClick={() => {
            trackAuthEvent("auth_password_forgot_clicked", { locale, hub_slug: hubUrl }, ReactGA);
            onForgotPassword();
          }}
          disabled={isLoading}
        >
          {texts.forgot_your_password || "Forgot your password?"}
        </Button>

        <Button
          variant="text"
          size="small"
          onClick={() => {
            trackAuthEvent("auth_switch_to_otp_clicked", { locale, hub_slug: hubUrl }, ReactGA);
            onSwitchToOtp();
          }}
          disabled={isLoading}
        >
          {texts.use_a_code_instead || "Use a code instead"}
        </Button>
      </Box>
    </>
  );
}

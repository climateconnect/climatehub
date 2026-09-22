import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { useContext, useRef, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import LocationSearchBar from "../search/LocationSearchBar";
import { isLocationValid } from "../../../public/lib/locationOperations";
import { trackAuthEvent } from "../../utils/analytics";
import makeStyles from "@mui/styles/makeStyles";
import RequiredFieldsNotice from "../general/RequiredFieldsNotice";

interface SignupPersonalInfoStepProps {
  email: string;
  onContinue: (_data: {
    first_name: string;
    last_name: string;
    location: any;
    send_newsletter: boolean;
  }) => void;
  onBack: () => void;
  hubUrl?: string;
  isLoading?: boolean;
  showHeader?: boolean;
  isEventSignup?: boolean;
}

const useStyles = makeStyles((theme) => ({
  header: {
    color: theme.palette.background.default_contrastText,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(4),
      paddingBottom: theme.spacing(2),
      textAlign: "center",
      fontSize: 35,
      fontWeight: "bold",
    },
  },
  requiredFieldsNotice: {
    display: "block",
    marginBottom: theme.spacing(3),
  },
}));

export default function SignupPersonalInfoStep({
  email,
  onContinue,
  onBack,
  hubUrl,
  isLoading = false,
  showHeader = true,
  isEventSignup = false,
}: SignupPersonalInfoStepProps) {
  const { locale, ReactGA } = useContext(UserContext);
  const texts = getTexts({ page: "profile", locale: locale, hubName: hubUrl });
  const classes = useStyles();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState<any>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [locationOptionsOpen, setLocationOptionsOpen] = useState(false);

  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    location?: string;
    terms?: string;
  }>({});

  // Track field interactions only once per session to avoid flooding GA4
  const trackedFields = useRef<Set<string>>(new Set());

  const locationInputRef = useRef(null);

  const trackFieldEvent = (
    eventName: "auth_signup_field_focused" | "auth_signup_field_filled" | "auth_signup_field_error",
    fieldName: string
  ) => {
    const key = `${eventName}_${fieldName}`;
    if (trackedFields.current.has(key)) return;
    trackedFields.current.add(key);

    trackAuthEvent(
      eventName,
      { locale, hub_slug: hubUrl, field_name: fieldName, step: "personal_info" },
      ReactGA
    );
  };

  const handleFirstNameChange = (value: string) => {
    setFirstName(value);
    if (errors.firstName) {
      setErrors({ ...errors, firstName: undefined });
    }
    if (value.trim()) {
      trackFieldEvent("auth_signup_field_filled", "first_name");
    }
  };

  const handleLastNameChange = (value: string) => {
    setLastName(value);
    if (errors.lastName) {
      setErrors({ ...errors, lastName: undefined });
    }
    if (value.trim()) {
      trackFieldEvent("auth_signup_field_filled", "last_name");
    }
  };

  const handleLocationChange = (newLocation: any) => {
    setLocation(newLocation);
    if (errors.location) {
      setErrors({ ...errors, location: undefined });
    }
    if (isLocationValid(newLocation)) {
      trackFieldEvent("auth_signup_field_filled", "location");
    }
  };

  const handleTermsChange = (checked: boolean) => {
    setTermsAccepted(checked);
    if (errors.terms) {
      setErrors({ ...errors, terms: undefined });
    }
    if (checked) {
      trackFieldEvent("auth_signup_field_filled", "terms");
    }
  };

  const handleContinue = () => {
    const newErrors: typeof errors = {};

    // Validate required fields
    if (!firstName.trim()) {
      newErrors.firstName = texts.first_name_is_required;
      trackFieldEvent("auth_signup_field_error", "first_name");
    }
    if (!lastName.trim()) {
      newErrors.lastName = texts.last_name_is_required;
      trackFieldEvent("auth_signup_field_error", "last_name");
    }
    if (!isLocationValid(location)) {
      newErrors.location = texts.please_choose_one_of_the_location_options;
      trackFieldEvent("auth_signup_field_error", "location");
    }
    if (!termsAccepted) {
      newErrors.terms = texts.you_must_accept_terms_and_privacy_policy;
      trackFieldEvent("auth_signup_field_error", "terms");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    trackAuthEvent("auth_signup_personal_info_submitted", { locale, hub_slug: hubUrl }, ReactGA);

    // All valid - proceed
    onContinue({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      location: location,
      send_newsletter: true, // Both set to true when combined checkbox is checked
    });
  };

  const headlineText = isEventSignup
    ? texts.event_signup_step_1_headline
    : texts.signup_step_1_headline;

  return (
    <Box>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <IconButton aria-label="go back" onClick={onBack} size="small" style={{ marginRight: 8 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h1" className={classes.header}>
            {texts.create_your_account}
          </Typography>
        </div>
      )}

      <Typography variant="body1" sx={{ mb: 2 }}>
        {headlineText}
      </Typography>
      <RequiredFieldsNotice className={classes.requiredFieldsNotice} />

      {/* Email field - read-only */}
      <TextField
        fullWidth
        label={texts.email}
        value={email}
        disabled
        sx={{ mb: 2 }}
        helperText={texts.email_cannot_be_changed}
      />

      {/* First name */}
      <TextField
        fullWidth
        required
        label={texts.first_name}
        value={firstName}
        onFocus={() => trackFieldEvent("auth_signup_field_focused", "first_name")}
        onChange={(e) => handleFirstNameChange(e.target.value)}
        error={!!errors.firstName}
        helperText={errors.firstName}
        sx={{ mb: 2 }}
      />

      {/* Last name */}
      <TextField
        fullWidth
        required
        label={texts.last_name}
        value={lastName}
        onFocus={() => trackFieldEvent("auth_signup_field_focused", "last_name")}
        onChange={(e) => handleLastNameChange(e.target.value)}
        error={!!errors.lastName}
        helperText={errors.lastName}
        sx={{ mb: 2 }}
      />

      {/* Location */}
      <LocationSearchBar
        label={texts.location}
        required
        value={location}
        onChange={handleLocationChange}
        onSelect={handleLocationChange}
        locationInputRef={locationInputRef}
        open={locationOptionsOpen}
        handleSetOpen={setLocationOptionsOpen}
      />
      {errors.location && (
        <FormHelperText error sx={{ mt: 0.5, mb: 2 }}>
          {errors.location}
        </FormHelperText>
      )}

      {/* Combined terms + newsletter checkbox */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={termsAccepted}
              onChange={(e) => handleTermsChange(e.target.checked)}
              color="primary"
            />
          }
          label={
            <Typography variant="body2">
              {texts.agree_to_tos_and_privacy_policy_with_email_consent}
            </Typography>
          }
        />
        {errors.terms && (
          <FormHelperText error sx={{ ml: 0 }}>
            {errors.terms}
          </FormHelperText>
        )}
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: "flex", gap: 2, mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleContinue}
          sx={{ flex: 1 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : texts.continue}
        </Button>
      </Box>
    </Box>
  );
}

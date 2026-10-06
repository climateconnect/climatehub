import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import Cookies from "universal-cookie";

import { apiRequest } from "../../../public/lib/apiOperations";
import { getDateTime, getDateTimeRange } from "../../../public/lib/dateOperations";
import getTexts from "../../../public/texts/texts";
import { Project, RegistrationFieldAnswerValue } from "../../types";
import UserContext from "../context/UserContext";
import { trackGA4Event } from "../../utils/analytics";
import MiniProfilePreview from "../profile/MiniProfilePreview";
import AuthEmailStep from "../auth/AuthEmailStep";
import AuthPasswordLogin from "../auth/AuthPasswordLogin";
import AuthOtp from "../auth/AuthOtp";
import AuthSignupStep from "../auth/AuthSignupStep";
import RegistrationFieldAnswersForm, {
  RegistrationFieldAnswersFormHandle,
} from "./RegistrationFieldAnswersForm";

type RegistrationClosedState = {
  title: string;
  message: string;
} | null;

function getRegistrationClosedState(
  status: string | undefined,
  texts: any
): RegistrationClosedState {
  if (status === "full" || status === "closed") {
    return {
      title: texts.event_is_fully_booked,
      message: texts.event_is_fully_booked_message,
    };
  }
  if (status === "ended") {
    return {
      title: texts.registration_period_has_ended,
      message: texts.registration_period_has_ended_message,
    };
  }
  return null;
}

const StyledDialogTitle = styled(DialogTitle)({
  display: "flex",
  alignItems: "center",
});

const CloseButton = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(-1),
  marginRight: theme.spacing(1),
  color: theme.palette.grey[500],
}));

const TitleText = styled(Typography)(({ theme }) => ({
  fontSize: 20,
  color: theme.palette.text.primary,
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2),
  paddingTop: 0,
}));

const ModalContent = styled("div")({
  display: "flex",
  flexDirection: "column",
});

const EventSubheader = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  color: theme.palette.text.secondary,
}));

const EventDateLine = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
}));

const FormContainer = styled("div")({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
});

const UserInfo = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const ProfilePreview = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const ConfirmationMessage = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  fontWeight: 500,
}));

const SuccessIcon = styled(CheckCircleOutlineIcon)(({ theme }) => ({
  fontSize: 64,
  color: theme.palette.success.main,
  marginBottom: theme.spacing(2),
}));

const ErrorIcon = styled(ErrorOutlineIcon)(({ theme }) => ({
  fontSize: 64,
  color: theme.palette.error.main,
  marginBottom: theme.spacing(2),
}));

const ErrorText = styled(Typography)(({ theme }) => ({
  color: theme.palette.error.main,
  marginTop: theme.spacing(2),
}));

const ConfirmationContainer = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(3),
  textAlign: "center",
}));

const ConfirmationText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

const ClosedIcon = styled(EventBusyIcon)(({ theme }) => ({
  fontSize: 64,
  color: theme.palette.warning.main,
  marginBottom: theme.spacing(2),
}));

const ClosedTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  textAlign: "center",
}));

const ClosedMessage = styled(Typography)(({ theme }) => ({
  textAlign: "center",
  color: theme.palette.text.secondary,
}));

const HelperText = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  paddingLeft: theme.spacing(1),
}));

const RegisterButton = styled(Button)({
  whiteSpace: "nowrap",
});

const CustomFieldsScrollable = styled("div")(({ theme }) => ({
  overflowY: "auto",
  flex: 1,
  paddingRight: theme.spacing(0.5),
  marginBottom: theme.spacing(2),
}));

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
  onRegistrationSuccess?: () => void;
};

type RegistrationState = "initial" | "success" | "error";

export default function EventRegistrationModal({
  open,
  onClose,
  project,
  onRegistrationSuccess,
}: Props) {
  const { locale, user, ReactGA } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale, project });
  const cookies = new Cookies();
  const token = cookies.get("auth_token");

  const [state, setState] = useState<RegistrationState>("initial");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  // Per-field server-side errors, keyed by field ID
  const [fieldServerErrors, setFieldServerErrors] = useState<Record<number, string>>({});

  // Ref to the custom fields form so we can call validate() on submit
  const answersFormRef = useRef<RegistrationFieldAnswersFormHandle>(null);

  // Authentication flow state
  const [email, setEmail] = useState("");
  const [authStep, setAuthStep] = useState<"email" | "password" | "otp" | "signup">("email");
  const [isNewUserOtp, setIsNewUserOtp] = useState(false);

  // Track whether confirm_shown has already fired for this modal session
  const confirmShownFiredRef = useRef(false);
  // Track whether custom fields interaction has fired for this modal session
  const customFieldsFiredRef = useRef(false);

  const showCustomFields = (project.registration_config?.fields?.length ?? 0) > 0;
  const hasRequiredCustomFields =
    showCustomFields &&
    (project.registration_config?.fields?.some((field) => field.is_required) ?? false);

  const eventDateText =
    project.start_date && project.end_date
      ? getDateTimeRange(project.start_date, project.end_date, locale)
      : project.start_date
      ? getDateTime(project.start_date)
      : null;

  // Fire event_registration_confirm_shown when authenticated user sees confirmation step
  useEffect(() => {
    if (open && user && state === "initial" && !confirmShownFiredRef.current) {
      confirmShownFiredRef.current = true;
      trackGA4Event("event_registration_confirm_shown", { event_slug: project.url_slug }, ReactGA);
    }
  }, [open, user, state, project.url_slug, ReactGA]);

  // Reset tracking refs when modal closes
  useEffect(() => {
    if (!open) {
      confirmShownFiredRef.current = false;
      customFieldsFiredRef.current = false;
    }
  }, [open]);

  const handleCustomFieldsFirstInteraction = useCallback(() => {
    if (!customFieldsFiredRef.current) {
      customFieldsFiredRef.current = true;
      trackGA4Event(
        "event_registration_custom_fields_started",
        {
          event_slug: project.url_slug,
          field_count: project.registration_config?.fields?.length ?? 0,
        },
        ReactGA
      );
    }
  }, [project.url_slug, project.registration_config?.fields?.length, ReactGA]);

  // Render the appropriate content based on authentication and registration state
  const renderContent = () => {
    // Show success/error states regardless of authentication
    if (state === "success") {
      return renderSuccessContent();
    }
    if (state === "error") {
      return renderErrorContent();
    }

    // Show informational message when user is already registered
    if (user && project.my_event_registration && !project.my_event_registration.cancelled_at) {
      return renderRegistrationClosedContent({
        title: texts.already_registered_for_event,
        message: texts.already_registered_for_event_message,
      });
    }

    // Show informational message when registration is not open
    const closedState = getRegistrationClosedState(project.registration_config?.status, texts);
    if (closedState) {
      return renderRegistrationClosedContent(closedState);
    }

    // Show registration form for authenticated users
    if (user) {
      return renderAuthenticatedContent();
    }

    // Show authentication flow for unauthenticated users
    return renderUnauthenticatedContent();
  };

  const handleRegister = async () => {
    if (!user) return;

    // Fire event_registration_confirmed before API call
    trackGA4Event(
      "event_registration_confirmed",
      {
        event_slug: project.url_slug,
        available_seats_at_click: project.registration_config?.available_seats ?? null,
      },
      ReactGA
    );

    // Validate custom fields if present
    let answers: RegistrationFieldAnswerValue[] | null = [];
    if (showCustomFields && answersFormRef.current) {
      answers = answersFormRef.current.validate();
      if (answers === null) {
        // Validation failed — errors are shown inline
        return;
      }
    }

    setLoading(true);
    setErrorMessage("");
    setFieldServerErrors({});

    // Build the API payload
    const payload: {
      answers?: {
        field: number;
        value_boolean?: boolean;
        value_option?: number;
        value_number?: number;
        value_text?: string;
      }[];
    } = {};
    if (showCustomFields && answers && answers.length > 0) {
      payload.answers = answers.map((a) => {
        const entry: {
          field: number;
          value_boolean?: boolean;
          value_option?: number;
          value_number?: number;
          value_text?: string;
        } = {
          field: a.fieldId,
        };
        if (a.valueBoolean !== undefined) entry.value_boolean = a.valueBoolean;
        if (a.valueOption !== undefined) entry.value_option = a.valueOption;
        if (a.valueNumber !== undefined) entry.value_number = a.valueNumber;
        if (a.valueText !== undefined) entry.value_text = a.valueText;
        return entry;
      });
    }

    try {
      const response = await apiRequest({
        method: "post",
        url: `/api/projects/${project.url_slug}/registrations/`,
        payload,
        token: token,
        locale: locale,
      });

      if (response.status === 200 || response.status === 201) {
        setState("success");
        trackGA4Event(
          "event_registration_success",
          { event_slug: project.url_slug, user_type: "authenticated" },
          ReactGA
        );
        if (onRegistrationSuccess) {
          onRegistrationSuccess();
        }
      }
    } catch (error: any) {
      // Try to map field-specific errors from the server response
      const responseData = error?.response?.data;
      if (responseData?.field_errors && typeof responseData.field_errors === "object") {
        setFieldServerErrors(responseData.field_errors);
        // Also surface a top-level message so the user knows what happened
        setErrorMessage(responseData.message || texts.registration_failed_please_try_again);
        // Stay on "initial" so the user can correct the field errors
        return;
      }
      setState("error");
      setErrorMessage(responseData?.message || texts.registration_failed_please_try_again);

      // Determine error type for analytics
      let errorType: "network" | "full" | "closed" | "ended" | "server_error" = "server_error";
      if (responseData?.error_type === "full" || responseData?.detail?.includes("full")) {
        errorType = "full";
      } else if (
        responseData?.error_type === "closed" ||
        responseData?.detail?.includes("closed")
      ) {
        errorType = "closed";
      } else if (responseData?.error_type === "ended" || responseData?.detail?.includes("ended")) {
        errorType = "ended";
      } else if (!error?.response) {
        errorType = "network";
      }
      trackGA4Event(
        "event_registration_error",
        { error_type: errorType, event_slug: project.url_slug },
        ReactGA
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusDetermined = (
    status: "new" | "returning_password" | "returning_otp",
    determinedEmail: string
  ) => {
    setEmail(determinedEmail);

    // Fire event_registration_auth_started (guest submits email in modal)
    trackGA4Event(
      "event_registration_auth_started",
      { event_slug: project.url_slug, entry_method: "register_button" },
      ReactGA
    );

    if (status === "new") {
      setAuthStep("signup");
      trackGA4Event(
        "event_registration_auth_method_selected",
        { auth_path: "signup", event_slug: project.url_slug },
        ReactGA
      );
    } else if (status === "returning_password") {
      setAuthStep("password");
      trackGA4Event(
        "event_registration_auth_method_selected",
        { auth_path: "password", event_slug: project.url_slug },
        ReactGA
      );
    } else if (status === "returning_otp") {
      setIsNewUserOtp(false);
      setAuthStep("otp");
      trackGA4Event(
        "event_registration_auth_method_selected",
        { auth_path: "otp", event_slug: project.url_slug },
        ReactGA
      );
    }
  };

  const handleClose = () => {
    // Fire auth_abandoned if modal is closed during auth flow (not on email step)
    if (user === null && authStep !== "email") {
      trackGA4Event(
        "event_registration_auth_abandoned",
        { auth_step: authStep, event_slug: project.url_slug },
        ReactGA
      );
    }
    // Fire cancelled if modal is closed during confirm step (authenticated user)
    if (user && state === "initial") {
      trackGA4Event(
        "event_registration_cancelled",
        { step: "confirm", user_type: "authenticated" },
        ReactGA
      );
    }

    setState("initial");
    setErrorMessage("");
    setFieldServerErrors({});
    setEmail("");
    setAuthStep("email");
    onClose();
  };

  const renderAuthenticatedContent = () => (
    <FormContainer>
      <UserInfo>
        <ProfilePreview>
          <MiniProfilePreview
            profile={{ ...user, thumbnail_image: (user as any)?.image }}
            size="medium"
            nolink
          />
        </ProfilePreview>
        <ConfirmationMessage variant="body1">
          {showCustomFields
            ? texts.fill_the_form_and_confirm_your_registration_for
            : texts.confirm_your_registration_for}
        </ConfirmationMessage>
      </UserInfo>

      {showCustomFields && (
        <CustomFieldsScrollable>
          <RegistrationFieldAnswersForm
            ref={answersFormRef}
            fields={project.registration_config!.fields!}
            serverErrors={fieldServerErrors}
            onFirstInteraction={handleCustomFieldsFirstInteraction}
            texts={{
              this_field_is_required: texts.this_field_is_required,
              you_must_check_this_box: texts.you_must_check_this_box,
              please_select_an_option: texts.please_select_an_option,
              please_select_inventory_option: texts.please_select_inventory_option,
              please_enter_quantity: texts.please_enter_quantity,
              quantity_available: texts.quantity_available,
              max_per_guest: texts.max_per_guest,
              quantity_exceeds_max: texts.quantity_exceeds_max,
              inventory_sold_out: texts.inventory_sold_out,
              please_select_time_slot: texts.please_select_time_slot,
              seats_available: texts.seats_available,
              registration_text_field_required_error: texts.registration_text_field_required_error,
              registration_text_field_max_length_error:
                texts.registration_text_field_max_length_error,
            }}
          />
        </CustomFieldsScrollable>
      )}

      {hasRequiredCustomFields && (
        <HelperText variant="caption" color="textSecondary">
          {texts.required_fields_participation_notice}
        </HelperText>
      )}

      {errorMessage && <ErrorText variant="body2">{errorMessage}</ErrorText>}
    </FormContainer>
  );

  const renderUnauthenticatedContent = () => {
    switch (authStep) {
      case "email":
        return (
          <AuthEmailStep
            onUserStatusDetermined={handleUserStatusDetermined}
            hubUrl={project.hubUrl}
            showHeader={false}
          />
        );
      case "password":
        return (
          <AuthPasswordLogin
            email={email}
            onBack={() => setAuthStep("email")}
            onSuccess={() => {
              trackGA4Event(
                "event_registration_auth_completed",
                { auth_path: "password", event_slug: project.url_slug },
                ReactGA
              );
            }}
            onForgotPassword={() => {
              // Return to email entry; forgot-password flow is not supported inside the modal.
              setAuthStep("email");
            }}
            onSwitchToOtp={() => {
              setIsNewUserOtp(false);
              setAuthStep("otp");
            }}
            hubUrl={project.hubUrl}
            showHeader={false}
          />
        );
      case "otp":
        return (
          <AuthOtp
            email={email}
            onBack={() => setAuthStep("email")}
            onSuccess={() => {
              trackGA4Event(
                "event_registration_auth_completed",
                { auth_path: "otp", event_slug: project.url_slug },
                ReactGA
              );
            }}
            hubUrl={project.hubUrl}
            showHeader={false}
            userType={isNewUserOtp ? "new" : "returning"}
          />
        );
      case "signup":
        return (
          <AuthSignupStep
            email={email}
            onBack={() => setAuthStep("email")}
            onSignupComplete={() => {
              trackGA4Event(
                "event_registration_auth_completed",
                { auth_path: "signup", event_slug: project.url_slug },
                ReactGA
              );
              setIsNewUserOtp(true);
              setAuthStep("otp");
            }}
            hubUrl={project.hubUrl}
            skipInterests={true}
            showHeader={false}
            isEventSignup={true}
          />
        );
      default:
        return null;
    }
  };

  const renderSuccessContent = () => (
    <ConfirmationContainer>
      <SuccessIcon />
      <Typography variant="h6">{texts.youre_registered}</Typography>
      <ConfirmationText variant="body1">
        {texts.a_confirmation_email_has_been_sent}
      </ConfirmationText>
    </ConfirmationContainer>
  );

  const renderErrorContent = () => (
    <ConfirmationContainer>
      <ErrorIcon />
      <Typography variant="h6">{texts.registration_failed}</Typography>
      {errorMessage && <ErrorText variant="body1">{errorMessage}</ErrorText>}
    </ConfirmationContainer>
  );

  const renderRegistrationClosedContent = ({
    title,
    message,
  }: {
    title: string;
    message: string;
  }) => (
    <ConfirmationContainer>
      <ClosedIcon />
      <ClosedTitle variant="h6">{title}</ClosedTitle>
      <ClosedMessage variant="body1">{message}</ClosedMessage>
    </ConfirmationContainer>
  );

  const renderActions = () => {
    if (state === "success") {
      return (
        <Button onClick={handleClose} variant="contained" color="primary">
          {texts.close}
        </Button>
      );
    }
    if (state === "error") {
      return (
        <>
          <Button onClick={handleClose} variant="outlined">
            {texts.close}
          </Button>
          <Button onClick={() => setState("initial")} variant="contained" color="primary">
            {texts.try_again}
          </Button>
        </>
      );
    }

    const closedState = getRegistrationClosedState(project.registration_config?.status, texts);
    if (
      closedState ||
      (user && project.my_event_registration && !project.my_event_registration.cancelled_at)
    ) {
      return (
        <Button onClick={handleClose} variant="contained" color="primary">
          {texts.close}
        </Button>
      );
    }

    if (user) {
      return (
        <RegisterButton
          onClick={handleRegister}
          variant="contained"
          color="primary"
          disabled={loading}
          fullWidth
        >
          {loading ? <CircularProgress size={24} /> : texts.confirm_registration}
        </RegisterButton>
      );
    }
    // Unauthenticated auth-flow steps have their own submit buttons
    return null;
  };

  const actions = renderActions();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      closeAfterTransition={false}
    >
      <StyledDialogTitle>
        <CloseButton aria-label="close" onClick={handleClose}>
          <CloseIcon />
        </CloseButton>
        <TitleText>{texts.register_for_event}</TitleText>
      </StyledDialogTitle>

      <StyledDialogContent dividers>
        <ModalContent>
          {(project.name || eventDateText) && (
            <EventSubheader>
              {project.name && <Typography variant="body2">{project.name}</Typography>}
              {eventDateText && <EventDateLine variant="body2">{eventDateText}</EventDateLine>}
            </EventSubheader>
          )}
          {renderContent()}
        </ModalContent>
      </StyledDialogContent>

      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

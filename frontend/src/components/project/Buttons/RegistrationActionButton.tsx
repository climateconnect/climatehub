import React, { useContext, useEffect } from "react";
import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Project } from "../../../types";
import {
  RegistrationUIState,
  getRegisterButtonText,
  isRegisterButtonDisabled,
} from "../../../utils/eventRegistrationHelpers";
import UserContext from "../../context/UserContext";
import { trackGA4Event } from "../../../utils/analytics";

const RegistrationButtonContainer = styled("span")({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
});

const SeatsText = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  fontSize: 15,
  textAlign: "center",
  marginTop: theme.spacing(0.5),
}));

const SeatsNumber = styled("span")({
  fontWeight: 700,
});

interface RegistrationActionButtonProps {
  registrationState: RegistrationUIState;
  project: Project;
  texts: any;
  isUserRegistered?: boolean;
  handleRegisterClick?: () => void;
  onModifyRegistrationClick?: () => void;
  className?: string;
  /** Rendered when registrationState is "hidden" (no registration config / feature off). */
  fallback?: React.ReactNode;
  /** Whether to show available seats count below the button (like FollowButton pattern) */
  showSeatsCount?: boolean;
  /** Current event registration data (for real-time updates) */
  eventRegistration?: { available_seats: number | null; max_participants: number | null } | null;
  /** Where the button is rendered (for analytics impression tracking). */
  analyticsSurface?: "event_page" | "browse_card" | "similar_projects_sidebar";
}

/**
 * Renders the correct registration button/label for a given UI state.
 * Used by both ProjectOverview (desktop) and ProjectInteractionButtons (mobile)
 * to avoid duplicating the state-switch logic.
 */
export default function RegistrationActionButton({
  registrationState,
  project,
  texts,
  isUserRegistered,
  handleRegisterClick,
  onModifyRegistrationClick,
  className,
  fallback = null,
  showSeatsCount = false,
  eventRegistration,
  analyticsSurface,
}: RegistrationActionButtonProps) {
  const { ReactGA } = useContext(UserContext);

  // Fire button impression event on mount
  useEffect(() => {
    if (analyticsSurface && registrationState !== "hidden" && registrationState !== "attended") {
      trackGA4Event(
        "event_registration_button_impression",
        {
          surface: analyticsSurface,
          event_slug: project.url_slug,
          registration_status: project.registration_config?.status ?? "open",
        },
        ReactGA
      );
    }
    // Only fire on mount — intentionally not tracking re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use eventRegistration if provided (for real-time updates), otherwise fall back to project.registration_config
  const registrationData = eventRegistration ?? project.registration_config;
  const availableSeats = registrationData?.available_seats ?? null;
  const maxParticipants = registrationData?.max_participants ?? null;
  const shouldShowSeats =
    showSeatsCount &&
    registrationState === "register" &&
    availableSeats !== null &&
    maxParticipants !== null;

  const renderButton = () => {
    if (registrationState === "attended") {
      return null;
    }

    if (registrationState === "cancel") {
      return (
        <Button
          variant="outlined"
          color="secondary"
          onClick={onModifyRegistrationClick}
          className={className}
        >
          {texts.modify_registration}
        </Button>
      );
    }

    if (registrationState === "adminClosed") {
      return (
        <Button variant="outlined" color="secondary" disabled className={className}>
          {texts.booked_out}
        </Button>
      );
    }

    if (registrationState === "register" || registrationState === "closed") {
      return (
        <Button
          variant="contained"
          color={isRegisterButtonDisabled(project, isUserRegistered) ? "secondary" : "primary"}
          disabled={isRegisterButtonDisabled(project, isUserRegistered)}
          onClick={handleRegisterClick}
          className={className}
        >
          {getRegisterButtonText(project, texts, isUserRegistered)}
        </Button>
      );
    }

    // "hidden" — feature disabled, no config, or status === "ended"
    return <>{fallback}</>;
  };

  const renderSeatsInfo = () => {
    if (!shouldShowSeats) return null;

    return (
      <SeatsText
        color="text.primary"
        aria-label={`${availableSeats} of ${maxParticipants} seats available`}
      >
        <SeatsNumber>
          {availableSeats} / {maxParticipants}{" "}
        </SeatsNumber>
        {texts.seats_available}
      </SeatsText>
    );
  };

  // If showing seats, wrap in container; otherwise just return button
  if (shouldShowSeats && registrationState !== "hidden") {
    return (
      <RegistrationButtonContainer>
        {renderButton()}
        {renderSeatsInfo()}
      </RegistrationButtonContainer>
    );
  }

  return renderButton();
}

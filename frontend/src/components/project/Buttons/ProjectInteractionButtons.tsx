import { AppBar, Button, Container, Toolbar, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import ContactCreatorButton from "./ContactCreatorButton";
import FollowButton from "../../general/FollowButton";
import LikeButton from "./LikeButton";
import RegistrationActionButton from "./RegistrationActionButton";
import { Project } from "../../../types";
import { getRegistrationUIState } from "../../../utils/eventRegistrationHelpers";

interface ProjectInteractionButtonsProps {
  projectAdmin: any;
  handleClickContact: () => void;
  hasAdminPermissions: boolean;
  messageButtonIsVisible: boolean;
  contactProjectCreatorButtonRef: React.RefObject<HTMLElement> | null;
  visibleFooterHeight: number;
  tabContentContainerSpaceToRight: number;
  project: Project;
  isUserFollowing: boolean;
  isUserLiking: boolean;
  handleToggleFollowProject: () => void;
  handleToggleLikeProject: () => void;
  toggleShowFollowers: () => void;
  followingChangePending: boolean;
  likingChangePending: boolean;
  texts: any;
  screenSize: {
    belowSmall: boolean;
    belowTiny: boolean;
    [key: string]: boolean;
  };
  numberOfFollowers: number;
  numberOfLikes: number;
  bindLike: any;
  bindFollow: any;
  user: any;
  handleRegisterClick: () => void;
  isUserRegistered?: boolean;
  hasAttended?: boolean;
  adminCancelled?: boolean;
  onModifyRegistrationClick?: () => void;
  eventRegistration?: { available_seats: number | null; max_participants: number | null } | null;
}

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

// bottom / right change while scrolling, so they are passed as an inline `style` (see below)
// instead of as props of the styled component (which would create a new class per value).
const LargeScreenContactButton = styled(ContactCreatorButton, { shouldForwardProp })({
  position: "fixed",
  boxShadow: "3px -3px 6px #00000029",
});

const ActionBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#ECECEC",
  top: "auto",
  boxShadow: "-3px -3px 6px #00000029",
  zIndex: 101,
  paddingTop: theme.spacing(1),
}));

const ActionBarToolbar = styled(Toolbar)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  "& button": {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
}));

const LeftActions = styled("div")({
  display: "flex",
  alignItems: "center",
});

const RightActions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const SeatsInfoRow = styled(Typography)(({ theme }) => ({
  textAlign: "left",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(1),
  paddingBottom: theme.spacing(0.5),
  fontWeight: 500,
  fontSize: 15,
  lineHeight: 1.3,
}));

const SeatsNumber = styled("span")({
  fontWeight: 700,
});

export default function ProjectInteractionButtons({
  projectAdmin,
  handleClickContact,
  hasAdminPermissions,
  messageButtonIsVisible,
  contactProjectCreatorButtonRef,
  visibleFooterHeight,
  tabContentContainerSpaceToRight,
  project,
  isUserFollowing,
  isUserLiking,
  handleToggleFollowProject,
  handleToggleLikeProject,
  toggleShowFollowers,
  followingChangePending,
  likingChangePending,
  texts,
  screenSize,
  numberOfFollowers,
  numberOfLikes,
  bindLike,
  bindFollow,
  user,
  handleRegisterClick,
  isUserRegistered,
  hasAttended,
  adminCancelled,
  onModifyRegistrationClick,
  eventRegistration,
}: ProjectInteractionButtonsProps) {
  const registrationState = getRegistrationUIState(
    project,
    isUserRegistered,
    hasAttended,
    adminCancelled
  );

  if (screenSize.belowSmall) {
    const hasRegistration = registrationState !== "hidden";
    const registrationData = eventRegistration ?? project.registration_config;
    const availableSeats = registrationData?.available_seats ?? null;
    const maxParticipants = registrationData?.max_participants ?? null;
    const showSeatsInfo =
      hasRegistration &&
      registrationState === "register" &&
      availableSeats !== null &&
      maxParticipants !== null;

    return (
      <ActionBar position="fixed" elevation={0} style={{ bottom: visibleFooterHeight }}>
        <ActionBarToolbar variant="dense">
          <LeftActions>
            {registrationState !== "hidden" ? (
              <RegistrationActionButton
                registrationState={registrationState}
                project={project}
                texts={texts}
                isUserRegistered={isUserRegistered}
                handleRegisterClick={handleRegisterClick}
                onModifyRegistrationClick={onModifyRegistrationClick}
                showSeatsCount={false}
                eventRegistration={eventRegistration}
                analyticsSurface="event_page"
              />
            ) : (
              <FollowButton
                isUserFollowing={isUserFollowing}
                handleToggleFollow={handleToggleFollowProject}
                project={project}
                hasAdminPermissions={hasAdminPermissions}
                toggleShowFollowers={toggleShowFollowers}
                followingChangePending={followingChangePending}
                texts={texts}
                screenSize={screenSize}
                numberOfFollowers={numberOfFollowers}
                bindFollow={bindFollow}
                showStartIcon={screenSize.belowSmall && !screenSize.belowTiny}
                showNumberInText={screenSize.belowSmall}
                isLoggedIn={user}
              />
            )}
          </LeftActions>
          <RightActions>
            {!hasAdminPermissions && (
              <Button variant="contained" color="primary" onClick={handleClickContact}>
                {screenSize.belowTiny ? texts.contact_short : texts.contact}
              </Button>
            )}
            <LikeButton
              texts={texts}
              screenSize={screenSize}
              isUserLiking={isUserLiking}
              handleToggleLikeProject={handleToggleLikeProject}
              likingChangePending={likingChangePending}
              numberOfLikes={numberOfLikes}
              bindLike={bindLike}
              outlined
            />
          </RightActions>
        </ActionBarToolbar>
        {showSeatsInfo && (
          <SeatsInfoRow color="text.primary">
            <SeatsNumber>
              {availableSeats} / {maxParticipants}{" "}
            </SeatsNumber>
            {texts.seats_available}
          </SeatsInfoRow>
        )}
      </ActionBar>
    );
  }

  return (
    <Container>
      {!hasAdminPermissions &&
        !messageButtonIsVisible &&
        contactProjectCreatorButtonRef?.current && (
          <LargeScreenContactButton
            style={{ bottom: visibleFooterHeight + 2, right: tabContentContainerSpaceToRight }}
            creator={projectAdmin}
            handleClickContact={handleClickContact}
            explanationBackground={"#fff"}
            customCardWidth={220}
            withInfoCard={true}
            withIcons={true}
            collapsable={true}
          />
        )}
    </Container>
  );
}

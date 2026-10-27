import { Container, Link, Tooltip, Typography, Button } from "@mui/material";
import { Theme } from "@mui/material/styles";
import makeStyles from "@mui/styles/makeStyles";
import Linkify from "react-linkify";
import React, { MouseEventHandler, RefObject, useContext, useEffect, useState } from "react";

//icons
import ExploreIcon from "@mui/icons-material/Explore";
import LanguageIcon from "@mui/icons-material/Language";
import PlaceIcon from "@mui/icons-material/Place";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

// Relative imports
import ResponsiveImage from "../general/ResponsiveImage";
import { getParams } from "../../../public/lib/generalOperations";
import { getDateTimeRange } from "../../../public/lib/dateOperations";
import ContactCreatorButton from "./Buttons/ContactCreatorButton";
import FollowButton from "../general/FollowButton";
import getTexts from "../../../public/texts/texts";
import LikeButton from "./Buttons/LikeButton";
import RegistrationActionButton from "./Buttons/RegistrationActionButton";
import MessageContent from "../communication/MessageContent";
import FollowersDialog from "../dialogs/FollowersDialog";
import ProjectLikesDialog from "../dialogs/ProjectLikesDialog";
import projectOverviewStyles from "../../../public/styles/projectOverviewStyles";
import UserContext from "../context/UserContext";
import { Project } from "../../types";
import { ProjectSocialMediaShareButton } from "../shareContent/ProjectSocialMediaShareButton";
import ProjectAddToCalendarButton from "../calendar/ProjectAddToCalendarButton";
import ProjectTypeDisplay from "./ProjectTypeDisplay";
import WasseraktionswochenLink from "../hub/WasseraktionswochenLink";
import { isWasseraktionswochenSubEvent } from "../../../public/data/wasseraktionswochen_config.js";
import { getRegistrationUIState } from "../../utils/eventRegistrationHelpers";

type StyleProps = { hasAdminPermissions?: boolean };

const useStyles = makeStyles<Theme, StyleProps>((theme) => {
  return {
    ...projectOverviewStyles(theme),
    infoBottomBar: (props) => ({
      display: "flex",
      marginTop: theme.spacing(3),
      justifyContent: props.hasAdminPermissions ? "flex-start" : "space-between",
    }),
    largeScreenButtonContainer: {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
    },
    smallScreenHeader: {
      fontSize: "calc(1.6rem + 6 * ((100vw - 320px) / 680))",
      paddingBottom: theme.spacing(2),
      wordBreak: "break-word",
      color: "inherit",
    },
    rootLinksContainer: {
      display: "flex",
      justifyContent: "space-around",
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(1),
    },
    linkContainer: {
      display: "flex",
      marginTop: theme.spacing(3),
      justifyContent: "flex-start",
      cursor: "pointer",
      marginRight: theme.spacing(1),
    },
    linkIcon: {
      marginRight: theme.spacing(1),
      color: theme.palette.primary.main,
    },
    largeScreenHeader: {
      paddingTop: theme.spacing(4),
      paddingBottom: theme.spacing(4),
      textAlign: "center",
      wordBreak: "break-word",
      color: "inherit",
    },
    headerButton: {
      right: 0,
      position: "absolute",
    },

    headerContainer: {
      display: "flex",
      justifyContent: "center",
    },
    shareButtonContainer: {},
    calendarButtonContainer: {},
    actionButtonsGroup: {
      position: "absolute",
      right: 0,
      bottom: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginRight: theme.spacing(1),
      marginBottom: theme.spacing(1.6),
      gap: theme.spacing(0.5),
    },
    imageContainer: {
      position: "relative",
    },
    contactProjectButtonLarge: {
      height: 40,
      minWidth: 120,
    },
    registerButton: {
      height: 40,
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      whiteSpace: "nowrap",
    },
    registerButtonMobile: {
      marginTop: theme.spacing(2),
      whiteSpace: "nowrap",
    },
    shortDescription: {
      wordBreak: "break-word",
    },
    summaryHeadline: {
      color: "inherit",
    },
    projectTypeContainer: {
      display: "flex",
      alignItems: "center",
    },
    attendedEventText: {
      marginLeft: theme.spacing(1),
    },
    availableSeatsText: {
      marginLeft: theme.spacing(0.5),
    },
  };
});

const componentDecorator = (href, text, key) => (
  <Link
    color="primary"
    underline="always"
    href={href}
    key={key}
    target="_blank"
    rel="noopener noreferrer"
  >
    {text}
  </Link>
);

type Props = {
  contactProjectCreatorButtonRef?: RefObject<typeof Button>;
  followers: object; //merge like & follow?
  followingChangePending: boolean; //merge like & follow?
  handleClickContact: Function; //--> Call external function?
  handleToggleFollowProject: MouseEventHandler<HTMLButtonElement>; //merge like & follow?
  handleToggleLikeProject: MouseEventHandler<HTMLButtonElement>; //merge like & follow?
  hasAdminPermissions: boolean;
  initiallyCaughtFollowers: boolean; //merge like & follow?
  initiallyCaughtLikes: boolean; //merge like & follow?
  isUserFollowing: boolean; //merge like & follow?
  isUserLiking: boolean; //merge like & follow?
  likes: object; //merge like & follow?
  likingChangePending: boolean; //merge like & follow?
  numberOfFollowers: number; //merge like & follow?; calculate from followers
  numberOfLikes: number; //merge like & follow?; calculate from likes;
  project: Project;
  projectAdmin: object;
  screenSize: any;
  showFollowers: boolean; //merge like & follow?
  showLikes: boolean; //merge like & follow?
  toggleShowFollowers: Function; //merge like & follow?
  toggleShowLikes: Function; //merge like & follow?
  hubUrl?: string;
  parentProjectName?: string; // Name of the parent project
  parentProjectSlug?: string; // Slug of the parent project
  isWasseraktionswochenEnabled: boolean;
  handleRegisterClick: () => void;
  isUserRegistered?: boolean;
  hasAttended?: boolean;
  adminCancelled?: boolean;
  onModifyRegistrationClick?: () => void;
  eventRegistration?: { available_seats: number | null; max_participants: number | null } | null;
};

export default function ProjectOverview({
  contactProjectCreatorButtonRef,
  followers,
  followingChangePending,
  handleClickContact,
  handleToggleFollowProject,
  handleToggleLikeProject,
  hasAdminPermissions,
  initiallyCaughtFollowers,
  initiallyCaughtLikes,
  isUserFollowing,
  isUserLiking,
  likes,
  likingChangePending,
  numberOfFollowers,
  numberOfLikes,
  project,
  projectAdmin,
  screenSize,
  showFollowers,
  showLikes,
  toggleShowFollowers,
  toggleShowLikes,
  hubUrl,
  isWasseraktionswochenEnabled,
  handleRegisterClick,
  isUserRegistered,
  hasAttended,
  adminCancelled,
  onModifyRegistrationClick,
  eventRegistration,
}: Props) {
  const classes = useStyles({});
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });
  const [gotParams, setGotParams] = useState(false);
  const registrationState = getRegistrationUIState(
    project,
    isUserRegistered,
    hasAttended,
    adminCancelled
  );

  useEffect(() => {
    if (!gotParams) {
      const params = getParams(window.location.href);
      if (params.show_followers && !showFollowers) {
        toggleShowFollowers();
      }
      setGotParams(true);
    }
  }, []);

  const passThroughProps = {
    projectAdmin: projectAdmin,
    project: project,
    screenSize: screenSize,
    hubUrl: hubUrl,
    isWasseraktionswochenEnabled: isWasseraktionswochenEnabled,
    showAttendedInPast: registrationState === "attended",
    isUserRegistered: isUserRegistered,
  };

  return (
    <Container className={classes.projectOverview}>
      {screenSize?.belowSmall ? (
        <SmallScreenOverview {...passThroughProps} />
      ) : (
        <LargeScreenOverview
          {...passThroughProps}
          hasAdminPermissions={hasAdminPermissions}
          handleClickContact={handleClickContact}
          contactProjectCreatorButtonRef={contactProjectCreatorButtonRef}
          isUserLiking={isUserLiking}
          handleToggleLikeProject={handleToggleLikeProject}
          toggleShowLikes={toggleShowLikes}
          likingChangePending={likingChangePending}
          numberOfLikes={numberOfLikes}
          isUserFollowing={isUserFollowing}
          handleToggleFollowProject={handleToggleFollowProject}
          toggleShowFollowers={toggleShowFollowers}
          followingChangePending={followingChangePending}
          numberOfFollowers={numberOfFollowers}
          isWasseraktionswochenEnabled={isWasseraktionswochenEnabled}
          handleRegisterClick={handleRegisterClick}
          isUserRegistered={isUserRegistered}
          hasAttended={hasAttended}
          adminCancelled={adminCancelled}
          registrationState={registrationState}
          onModifyRegistrationClick={onModifyRegistrationClick}
          eventRegistration={eventRegistration}
        />
      )}

      <FollowersDialog
        open={showFollowers}
        loading={!initiallyCaughtFollowers}
        followers={followers}
        object={project}
        onClose={toggleShowFollowers}
        user={user}
        url={"projects/" + project.url_slug + "?show_followers=true"}
        titleText={texts.followers_of}
        pleaseLogInText={texts.please_log_in}
        toSeeFollowerText={texts.to_see_this_projects_followers}
        logInText={texts.log_in}
        noFollowersText={texts.this_project_does_not_have_any_followers_yet}
        followingSinceText={texts.following_since}
      />

      <ProjectLikesDialog
        open={showLikes}
        loading={!initiallyCaughtLikes}
        likes={likes}
        project={project}
        onClose={toggleShowLikes}
        user={user}
        url={"projects/" + project.url_slug + "?show_likes=true"}
      />
    </Container>
  );
}

function ShortProjectInfo({ project, isWasseraktionswochenEnabled, showAttendedInPast = false }) {
  const classes = useStyles({});
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });

  return (
    <>
      <Typography component="div" className={classes.shortDescription}>
        <MessageContent content={project.short_description} />
      </Typography>
      {isWasseraktionswochenEnabled && isWasseraktionswochenSubEvent(project) && (
        <div style={{ marginTop: "16px", marginBottom: "8px" }}>
          <WasseraktionswochenLink />
        </div>
      )}
      <div className={classes.projectInfoEl}>
        <Typography>
          <Tooltip title={texts.location}>
            <PlaceIcon className={classes.icon} />
          </Tooltip>{" "}
          {project.is_online && <>{texts.online} · </>}
          {project.location}
          {project.additional_loc_info && <> - {project.additional_loc_info}</>}
        </Typography>
      </div>
      {project.project_type?.type_id === "event" && (
        <div className={classes.projectInfoEl}>
          <Typography>
            <Tooltip title={texts.event_start_date}>
              <CalendarTodayIcon color="primary" className={classes.icon} />
            </Tooltip>{" "}
            {getDateTimeRange(project.start_date, project.end_date, locale)}
          </Typography>
        </div>
      )}
      {project?.website && (
        <div className={classes.projectInfoEl}>
          <Typography>
            <Tooltip title={texts.website}>
              <LanguageIcon className={classes.icon} />
            </Tooltip>{" "}
            <Linkify componentDecorator={componentDecorator}>{project.website}</Linkify>
          </Typography>
        </div>
      )}
      <div className={classes.projectInfoEl}>
        <Typography>
          <Tooltip title={texts.categories}>
            <ExploreIcon className={classes.icon} />
          </Tooltip>{" "}
          {project?.sectors?.length > 0 && project.sectors.map((s) => s.name).join(", ")}
        </Typography>
      </div>
      <div className={classes.projectInfoEl}>
        <div className={classes.projectTypeContainer}>
          <ProjectTypeDisplay projectType={project.project_type} />
          {showAttendedInPast && project.project_type?.type_id === "event" && (
            <Typography component="span" className={classes.attendedEventText}>
              {"\u2022 "}
              {texts.you_attended_this_event}
            </Typography>
          )}
        </div>
      </div>
    </>
  );
}

function SmallScreenOverview({
  project,
  projectAdmin,
  hubUrl,
  isWasseraktionswochenEnabled,
  showAttendedInPast,
  isUserRegistered,
}) {
  const classes = useStyles({});
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });

  return (
    <>
      <div className={classes.imageContainer}>
        <div className={classes.actionButtonsGroup}>
          <ProjectAddToCalendarButton
            className={classes.calendarButtonContainer}
            project={project}
            isUserRegistered={isUserRegistered}
          />
          <ProjectSocialMediaShareButton
            className={classes.shareButtonContainer}
            project={project}
            projectAdmin={projectAdmin}
            hubUrl={hubUrl}
          />
        </div>
        <ResponsiveImage
          className={classes.fullWidthImage}
          src={project.image}
          variants={project.image_variants}
          alt={texts.project_image_of_project + " " + project.name}
        />
      </div>
      <div className={classes.blockProjectInfo}>
        <Typography component="h1" variant="h3" className={classes.smallScreenHeader}>
          {project.name}
        </Typography>
        <ShortProjectInfo
          project={project}
          isWasseraktionswochenEnabled={isWasseraktionswochenEnabled}
          showAttendedInPast={showAttendedInPast}
        />
      </div>
    </>
  );
}

function LargeScreenOverview({
  project,
  projectAdmin,
  hasAdminPermissions,
  screenSize,
  handleClickContact,
  contactProjectCreatorButtonRef,
  isUserLiking,
  handleToggleLikeProject,
  toggleShowLikes,
  likingChangePending,
  numberOfLikes,
  isUserFollowing,
  handleToggleFollowProject,
  toggleShowFollowers,
  followingChangePending,
  numberOfFollowers,
  isWasseraktionswochenEnabled,
  handleRegisterClick,
  isUserRegistered,
  registrationState,
  onModifyRegistrationClick,
  eventRegistration,
}) {
  const classes = useStyles({ hasAdminPermissions: hasAdminPermissions });
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });

  return (
    <>
      <div className={classes.headerContainer}>
        <Typography component="h1" variant="h4" className={classes.largeScreenHeader}>
          {project.name}
        </Typography>
      </div>
      <div className={classes.flexContainer}>
        <ResponsiveImage
          className={classes.inlineImage}
          src={project.image}
          variants={project.image_variants}
          sizes="(min-width: 900px) 550px, 100vw"
          alt={texts.project_image_of_project + " " + project.name}
        />
        <div className={classes.inlineProjectInfo}>
          <Typography
            component="h2"
            variant="h5"
            className={`${classes.summaryHeadline} ${classes.subHeader}`}
          >
            {texts.summary}
          </Typography>
          <ShortProjectInfo
            project={project}
            isWasseraktionswochenEnabled={isWasseraktionswochenEnabled}
            showAttendedInPast={registrationState === "attended"}
          />
          <div className={classes.infoBottomBar}>
            <LikeButton
              texts={texts}
              isUserLiking={isUserLiking}
              handleToggleLikeProject={handleToggleLikeProject}
              toggleShowLikes={toggleShowLikes}
              likingChangePending={likingChangePending}
              screenSize={screenSize}
              hasAdminPermissions={hasAdminPermissions}
              numberOfLikes={numberOfLikes}
            />
            <RegistrationActionButton
              registrationState={registrationState}
              project={project}
              texts={texts}
              isUserRegistered={isUserRegistered}
              handleRegisterClick={handleRegisterClick}
              onModifyRegistrationClick={onModifyRegistrationClick}
              className={classes.registerButton}
              showSeatsCount={true}
              eventRegistration={eventRegistration}
              analyticsSurface="event_page"
              fallback={
                <FollowButton
                  isLoggedIn={!!user}
                  followingChangePending={followingChangePending}
                  handleToggleFollow={handleToggleFollowProject}
                  hasAdminPermissions={hasAdminPermissions}
                  isUserFollowing={isUserFollowing}
                  numberOfFollowers={numberOfFollowers}
                  screenSize={screenSize}
                  texts={texts}
                  toggleShowFollowers={toggleShowFollowers}
                  showStartIcon={!screenSize.belowMedium}
                  showLinkUnderButton
                />
              }
            />
            {!hasAdminPermissions &&
              (!screenSize.belowMedium ? (
                <ContactCreatorButton
                  creator={projectAdmin}
                  contactProjectCreatorButtonRef={contactProjectCreatorButtonRef}
                  handleClickContact={handleClickContact}
                  customCardWidth={220}
                  withInfoCard={true}
                  withIcons={true}
                  collapsable={true}
                />
              ) : (
                <Button
                  className={classes.contactProjectButtonLarge}
                  variant="contained"
                  color="primary"
                  onClick={handleClickContact}
                  ref={contactProjectCreatorButtonRef}
                >
                  {texts.contact}
                </Button>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}

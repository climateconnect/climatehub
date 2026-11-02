import { Container, Link, Tooltip, Typography, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import Linkify from "react-linkify";
import React, { MouseEventHandler, RefObject, useContext, useEffect, useState } from "react";

//icons
import ExploreIcon from "@mui/icons-material/Explore";
import LanguageIcon from "@mui/icons-material/Language";
import PlaceIcon from "@mui/icons-material/Place";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

// Relative imports
import { getImageUrl } from "./../../../public/lib/imageOperations";
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

const OverviewContainer = styled(Container)(
  ({ theme }) => projectOverviewStyles(theme).projectOverview
);

const ProjectInfoEl = styled("div")(({ theme }) => projectOverviewStyles(theme).projectInfoEl);

// The same `icon` rule from the shared helper is applied to four different icons.
const StyledPlaceIcon = styled(PlaceIcon)(({ theme }) => projectOverviewStyles(theme).icon);
const StyledCalendarTodayIcon = styled(CalendarTodayIcon)(
  ({ theme }) => projectOverviewStyles(theme).icon
);
const StyledLanguageIcon = styled(LanguageIcon)(({ theme }) => projectOverviewStyles(theme).icon);
const StyledExploreIcon = styled(ExploreIcon)(({ theme }) => projectOverviewStyles(theme).icon);

const ShortDescription = styled(Typography)({
  wordBreak: "break-word",
});

const ProjectTypeContainer = styled("div")({
  display: "flex",
  alignItems: "center",
});

const AttendedEventText = styled(Typography)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

const ImageContainer = styled("div")({
  position: "relative",
});

const ActionButtonsGroup = styled("div")(({ theme }) => ({
  position: "absolute",
  right: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginRight: theme.spacing(1),
  marginBottom: theme.spacing(1.6),
  gap: theme.spacing(0.5),
}));

const FullWidthImage = styled("img")(({ theme }) => projectOverviewStyles(theme).fullWidthImage);

const BlockProjectInfo = styled("div")(
  ({ theme }) => projectOverviewStyles(theme).blockProjectInfo
);

// `smallScreenHeader` / `largeScreenHeader` of the local styles replaced the helper's rules
// of the same name entirely (they were not merged), so only the local values apply.
const SmallScreenHeader = styled(Typography)(({ theme }) => ({
  fontSize: "calc(1.6rem + 6 * ((100vw - 320px) / 680))",
  paddingBottom: theme.spacing(2),
  wordBreak: "break-word",
  color: "inherit",
}));

const HeaderContainer = styled("div")({
  display: "flex",
  justifyContent: "center",
});

const LargeScreenHeader = styled(Typography)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
  textAlign: "center",
  wordBreak: "break-word",
  color: "inherit",
}));

const FlexContainer = styled("div")(({ theme }) => projectOverviewStyles(theme).flexContainer);

const InlineImage = styled("img")(({ theme }) => projectOverviewStyles(theme).inlineImage);

const InlineProjectInfo = styled("div")(
  ({ theme }) => projectOverviewStyles(theme).inlineProjectInfo
);

// summaryHeadline (color) + subHeader (from the helper): distinct properties, merged
const SummaryHeadline = styled(Typography)(({ theme }) => ({
  ...projectOverviewStyles(theme).subHeader,
  color: "inherit",
}));

const InfoBottomBar = styled("div", {
  shouldForwardProp: (prop) => !(prop as string).startsWith("$"),
})<{ $hasAdminPermissions?: boolean }>(({ theme, $hasAdminPermissions }) => ({
  display: "flex",
  marginTop: theme.spacing(3),
  justifyContent: $hasAdminPermissions ? "flex-start" : "space-between",
}));

const StyledRegistrationActionButton = styled(RegistrationActionButton)(({ theme }) => ({
  height: 40,
  marginLeft: theme.spacing(1),
  marginRight: theme.spacing(1),
  whiteSpace: "nowrap",
}));

const ContactProjectButtonLarge = styled(Button)({
  height: 40,
  minWidth: 120,
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
    <OverviewContainer disableGutters>
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
    </OverviewContainer>
  );
}

function ShortProjectInfo({ project, isWasseraktionswochenEnabled, showAttendedInPast = false }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });

  return (
    <>
      <ShortDescription component="div">
        <MessageContent content={project.short_description} />
      </ShortDescription>
      {isWasseraktionswochenEnabled && isWasseraktionswochenSubEvent(project) && (
        <div style={{ marginTop: "16px", marginBottom: "8px" }}>
          <WasseraktionswochenLink />
        </div>
      )}
      <ProjectInfoEl>
        <Typography>
          <Tooltip title={texts.location}>
            <StyledPlaceIcon />
          </Tooltip>{" "}
          {project.is_online && <>{texts.online} · </>}
          {project.location}
          {project.additional_loc_info && <> - {project.additional_loc_info}</>}
        </Typography>
      </ProjectInfoEl>
      {project.project_type?.type_id === "event" && (
        <ProjectInfoEl>
          <Typography>
            <Tooltip title={texts.event_start_date}>
              <StyledCalendarTodayIcon color="primary" />
            </Tooltip>{" "}
            {getDateTimeRange(project.start_date, project.end_date, locale)}
          </Typography>
        </ProjectInfoEl>
      )}
      {project?.website && (
        <ProjectInfoEl>
          <Typography>
            <Tooltip title={texts.website}>
              <StyledLanguageIcon />
            </Tooltip>{" "}
            <Linkify componentDecorator={componentDecorator}>{project.website}</Linkify>
          </Typography>
        </ProjectInfoEl>
      )}
      <ProjectInfoEl>
        <Typography>
          <Tooltip title={texts.categories}>
            <StyledExploreIcon />
          </Tooltip>{" "}
          {project?.sectors?.length > 0 && project.sectors.map((s) => s.name).join(", ")}
        </Typography>
      </ProjectInfoEl>
      <ProjectInfoEl>
        <ProjectTypeContainer>
          <ProjectTypeDisplay projectType={project.project_type} />
          {showAttendedInPast && project.project_type?.type_id === "event" && (
            <AttendedEventText component="span">
              {"• "}
              {texts.you_attended_this_event}
            </AttendedEventText>
          )}
        </ProjectTypeContainer>
      </ProjectInfoEl>
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
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });

  return (
    <>
      <ImageContainer>
        <ActionButtonsGroup>
          <ProjectAddToCalendarButton project={project} isUserRegistered={isUserRegistered} />
          <ProjectSocialMediaShareButton
            className={undefined}
            project={project}
            projectAdmin={projectAdmin}
            hubUrl={hubUrl}
          />
        </ActionButtonsGroup>
        <FullWidthImage
          src={getImageUrl(project.image)}
          alt={texts.project_image_of_project + " " + project.name}
        />
      </ImageContainer>
      <BlockProjectInfo>
        <SmallScreenHeader component="h1" variant="h3">
          {project.name}
        </SmallScreenHeader>
        <ShortProjectInfo
          project={project}
          isWasseraktionswochenEnabled={isWasseraktionswochenEnabled}
          showAttendedInPast={showAttendedInPast}
        />
      </BlockProjectInfo>
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
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });

  return (
    <>
      <HeaderContainer>
        <LargeScreenHeader component="h1" variant="h4">
          {project.name}
        </LargeScreenHeader>
      </HeaderContainer>
      <FlexContainer>
        <InlineImage
          src={getImageUrl(project.image)}
          alt={texts.project_image_of_project + " " + project.name}
        />
        <InlineProjectInfo>
          <SummaryHeadline component="h2" variant="h5">
            {texts.summary}
          </SummaryHeadline>
          <ShortProjectInfo
            project={project}
            isWasseraktionswochenEnabled={isWasseraktionswochenEnabled}
            showAttendedInPast={registrationState === "attended"}
          />
          <InfoBottomBar $hasAdminPermissions={hasAdminPermissions}>
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
            <StyledRegistrationActionButton
              registrationState={registrationState}
              project={project}
              texts={texts}
              isUserRegistered={isUserRegistered}
              handleRegisterClick={handleRegisterClick}
              onModifyRegistrationClick={onModifyRegistrationClick}
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
                <ContactProjectButtonLarge
                  variant="contained"
                  color="primary"
                  onClick={handleClickContact}
                  ref={contactProjectCreatorButtonRef}
                >
                  {texts.contact}
                </ContactProjectButtonLarge>
              ))}
          </InfoBottomBar>
        </InlineProjectInfo>
      </FlexContainer>
    </>
  );
}

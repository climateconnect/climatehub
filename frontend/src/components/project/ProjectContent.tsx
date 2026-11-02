import { Link, Typography } from "@mui/material";
import humanizeDuration from "humanize-duration";
import React, { useContext } from "react";
import { styled, Theme, useTheme } from "@mui/material/styles";

// Relative imports
import DateDisplay from "./../general/DateDisplay";
import LocalizedTimeAgo from "./../general/LocalizedTimeAgo";
import DiscussionPreview from "./DiscussionPreview";
import getTexts from "../../../public/texts/texts";
import MiniOrganizationPreview from "../organization/MiniOrganizationPreview";
import MiniProfilePreview from "../profile/MiniProfilePreview";
import Posts from "./../communication/Posts";
import UserContext from "../context/UserContext";
import ProjectContentSideButtons from "./Buttons/ProjectContentSideButtons";
import { getDevlinkComponent } from "../../utils/getDevlinkComponent";
import { getEditorStyles } from "mui-tiptap";

const CreatedBy = styled("div")({
  fontSize: 16,
});

const InfoText = styled(Typography)(({ theme }) => ({
  fontStyle: "italic",
  marginBottom: theme.spacing(1),
  display: "block",
  fontSize: 14,
}));

const creatorStyles = (theme: Theme) => ({
  paddingLeft: theme.spacing(1),
  color: theme.palette.grey[800],
  cursor: "pointer",
  wordBreak: "break-word" as const,
  "& h6": {
    fontSize: "inherit",
    fontWeight: 600,
    lineHeight: "inherit",
  },
});

const StyledMiniProfilePreview = styled(MiniProfilePreview)(({ theme }) => creatorStyles(theme));

const StyledMiniOrganizationPreview = styled(MiniOrganizationPreview)(({ theme }) =>
  creatorStyles(theme)
);

const CollaboratingOrganization = styled(MiniOrganizationPreview)(({ theme }) => ({
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
  color: theme.palette.grey[800],
  cursor: "pointer",
}));

const ParentProjectName = styled(Typography)(({ theme }) => ({
  display: "inline-block",
  color: theme.palette.grey[800],
  fontWeight: 600,
  cursor: "pointer",
  wordBreak: "break-word",
}));

const SubHeader = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  fontWeight: "bold",
  paddingBottom: theme.spacing(1),
}));

const ContentBlock = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(4),
}));

const ProgressContent = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(5),
}));

const OpenToCollabBool = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  fontWeight: "bold",
}));

const projectDescriptionStyles = (theme: Theme) => ({
  wordBreak: "break-word" as const,
  // Reuse the tiptap editor's own styles (margin:0 on p/headings/lists, link &
  // list styling) so the rendered description is WYSIWYG with the editor.
  ...getEditorStyles(theme),
  // The tiptap editor renders an empty paragraph (<p></p>, e.g. a blank line
  // the author created) as a visible empty line — ProseMirror injects a <br>
  // into empty blocks in the editable view. In the read-only display that <br>
  // is absent, so an empty <p> collapses to zero height. Give it one line of
  // height (via a hidden non-breaking space) so blank lines created in the
  // editor stay visible. This matches the editor without changing global CSS.
  "& p:empty::before": {
    content: '"\\00a0"',
    visibility: "hidden" as const,
  },
  "& ul, & ol": {
    paddingLeft: "1.5em",
  },
  "& iframe": {
    maxWidth: 640,
    width: "100%",
    height: "auto",
    aspectRatio: "16 / 9",
  },
});

const DescriptionWrapper = styled(Typography)<{ component?: React.ElementType }>(({ theme }) =>
  projectDescriptionStyles(theme)
);

const DescriptionBody = styled("div")(({ theme }) => projectDescriptionStyles(theme));

const ProjectParentContainer = styled("div")({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
});

const CollaborationContainer = styled("div")({
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
});

export default function ProjectContent({
  discussionTabLabel,
  handleTabChange,
  latestParentComment,
  leaveProject,
  project,
  projectTabsRef,
  typesByTabValue,
  showRequesters,
  toggleShowRequests,
  handleSendProjectJoinRequest,
  requestedToJoinProject,
  hubUrl,
  eventRegistration,
  onEventRegistrationUpdated,
  onMembersRefreshed,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });
  //return the right static text depending on the project type
  const getProjectDescriptionHeadline = () => {
    const type = project.project_type.type_id;
    if (type === "event") return texts.event_description;
    if (type === "idea") return texts.idea_description;
    return texts.project_description;
  };

  const getNoProjectDescriptionText = () => {
    const type = project.project_type.type_id;
    if (type === "event") return texts.this_event_hasnt_added_a_description_yet;
    if (type === "idea") return texts.this_idea_hasnt_added_a_description_yet;
    return texts.this_project_hasnt_added_a_description_yet;
  };
  const theme = useTheme();
  return (
    <>
      <ContentBlock>
        <CreatedBy>
          <ProjectContentSideButtons
            project={project}
            showRequesters={showRequesters}
            toggleShowRequests={toggleShowRequests}
            handleSendProjectJoinRequest={handleSendProjectJoinRequest}
            requestedToJoinProject={requestedToJoinProject}
            leaveProject={leaveProject}
            hubUrl={hubUrl}
            eventRegistration={eventRegistration}
            onEventRegistrationUpdated={onEventRegistrationUpdated}
            onMembersRefreshed={onMembersRefreshed}
          />
          {/* Note: created date is not the same as the start date, for projects */}
          <Typography>
            {texts.shared} <DateDisplay date={new Date(project.creation_date)} />
          </Typography>
          <div>
            <ProjectParentContainer>
              <Typography component="span">
                {project.project_type.type_id === "event" ? (
                  <>{texts.event_organized_by}</>
                ) : (
                  <>
                    {texts.started + " "}
                    <LocalizedTimeAgo date={new Date(project.start_date)} /> {texts.by}
                  </>
                )}
                {project.isPersonalProject ? (
                  <StyledMiniProfilePreview
                    profile={project.creator}
                    size="small"
                    hubUrl={hubUrl}
                  />
                ) : (
                  <StyledMiniOrganizationPreview
                    organization={project.creator}
                    inline
                    size="small"
                    hubUrl={hubUrl}
                  />
                )}
              </Typography>
            </ProjectParentContainer>
            {project.project_type.type_id === "project" && project.end_date && (
              <Typography>
                {texts.finished + " "}
                <LocalizedTimeAgo date={new Date(project.end_date)} />{" "}
              </Typography>
            )}

            {project.collaborating_organizations && project.collaborating_organizations.length > 0 && (
              <CollaborationContainer>
                <span> {texts.in_collaboration_with}</span>
                {project.collaborating_organizations.map((o) => (
                  <CollaboratingOrganization
                    key={o.id}
                    size="small"
                    inline
                    organization={o}
                    hubUrl={hubUrl}
                  />
                ))}
              </CollaborationContainer>
            )}
            {project.parent_project_id &&
              project.parent_project_name &&
              project.parent_project_slug && (
                <div>
                  {(() => {
                    const type = project.project_type?.type_id;
                    if (type === "event") return texts.this_event_is_part_of;
                    if (type === "idea") return texts.this_idea_is_part_of;
                    return texts.this_project_is_part_of;
                  })()}{" "}
                  <Link href={`/projects/${project.parent_project_slug}`}>
                    {" "}
                    <ParentProjectName>{project.parent_project_name}</ParentProjectName>
                  </Link>
                </div>
              )}
          </div>
          {project.end_date && (
            <Typography>
              {texts.finished} <LocalizedTimeAgo date={new Date(project.end_date)} />.{" "}
              {texts.total_duration}:{" "}
              {humanizeDuration(new Date(project.end_date) - new Date(project.start_date), {
                largest: 1,
                language: locale,
              })}
            </Typography>
          )}
        </CreatedBy>
      </ContentBlock>
      <ContentBlock>
        {(() => {
          const DevlinkComponent = getDevlinkComponent(project.devlink_component, locale);
          if (DevlinkComponent) {
            return <DevlinkComponent />;
          }
          return (
            <>
              <SubHeader
                component="h2"
                variant="h6"
                color={theme.palette.background.default_contrastText}
              >
                {getProjectDescriptionHeadline()}
              </SubHeader>
              <DescriptionWrapper component="div">
                {project.description_html ? (
                  <DescriptionBody dangerouslySetInnerHTML={{ __html: project.description_html }} />
                ) : (
                  <Typography variant="body2">{getNoProjectDescriptionText()}</Typography>
                )}
              </DescriptionWrapper>
            </>
          );
        })()}
      </ContentBlock>
      {latestParentComment[0] && (
        <DiscussionPreview
          latestParentComment={latestParentComment}
          discussionTabLabel={discussionTabLabel}
          locale={locale}
          project={project}
          handleTabChange={handleTabChange}
          typesByTabValue={typesByTabValue}
          projectTabsRef={projectTabsRef}
          hubUrl={hubUrl}
        />
      )}
      {false && (
        <ContentBlock>
          <SubHeader
            component="h2"
            variant="h6"
            color={theme.palette.background.default_contrastText}
          >
            {texts.collaboration}
          </SubHeader>
          {project.collaborators_welcome ? (
            <CollaborateContent project={project} texts={texts} />
          ) : (
            <OpenToCollabBool>
              {texts.this_project_is_not_looking_for_collaborators_right_now}
            </OpenToCollabBool>
          )}
        </ContentBlock>
      )}
      <ContentBlock>
        <SubHeader
          component="h2"
          variant="h6"
          color={theme.palette.background.default_contrastText}
        >
          {texts.progress}
        </SubHeader>
        <Typography variant="body2" fontStyle="italic" fontWeight="bold">
          {texts.follow_the_project_to_be_notified_when_they_make_an_update_post}
        </Typography>
        {project.timeline_posts && project.timeline_posts.length > 0 && (
          <ProgressContent>
            <Posts
              posts={project.timeline_posts.sort((a, b) => new Date(b.date) - new Date(a.date))}
              type="progresspost"
              hubUrl={hubUrl}
            />
          </ProgressContent>
        )}
      </ContentBlock>
    </>
  );
}

function CollaborateContent({ texts }) {
  return (
    <>
      <InfoText variant="body2">
        {texts.to_fight_climate_change_we_all_need_to_work_together}
      </InfoText>
      <OpenToCollabBool>{texts.this_project_is_open_to_collaborators}</OpenToCollabBool>
    </>
  );
}

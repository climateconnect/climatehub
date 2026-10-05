import { Box, Collapse, Container, Tooltip, Typography, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import PlaceIcon from "@mui/icons-material/Place";
import React, { useContext, useEffect } from "react";
import { useRouter } from "next/router";
import getTexts from "../../../public/texts/texts";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import UserContext from "../context/UserContext";
import MiniOrganizationPreview from "../organization/MiniOrganizationPreview";
import MiniProfilePreview from "../profile/MiniProfilePreview";
import LocationDisplay from "./LocationDisplay";
import ProjectSectorsDisplay from "./ProjectSectorsDisplay";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ModeCommentIcon from "@mui/icons-material/ModeComment";
import { Project } from "../../types";
import { getProjectTypes } from "../../../public/data/projectTypes";
import ProjectTypeDisplay from "./ProjectTypeDisplay";
import {
  shouldShowRegisterButton,
  getRegisterButtonText,
  isRegisterButtonDisabled,
} from "../../utils/eventRegistrationHelpers";
import { trackGA4Event } from "../../utils/analytics";

// `LocationDisplay`, `ProjectSectorsDisplay` and `ProjectTypeDisplay` take class names for their
// inner icon / text elements, so these are styled with descendant selectors from the root.
const CARD_ICON_CLASS = "ProjectMetaData-cardIcon";
const METADATA_TEXT_CLASS = "ProjectMetaData-metadataText";
const TYPE_ICON_CLASS = "ProjectMetaData-typeIcon";

const MetaDataRoot = styled(Box)(({ theme }) => ({
  [`& .${CARD_ICON_CLASS}`]: {
    verticalAlign: "bottom",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(-0.25),
    fontSize: "default",
    color: theme.palette.background.default_contrastText,
  },
  [`& .${METADATA_TEXT_CLASS}`]: {
    display: "inline",
    fontSize: 14,
    marginLeft: theme.spacing(0.25),
    color: theme.palette.text.primary,
  },
  [`& .${TYPE_ICON_CLASS}`]: {
    width: 20,
    height: 20,
    marginLeft: 2,
    marginRight: 6,
  },
}));

// `hovering` was never passed to the old `useStyles`, so the non-hovering values always applied
const Wrapper = styled(Container)(({ theme }) => ({
  padding: theme.spacing(2),
  paddingTop: 0,
  paddingBottom: "auto",
}));

const ShortDescription = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  marginTop: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
}));

const InvolvedOrganizationsContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  marginBottom: theme.spacing(0.5),
}));

const HorizontalSpacing = styled("div")(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

const creatorStyles = (theme) => ({
  wordBreak: "break-word" as const,
  marginBottom: theme.spacing(0.25),
});

const CreatorOrganizationPreview = styled(MiniOrganizationPreview)(({ theme }) =>
  creatorStyles(theme)
);

const CreatorProfilePreview = styled(MiniProfilePreview)(({ theme }) => creatorStyles(theme));

const AdditionalInfoContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  marginTop: theme.spacing(1),
  marginLeft: theme.spacing(-0.25),
}));

const AdditionalInfoIcon = styled(Box)(({ theme }) => ({
  marginRight: theme.spacing(1),
  display: "flex",
  alignItems: "center",
  color: theme.palette.background.default_contrastText,
}));

const AdditionalInfoCounter = styled("span")(({ theme }) => ({
  marginLeft: theme.spacing(0.5),
  color: theme.palette.text.primary,
}));

const RegisterButton = styled(Button)({
  marginLeft: "auto",
  fontSize: 11,
  padding: "4px 12px",
  height: 24,
  whiteSpace: "nowrap",
});

type Props = {
  project: Project;
  hovering: boolean;
  withDescription?: boolean;
  isUserRegistered?: boolean;
  analyticsSurface?: "browse_card" | "similar_projects_sidebar";
};
export default function ProjectMetaData({
  project,
  hovering,
  withDescription,
  isUserRegistered: isUserRegisteredProp,
  analyticsSurface,
}: Props) {
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const project_parent = project.project_parents![0];
  const main_project_sector = project
    .sectors!.map((t: any) => t.sector?.name ?? t.name)
    .filter(Boolean)[0];

  // Use prop if provided, otherwise compute from user context as fallback
  // The prop should now always be passed from parent components
  let isUserRegistered: boolean | undefined;
  if (isUserRegisteredProp !== undefined) {
    // Use the explicit prop (computed from registeredEventSlugs in parent)
    isUserRegistered = isUserRegisteredProp;
  } else if (user?.registered_event_slugs) {
    // Fallback: compute from user context if prop not provided
    const registeredEventSlugs = new Set(user.registered_event_slugs);
    isUserRegistered = project.url_slug ? registeredEventSlugs.has(project.url_slug) : false;
  } else {
    // No user or no registration data
    isUserRegistered = undefined;
  }

  if (withDescription) {
    return (
      <WithDescription
        // className={classes.WithDescription}
        project_parent={project_parent}
        project={project}
        hovering={hovering}
        main_project_sector={main_project_sector}
        texts={texts}
        isUserRegistered={isUserRegistered}
        analyticsSurface={analyticsSurface}
      />
    );
  }

  return (
    <WithOutDescription
      // className={classes.WithDescription}
      project_parent={project_parent}
      project={project}
      main_project_sector={main_project_sector}
      texts={texts}
      isUserRegistered={isUserRegistered}
      analyticsSurface={analyticsSurface}
    />
  );
}

const WithDescription = ({
  className,
  project_parent,
  hovering,
  project,
  main_project_sector,
  texts,
  isUserRegistered,
  analyticsSurface,
}: any) => {
  return (
    <MetaDataRoot className={className}>
      <Wrapper>
        <CreatorAndCollaboratorPreviews
          collaborating_organization={project.collaborating_organizations}
          project_parent={project_parent}
        />
        <Box>
          <LocationDisplay
            textClassName={METADATA_TEXT_CLASS}
            iconClassName={CARD_ICON_CLASS}
            location={project.is_online ? texts.online : project.location}
          />
          {/* Defer to MUI's best guess on height calculation for timeout: https://material-ui.com/api/collapse/ */}
          <Collapse in={hovering} timeout="auto">
            <ShortDescription>{project.short_description}</ShortDescription>
          </Collapse>
          {!hovering && (
            <ProjectSectorsDisplay
              main_project_sector={main_project_sector}
              projectSectorClassName={METADATA_TEXT_CLASS}
              iconClassName={CARD_ICON_CLASS}
            />
          )}
          <AdditionalPreviewInfo
            project={project}
            isUserRegistered={isUserRegistered}
            analyticsSurface={analyticsSurface}
          />
        </Box>
      </Wrapper>
      {hovering && (
        <ProjectSectorsDisplay
          main_project_sector={main_project_sector}
          hovering={hovering}
          projectSectorClassName={METADATA_TEXT_CLASS}
          iconClassName={CARD_ICON_CLASS}
        />
      )}
    </MetaDataRoot>
  );
};

const WithOutDescription = ({
  className,
  project_parent,
  project,
  main_project_sector,
  texts,
  isUserRegistered,
  analyticsSurface,
}: any) => {
  return (
    <MetaDataRoot className={className}>
      <Wrapper>
        <CreatorAndCollaboratorPreviews
          collaborating_organization={project.collaborating_organizations}
          project_parent={project_parent}
        />
        <Box>
          <Tooltip title={texts.location}>
            <PlaceIcon className={CARD_ICON_CLASS} />
          </Tooltip>
          <Typography className={METADATA_TEXT_CLASS}>
            {project.is_online ? texts.online : project.location}
          </Typography>
          <ProjectSectorsDisplay
            main_project_sector={main_project_sector}
            projectSectorClassName={METADATA_TEXT_CLASS}
            iconClassName={CARD_ICON_CLASS}
          />
          <AdditionalPreviewInfo
            project={project}
            isUserRegistered={isUserRegistered}
            analyticsSurface={analyticsSurface}
          />
        </Box>
      </Wrapper>
    </MetaDataRoot>
  );
};

export const CreatorAndCollaboratorPreviews = ({ collaborating_organization, project_parent }) => {
  const collaborating_organizations = collaborating_organization.slice(0, 2); // only show 2 collaborating orgs
  return (
    <>
      {project_parent && project_parent.parent_organization && (
        <InvolvedOrganizationsContainer>
          <CreatorOrganizationPreview
            organization={project_parent.parent_organization}
            size="tiny"
            nolink
          />
          {collaborating_organizations.length > 0 && (
            <>
              <HorizontalSpacing />
              <>{"+"}</>
              <HorizontalSpacing />
              {collaborating_organizations.map((co, index) => (
                <CreatorOrganizationPreview
                  key={index}
                  organization={co.collaborating_organization}
                  size="tiny"
                  nolink
                  doNotShowName
                />
              ))}
            </>
          )}
        </InvolvedOrganizationsContainer>
      )}

      {project_parent && !project_parent.parent_organization && project_parent.parent_user && (
        <CreatorProfilePreview profile={project_parent.parent_user} size="small" nolink />
      )}
    </>
  );
};

const AdditionalPreviewInfo = ({ project, isUserRegistered, analyticsSurface }) => {
  const { locale, user, ReactGA } = useContext(UserContext);
  const projectTypes = getProjectTypes(locale);
  const texts = getTexts({ page: "project", locale });
  const router = useRouter();

  const projectType = projectTypes.find((t) => t.type_id === project.project_type) ?? {
    name: project.project_type,
    type_id: project.project_type,
    original_name: project.project_type,
    help_text: "",
    icon: "",
  };

  const showRegisterButton = shouldShowRegisterButton(project);

  const getRegisterButtonConfig = () => {
    // Don't show button if registration is not enabled for this event
    if (!showRegisterButton) return null;

    // For logged-in users, wait until registration status is known to avoid
    // flashing "Register Now" when the user is actually registered.
    if (user && isUserRegistered === undefined) return null;

    // Anonymous users can safely be treated as not registered.
    const resolvedIsUserRegistered = isUserRegistered ?? false;

    const buttonText = getRegisterButtonText(project, texts, resolvedIsUserRegistered);
    const disabled = isRegisterButtonDisabled(project, resolvedIsUserRegistered);

    return {
      label: buttonText,
      disabled: disabled,
      variant: disabled ? "outlined" : "contained",
      color: disabled ? "secondary" : "primary",
    };
  };

  const buttonConfig = getRegisterButtonConfig();

  // Fire button impression event on mount when register button is visible
  useEffect(() => {
    if (analyticsSurface && buttonConfig) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdditionalInfoContainer>
      {(project.number_of_comments ?? 0) > 0 && (
        <AdditionalInfoIcon>
          <ModeCommentIcon />
          <AdditionalInfoCounter> {project.number_of_comments} </AdditionalInfoCounter>
        </AdditionalInfoIcon>
      )}
      {(project.number_of_likes ?? 0) > 2 && (
        <AdditionalInfoIcon>
          <FavoriteIcon />
          <AdditionalInfoCounter> {project.number_of_likes}</AdditionalInfoCounter>
        </AdditionalInfoIcon>
      )}
      <AdditionalInfoIcon>
        {((project.number_of_comments ?? 0) > 0 || (project.number_of_likes ?? 0) > 2) && (
          <>
            {" • "}
            <HorizontalSpacing />
          </>
        )}
        <ProjectTypeDisplay
          projectType={projectType}
          iconClassName={TYPE_ICON_CLASS}
          textClassName={METADATA_TEXT_CLASS}
          hasChildren={project.has_children}
        />
      </AdditionalInfoIcon>
      {buttonConfig && (
        <RegisterButton
          variant={buttonConfig.variant as any}
          color={buttonConfig.color as any}
          size="small"
          disabled={buttonConfig.disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!buttonConfig.disabled) {
              router.push(`${getLocalePrefix(locale)}/projects/${project.url_slug}/register`);
            }
          }}
        >
          {buttonConfig.label}
        </RegisterButton>
      )}
    </AdditionalInfoContainer>
  );
};

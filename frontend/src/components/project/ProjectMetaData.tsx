import { Box, Collapse, Container, Theme, Tooltip, Typography, Button } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
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

const useStyles = makeStyles<Theme, { hovering?: boolean }>((theme) => ({
  creatorImage: {
    height: 20,
    marginRight: theme.spacing(1),
    marginBottom: -5,
  },
  creator: {
    wordBreak: "break-word",
    marginBottom: theme.spacing(0.25),
  },
  cardIcon: {
    verticalAlign: "bottom",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(-0.25),
    fontSize: "default",
    color: theme.palette.background.default_contrastText,
  },
  categories: (props) => ({
    display: "flex",
    marginTop: theme.spacing(0.5),
    background: props.hovering ? "#e1e1e147" : "auto",
    padding: props.hovering ? theme.spacing(2) : 0,
    paddingTop: props.hovering ? theme.spacing(1) : 0,
    paddingBottom: props.hovering ? theme.spacing(1) : 0,
  }),
  categoryText: {
    marginTop: theme.spacing(0.5),
  },
  metadataText: {
    display: "inline",
    fontSize: 14,
    marginLeft: theme.spacing(0.25),
    color: theme.palette.text.primary,
  },
  shortDescription: {
    fontSize: 13,
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  },
  wrapper: (props) => ({
    padding: theme.spacing(2),
    paddingTop: 0,
    paddingBottom: props.hovering ? theme.spacing(0.5) : "auto",
  }),
  involvedOrganizationsContainer: {
    display: "flex",
    flexDirection: "row",
    marginBottom: theme.spacing(0.5),
  },
  horizontalSpacing: {
    marginLeft: theme.spacing(1),
  },
  additionalInfoIcon: {
    marginRight: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    color: theme.palette.background.default_contrastText,
  },
  additionalInfoContainer: {
    display: "flex",
    flexDirection: "row",
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(-0.25),
  },
  additionalInfoCounter: {
    marginLeft: theme.spacing(0.5),
    color: theme.palette.text.primary,
  },
  typeIcon: {
    width: 20,
    height: 20,
    marginLeft: 2,
    marginRight: 6,
  },
  registerButton: {
    marginLeft: "auto",
    fontSize: 11,
    padding: "4px 12px",
    height: 24,
    whiteSpace: "nowrap",
  },
}));

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
  const classes = useStyles({});
  return (
    <Box className={className}>
      <Container className={classes.wrapper}>
        <CreatorAndCollaboratorPreviews
          collaborating_organization={project.collaborating_organizations}
          project_parent={project_parent}
        />
        <Box>
          <LocationDisplay
            textClassName={classes.metadataText}
            iconClassName={classes.cardIcon}
            location={project.is_online ? texts.online : project.location}
          />
          {/* Defer to MUI's best guess on height calculation for timeout: https://material-ui.com/api/collapse/ */}
          <Collapse in={hovering} timeout="auto">
            <Typography className={classes.shortDescription}>
              {project.short_description}
            </Typography>
          </Collapse>
          {!hovering && (
            <ProjectSectorsDisplay
              main_project_sector={main_project_sector}
              projectSectorClassName={classes.metadataText}
              iconClassName={classes.cardIcon}
            />
          )}
          <AdditionalPreviewInfo
            project={project}
            isUserRegistered={isUserRegistered}
            analyticsSurface={analyticsSurface}
          />
        </Box>
      </Container>
      {hovering && (
        <ProjectSectorsDisplay
          main_project_sector={main_project_sector}
          hovering={hovering}
          projectSectorClassName={classes.metadataText}
          iconClassName={classes.cardIcon}
        />
      )}
    </Box>
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
  const classes = useStyles({});
  return (
    <Box className={className}>
      <Container className={classes.wrapper}>
        <CreatorAndCollaboratorPreviews
          collaborating_organization={project.collaborating_organizations}
          project_parent={project_parent}
        />
        <Box>
          <Tooltip title={texts.location}>
            <PlaceIcon className={classes.cardIcon} />
          </Tooltip>
          <Typography className={classes.metadataText}>
            {project.is_online ? texts.online : project.location}
          </Typography>
          <ProjectSectorsDisplay
            main_project_sector={main_project_sector}
            projectSectorClassName={classes.metadataText}
            iconClassName={classes.cardIcon}
          />
          <AdditionalPreviewInfo
            project={project}
            isUserRegistered={isUserRegistered}
            analyticsSurface={analyticsSurface}
          />
        </Box>
      </Container>
    </Box>
  );
};

export const CreatorAndCollaboratorPreviews = ({ collaborating_organization, project_parent }) => {
  const collaborating_organizations = collaborating_organization.slice(0, 2); // only show 2 collaborating orgs
  const classes = useStyles({});
  return (
    <>
      {project_parent && project_parent.parent_organization && (
        <div className={classes.involvedOrganizationsContainer}>
          <MiniOrganizationPreview
            className={classes.creator}
            organization={project_parent.parent_organization}
            size="tiny"
            nolink
          />
          {collaborating_organizations.length > 0 && (
            <>
              <div className={classes.horizontalSpacing} />
              <>{"+"}</>
              <div className={classes.horizontalSpacing} />
              {collaborating_organizations.map((co, index) => (
                <MiniOrganizationPreview
                  key={index}
                  className={classes.creator}
                  organization={co.collaborating_organization}
                  size="tiny"
                  nolink
                  doNotShowName
                />
              ))}
            </>
          )}
        </div>
      )}

      {project_parent && !project_parent.parent_organization && project_parent.parent_user && (
        <MiniProfilePreview
          className={classes.creator}
          profile={project_parent.parent_user}
          size="small"
          nolink
        />
      )}
    </>
  );
};

const AdditionalPreviewInfo = ({ project, isUserRegistered, analyticsSurface }) => {
  const classes = useStyles({});
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
    <Box className={classes.additionalInfoContainer}>
      {(project.number_of_comments ?? 0) > 0 && (
        <Box className={classes.additionalInfoIcon}>
          <ModeCommentIcon />
          <span className={classes.additionalInfoCounter}> {project.number_of_comments} </span>
        </Box>
      )}
      {(project.number_of_likes ?? 0) > 2 && (
        <Box className={classes.additionalInfoIcon}>
          <FavoriteIcon />
          <span className={classes.additionalInfoCounter}> {project.number_of_likes}</span>
        </Box>
      )}
      <Box className={classes.additionalInfoIcon}>
        {((project.number_of_comments ?? 0) > 0 || (project.number_of_likes ?? 0) > 2) && (
          <>
            {" • "}
            <div className={classes.horizontalSpacing} />
          </>
        )}
        <ProjectTypeDisplay
          projectType={projectType}
          iconClassName={classes.typeIcon}
          textClassName={classes.metadataText}
          hasChildren={project.has_children}
        />
      </Box>
      {buttonConfig && (
        <Button
          className={classes.registerButton}
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
        </Button>
      )}
    </Box>
  );
};

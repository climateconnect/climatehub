import { Card, CardContent, CardMedia, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import AppLink from "../general/AppLink";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import { getProjectTypes } from "../../../public/data/projectTypes";
import UserContext from "../context/UserContext";
import ProjectMetaData from "./ProjectMetaData";
import EventDateIndicator from "./EventDateIndicator";

const useStyles = makeStyles((theme) => {
  return {
    wrapper: {
      position: "relative",
      display: "block",
      height: "100%",
      paddingTop: theme.spacing(0.25),
    },
    root: {
      "&:hover": {
        cursor: "pointer",
        "box-shadow": "2px 2px 1px #EEE",
      },
      "-webkit-user-select": "none",
      "-moz-user-select": "none",
      "-ms-user-select": "none",
      userSelect: "none",
      backgroundColor: theme.palette.background.paper,
      borderRadius: 3,
      boxShadow: "3px 3px 8px #E0E0E0",
      position: "relative",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    },
    placeholderImg: {
      visibility: "hidden",
      width: "100%",
    },
    projectNameWrapper: {
      display: "block",
      marginBottom: theme.spacing(0.75),
      padding: theme.spacing(2),
      paddingBottom: 0,
    },
    projectName: {
      fontWeight: "bold",
      overflow: "hidden",
      lineHeight: 1.5,
      fontSize: 15,
      color: "rgba(0, 0, 0, 0.87)",
      wordBreak: "break-word",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      // @ts-ignore - WebkitBoxOrient is deprecated but still required for line-clamp to work
      WebkitBoxOrient: "vertical",
    },
    button: {
      marginTop: theme.spacing(1),
      margin: "0 auto",
      display: "block",
    },
    noUnderline: {
      textDecoration: "inherit",
      "&:hover": {
        textDecoration: "inherit",
      },
    },
    draftTriangle: {
      width: 0,
      height: 0,
      borderTop: "100px solid " + theme.palette.primary.main,
      borderRight: "100px solid transparent",
    },
    draftText: {
      transform: "rotate(-45deg)",
      display: "block",
      fontWeight: "bold",
      textTransform: "uppercase",
      marginTop: "-56px",
      marginLeft: "10px",
      fontSize: "20px",
      color: "white",
    },
    cardContent: {
      background: "white",
      padding: 0,
      height: "auto",
      width: "100%",
      visibility: "hidden",
      ["&:last-child"]: {
        padding: 0,
      },
    },
    cardContentWithDescription: {
      position: "absolute",
      visibility: "visible",
      background: theme.palette.background.paper,
      bottom: 0,
      minHeight: "100%",
    },
    cardContentWrapper: {
      position: "relative",
      flex: 1,
    },
  };
});

export default function ProjectPreview({
  project,
  projectRef,
  hubUrl,
  className,
  registeredEventSlugs,
  analyticsSurface,
}: any) {
  // DISABLED: Hover expansion effect causes registration button to jump/shift position (Issue #1885)
  // Keeping code in place for potential future re-enablement
  // const [hovering, setHovering] = useState(false);
  const hovering = false; // Hover effect disabled
  const { locale } = useContext(UserContext);
  const projectTypes = getProjectTypes(locale);
  const projectType = projectTypes.find((t) => t.type_id === project.project_type) ?? {
    name: project.project_type,
    type_id: project.project_type,
    original_name: project.project_type,
    help_text: "",
    icon: "",
  };
  const texts = getTexts({ page: "project", locale: locale });
  const classes = useStyles({ hovering: hovering });

  // DISABLED: Hover handlers (kept for potential future re-enablement)
  // const handleMouseEnter = () => {
  //   setHovering(true);
  // };
  // const handleMouseLeave = () => {
  //   setHovering(false);
  // };

  const projectUrl = project.is_draft
    ? `/editProject/${project.url_slug}`
    : `/projects/${project.url_slug}`;

  return (
    <AppLink
      href={projectUrl}
      underline="hover"
      className={`${classes.wrapper} ${classes.noUnderline}`}
    >
      {projectType.type_id === "event" && project.start_date && project.end_date && (
        <EventDateIndicator project={project} hubUrl={hubUrl} />
      )}
      <Card
        className={`${classes.root} ${className}`}
        variant="outlined"
        // DISABLED: Hover handlers (kept for potential future re-enablement)
        // onMouseEnter={handleMouseEnter}
        // onMouseLeave={handleMouseLeave}
        ref={projectRef}
      >
        <CardMedia
          /*TODO(undefined) className={classes.media} */
          title={project.name}
          image={getImageUrl(project.image)}
        >
          {project.is_draft ? (
            <div className={classes.draftTriangle}>
              <div className={classes.draftText}>Draft</div>
            </div>
          ) : (
            <img
              src={getImageUrl(project.image)}
              className={classes.placeholderImg}
              alt={texts.project_image_of_project + " " + project.name}
            />
          )}
        </CardMedia>
        <div className={classes.cardContentWrapper}>
          <CardContentWithDescription
            project={project}
            hovering={hovering}
            registeredEventSlugs={registeredEventSlugs}
            analyticsSurface={analyticsSurface}
          />
          <CardContentWithoutDescription
            project={project}
            hovering={hovering}
            registeredEventSlugs={registeredEventSlugs}
            analyticsSurface={analyticsSurface}
          />
        </div>
      </Card>
    </AppLink>
  );
}

const CardContentWithoutDescription = ({
  project,
  hovering,
  registeredEventSlugs,
  analyticsSurface,
}) => {
  const classes = useStyles();
  const isUserRegistered =
    registeredEventSlugs && project.url_slug
      ? registeredEventSlugs.has(project.url_slug)
      : undefined;
  return (
    <CardContent className={classes.cardContent}>
      <div className={classes.projectNameWrapper}>
        <Typography component="h2" className={classes.projectName}>
          {project.name}
        </Typography>
      </div>
      <ProjectMetaData
        project={project}
        hovering={hovering}
        isUserRegistered={isUserRegistered}
        analyticsSurface={analyticsSurface}
      />
    </CardContent>
  );
};

const CardContentWithDescription = ({
  project,
  hovering,
  registeredEventSlugs,
  analyticsSurface,
}) => {
  const classes = useStyles({ hovering: hovering });
  const isUserRegistered =
    registeredEventSlugs && project.url_slug
      ? registeredEventSlugs.has(project.url_slug)
      : undefined;

  return (
    <CardContent className={`${classes.cardContentWithDescription} ${classes.cardContent}`}>
      <div className={classes.projectNameWrapper}>
        <Typography component="h2" className={classes.projectName}>
          {project.name}
        </Typography>
      </div>
      <ProjectMetaData
        project={project}
        hovering={hovering}
        withDescription
        isUserRegistered={isUserRegistered}
        analyticsSurface={analyticsSurface}
      />
    </CardContent>
  );
};

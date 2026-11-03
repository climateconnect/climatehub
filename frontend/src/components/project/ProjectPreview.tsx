import { Card, CardContent, CardMedia, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import AppLink from "../general/AppLink";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import { getProjectTypes } from "../../../public/data/projectTypes";
import UserContext from "../context/UserContext";
import ProjectMetaData from "./ProjectMetaData";
import EventDateIndicator from "./EventDateIndicator";

// `noUnderline` came after `wrapper` in the original rules, so its properties win on equal keys.
const Wrapper = styled(AppLink)(({ theme }) => ({
  position: "relative",
  display: "block",
  height: "100%",
  paddingTop: theme.spacing(0.25),
  textDecoration: "inherit",
  "&:hover": {
    textDecoration: "inherit",
  },
}));

const PreviewCard = styled(Card)(({ theme }) => ({
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
}));

const PlaceholderImg = styled("img")({
  visibility: "hidden",
  width: "100%",
});

const ProjectNameWrapper = styled("div")(({ theme }) => ({
  display: "block",
  marginBottom: theme.spacing(0.75),
  padding: theme.spacing(2),
  paddingBottom: 0,
}));

const ProjectName = styled(Typography)<{ component?: React.ElementType }>({
  fontWeight: "bold",
  overflow: "hidden",
  lineHeight: 1.5,
  fontSize: 15,
  color: "rgba(0, 0, 0, 0.87)",
  wordBreak: "break-word",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
});

const DraftTriangle = styled("div")(({ theme }) => ({
  width: 0,
  height: 0,
  borderTop: "100px solid " + theme.palette.primary.main,
  borderRight: "100px solid transparent",
}));

const DraftText = styled("div")({
  transform: "rotate(-45deg)",
  display: "block",
  fontWeight: "bold",
  textTransform: "uppercase",
  marginTop: "-56px",
  marginLeft: "10px",
  fontSize: "20px",
  color: "white",
});

const PreviewCardContent = styled(CardContent)({
  background: "white",
  padding: 0,
  height: "auto",
  width: "100%",
  visibility: "hidden",
  ["&:last-child"]: {
    padding: 0,
  },
});

// `cardContentWithDescription` was defined after `cardContent`, so it wins on equal keys.
const PreviewCardContentWithDescription = styled(PreviewCardContent)(({ theme }) => ({
  position: "absolute",
  visibility: "visible",
  background: theme.palette.background.paper,
  bottom: 0,
  minHeight: "100%",
}));

const CardContentWrapper = styled("div")({
  position: "relative",
  flex: 1,
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
    <Wrapper href={projectUrl} underline="hover">
      {projectType.type_id === "event" && project.start_date && project.end_date && (
        <EventDateIndicator project={project} hubUrl={hubUrl} />
      )}
      <PreviewCard
        className={className}
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
            <DraftTriangle>
              <DraftText>Draft</DraftText>
            </DraftTriangle>
          ) : (
            <PlaceholderImg
              src={getImageUrl(project.image)}
              alt={texts.project_image_of_project + " " + project.name}
            />
          )}
        </CardMedia>
        <CardContentWrapper>
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
        </CardContentWrapper>
      </PreviewCard>
    </Wrapper>
  );
}

const CardContentWithoutDescription = ({
  project,
  hovering,
  registeredEventSlugs,
  analyticsSurface,
}) => {
  const isUserRegistered =
    registeredEventSlugs && project.url_slug
      ? registeredEventSlugs.has(project.url_slug)
      : undefined;
  return (
    <PreviewCardContent>
      <ProjectNameWrapper>
        <ProjectName component="h2">{project.name}</ProjectName>
      </ProjectNameWrapper>
      <ProjectMetaData
        project={project}
        hovering={hovering}
        isUserRegistered={isUserRegistered}
        analyticsSurface={analyticsSurface}
      />
    </PreviewCardContent>
  );
};

const CardContentWithDescription = ({
  project,
  hovering,
  registeredEventSlugs,
  analyticsSurface,
}) => {
  const isUserRegistered =
    registeredEventSlugs && project.url_slug
      ? registeredEventSlugs.has(project.url_slug)
      : undefined;

  return (
    <PreviewCardContentWithDescription>
      <ProjectNameWrapper>
        <ProjectName component="h2">{project.name}</ProjectName>
      </ProjectNameWrapper>
      <ProjectMetaData
        project={project}
        hovering={hovering}
        withDescription
        isUserRegistered={isUserRegistered}
        analyticsSurface={analyticsSurface}
      />
    </PreviewCardContentWithDescription>
  );
};

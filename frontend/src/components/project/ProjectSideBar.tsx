import React from "react";
import { Button, IconButton, Typography, Divider } from "@mui/material";
import { styled } from "@mui/material/styles";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import ProjectPreviews from "./ProjectPreviews";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import HubSupporters from "../hub/HubSupporters";
import { getWasseraktionswochenUrl } from "../../../public/data/wasseraktionswochen_config.js";

const SubHeader = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  marginBottom: theme.spacing(1),
}));

const StyledDivider = styled(Divider)(({ theme }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const SimilarProjectsContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$isSmallScreen",
})<{ $isSmallScreen: boolean }>(({ theme, $isSmallScreen }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  ...(!$isSmallScreen && {
    borderRadius: 10,
    backgroundColor: "#f0f2f5",
    maxWidth: "100%",
  }),
  // static class name passed to HubSupporters' `containerClass`
  "& .ProjectSideBar-supporterSlider": {
    width: "95%",
    marginTop: "8px",
    marginBottom: theme.spacing(2),
    [`@media (min-width: 900px) and (max-width: 1200px)`]: {
      marginLeft: 0,
    },
  },
}));

const ExpandButton = styled(Button)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

const ShowAllProjectsButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "$isSmallScreen",
})<{ $isSmallScreen: boolean }>(({ theme, $isSmallScreen }) => ({
  marginBottom: $isSmallScreen ? theme.spacing(0) : theme.spacing(1),
  marginTop: $isSmallScreen ? theme.spacing(0) : theme.spacing(1),
  fontSize: $isSmallScreen ? 14 : 12,
  width: $isSmallScreen ? "100%" : "95%",
  color: theme.palette.background.default_contrastText,
  borderColor: theme.palette.background.default_contrastText,
}));

export default function ProjectSideBar({
  similarProjects,
  handleHideContent,
  showSimilarProjects,
  locale,
  texts,
  isSmallScreen,
  hubSupporters,
  hubName,
  siblingProjects,
  isWasseraktionswochenEnabled,
  registeredEventSlugs,
  hubUrl,
}) {
  const link = getLocalePrefix(locale) + "/browse";
  const shouldDisplayOneProjectInRow = !isSmallScreen;

  // Determine what to show: siblings or similar projects
  const showingSiblings =
    isWasseraktionswochenEnabled && siblingProjects && siblingProjects.length > 0;
  const projectsToDisplay = showingSiblings ? siblingProjects : similarProjects;
  const hasProjectsToDisplay = !!projectsToDisplay?.length;
  const headerText = showingSiblings
    ? texts.events_in_this_series
    : texts.you_may_also_like_these_projects;

  // For Wasseraktionswochen events, link to the special event page
  const showAllLink = showingSiblings ? getWasseraktionswochenUrl(locale) : link;
  const showAllText = showingSiblings ? texts.show_all_events : texts.view_all_projects;

  return (
    <>
      {isSmallScreen ? (
        <>
          {hasProjectsToDisplay && (
            <>
              <StyledDivider />
              <SubHeader component="h2" variant="h6" color="background.default_contrastText">
                {headerText}
              </SubHeader>
            </>
          )}
        </>
      ) : (
        <>
          {hasProjectsToDisplay && (
            <IconButton size="small" onClick={handleHideContent}>
              <MenuIcon />
            </IconButton>
          )}
        </>
      )}
      <SimilarProjectsContainer $isSmallScreen={!!isSmallScreen}>
        {isSmallScreen && hasProjectsToDisplay && (
          <ExpandButton onClick={handleHideContent}>
            {showSimilarProjects ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ExpandButton>
        )}
        {showSimilarProjects && (
          <>
            {hubSupporters && (
              <HubSupporters
                supportersList={hubSupporters}
                containerClass="ProjectSideBar-supporterSlider"
                mobileVersion={isSmallScreen}
                hubName={hubName}
                hubUrl={hubUrl}
              />
            )}

            {hasProjectsToDisplay && (
              <>
                <ProjectPreviews
                  displayOnePreviewInRow={shouldDisplayOneProjectInRow}
                  projects={projectsToDisplay}
                  hubUrl={hubName}
                  registeredEventSlugs={registeredEventSlugs}
                  analyticsSurface="similar_projects_sidebar"
                />
                <ShowAllProjectsButton
                  variant="outlined"
                  $isSmallScreen={!!isSmallScreen}
                  href={showAllLink}
                >
                  <SearchIcon />
                  {showAllText}
                </ShowAllProjectsButton>
              </>
            )}
          </>
        )}
      </SimilarProjectsContainer>
    </>
  );
}

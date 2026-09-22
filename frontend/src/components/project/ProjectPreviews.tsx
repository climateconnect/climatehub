import React, { useContext, useMemo, useState } from "react";
import Grid from "@mui/material/Grid";
import makeStyles from "@mui/styles/makeStyles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import LoadingSpinner from "../general/LoadingSpinner";
import ProjectPreview from "./ProjectPreview";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";

const useStyles = makeStyles({
  reset: {
    margin: 0,
    padding: 0,
    listStyleType: "none",
    width: "100%",
  },
  items: {
    padding: "8px",
  },
});

// This component is to display projects with the option to infinitely scroll to get more projects
export default function ProjectPreviews({
  projects,
  featuredProjects,
  loadFunc,
  hasMore,
  hubUrl,
  isLoading = false,
  displayOnePreviewInRow,
  parentHandlesGridItems,
  registeredEventSlugs,
  analyticsSurface,
}: any) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  // Combine featured (e.g. upcoming events merged into the grid) with regular
  // projects, deduplicating by url_slug so the same project is never shown
  // twice. Featured items always appear first.
  const combinedProjects = useMemo(() => {
    const featured = featuredProjects || [];
    if (featured.length === 0) return projects || [];
    const featuredSlugs = new Set(featured.map((p) => p.url_slug));
    const dedupedProjects = (projects || []).filter((p) => !featuredSlugs.has(p.url_slug));
    return [...featured, ...dedupedProjects];
  }, [projects, featuredProjects]);

  const toProjectPreviews = (projects) =>
    (projects || []).map((p) => (
      <GridItem
        key={p.url_slug}
        project={p}
        hubUrl={hubUrl}
        registeredEventSlugs={registeredEventSlugs}
        analyticsSurface={analyticsSurface}
      />
    ));

  const [gridItems, setGridItems] = useState(toProjectPreviews(projects));

  const loadMore = async () => {
    if (loadFunc) {
      const newProjects = await loadFunc();
      if (!parentHandlesGridItems) {
        setGridItems([...gridItems, ...toProjectPreviews(newProjects)]);
      }
    }
  };

  const { lastElementRef } = useInfiniteScroll({
    hasMore: hasMore || false,
    isLoading: isLoading,
    onLoadMore: loadMore,
  });

  const displayedProjects = parentHandlesGridItems ? combinedProjects : gridItems;

  if (!displayedProjects || displayedProjects.length === 0) {
    return <div>{texts.no_projects_found}</div>;
  }

  const columnValuesFromBreakpoint = {
    xsValue: 12,
    smValue: displayOnePreviewInRow ? 12 : 6,
    mdValue: displayOnePreviewInRow ? 12 : 4,
    lgValue: displayOnePreviewInRow ? 12 : 3,
  } as const;

  return (
    <>
      <Grid container spacing={1} className={classes.reset} component="ul">
        {displayedProjects.map((project, index) => {
          const isLastElement = index === displayedProjects.length - 1;
          return (
            <Grid
              size={{
                xs: columnValuesFromBreakpoint.xsValue,
                sm: columnValuesFromBreakpoint.smValue,
                md: columnValuesFromBreakpoint.mdValue,
                lg: columnValuesFromBreakpoint.lgValue,
              }}
              key={project.props?.project?.url_slug || project.url_slug}
              component="li"
              ref={isLastElement ? lastElementRef : null}
              className={classes.items}
            >
              {project.props ? (
                project
              ) : (
                <ProjectPreview
                  project={project}
                  hubUrl={hubUrl}
                  registeredEventSlugs={registeredEventSlugs}
                  analyticsSurface={analyticsSurface}
                />
              )}
            </Grid>
          );
        })}
      </Grid>
      {isLoading && <LoadingSpinner isLoading />}
    </>
  );
}

function GridItem({ project, hubUrl, registeredEventSlugs, analyticsSurface }) {
  return (
    <ProjectPreview
      project={project}
      hubUrl={hubUrl}
      registeredEventSlugs={registeredEventSlugs}
      analyticsSurface={analyticsSurface}
    />
  );
}

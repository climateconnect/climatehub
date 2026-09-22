import { Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext, useEffect, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import LoadingContainer from "../general/LoadingContainer";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import { apiRequest } from "../../../public/lib/apiOperations";
import ShareProjectCallToAction from "./ShareProjectCallToAction";

const useStyles = makeStyles((theme) => ({
  root: {
    textAlign: "center",
    padding: theme.spacing(3),
    [theme.breakpoints.up("sm")]: {
      padding: theme.spacing(5),
    },
    marginTop: theme.spacing(4),
    maxWidth: theme.breakpoints.values.lg,
    marginLeft: "auto",
    marginRight: "auto",
  },
  headline: {
    marginBottom: theme.spacing(3),
  },
}));

export default function ProjectSubmittedPage({
  user,
  isDraft,
  url_slug,
  hasError,
  hubName,
  projectTypeId,
  projectName,
}) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({
    page: "project",
    locale: locale,
    user: user,
    url_slug: url_slug,
    hubName: hubName,
  });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const typeId = projectTypeId ?? "project";
  const [publishedProject, setPublishedProject] = useState<any>(null);
  const [publishedProjectFailed, setPublishedProjectFailed] = useState(false);

  //Load the freshly published project so its preview card can be shown as
  //visual confirmation that it is live (and as a way to get to the page)
  useEffect(() => {
    if (!url_slug || isDraft || hasError) return;
    apiRequest({
      method: "get",
      url: `/api/projects/${url_slug}/`,
      locale: locale,
    })
      .then((resp) => {
        const project = resp.data;
        setPublishedProject({
          ...project,
          //the detail endpoint returns project_type as an object, ProjectPreview
          //expects the type_id string like the list endpoint returns
          project_type: project.project_type?.type_id ?? project.project_type,
          //ProjectPreview expects flattened sectors, same transformation as parseProjects on browse
          sectors: project.sectors
            ? project.sectors.sort((a, b) => a.order - b.order).map((s) => s.sector)
            : [],
        });
      })
      .catch((error) => {
        //The call to action still works without the preview card
        console.error(error);
        setPublishedProjectFailed(true);
      });
  }, [url_slug, isDraft, hasError, locale]);

  return (
    <div className={classes.root}>
      {hasError ? (
        <Typography variant="h5" color="error" className={classes.headline}>
          {texts.there_has_been_an_error_when_trying_to_publish_your_project}
        </Typography>
      ) : !url_slug ? (
        <LoadingContainer headerHeight={233} footerHeight={120} />
      ) : isDraft ? (
        <>
          <Typography variant="h5" className={classes.headline}>
            {projectTypeTexts.draftProject[typeId]}
          </Typography>
          <Typography variant="h5" className={classes.headline}>
            {projectTypeTexts.editAndPublishDraftProject[typeId]}
          </Typography>
        </>
      ) : (
        <ShareProjectCallToAction
          url_slug={url_slug}
          projectTypeId={typeId}
          projectName={projectName}
          hubName={hubName}
          hasRegistration={publishedProject ? publishedProject.registration_config != null : false}
          previewProject={publishedProject}
          previewProjectFailed={publishedProjectFailed}
        />
      )}
    </div>
  );
}

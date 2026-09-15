import { Link, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import NextCookies from "next-cookies";
import React, { useContext, useState } from "react";
import ROLE_TYPES from "../../public/data/role_types";
import { apiRequest, getLocalePrefix, sendToLogin } from "../../public/lib/apiOperations";
import { getProjectTypeOptions, getSectorOptions } from "../../public/lib/getOptions";
import { getImageUrl } from "../../public/lib/imageOperations";
import { getUserOrganizations } from "../../public/lib/organizationOperations";
import { nullifyUndefinedValues } from "../../public/lib/profileOperations";
import getTexts from "../../public/texts/texts";
import UserContext from "../../src/components/context/UserContext";
import EditProjectRoot from "../../src/components/editProject/EditProjectRoot";
import LoginNudge from "../../src/components/general/LoginNudge";
import Layout from "../../src/components/layouts/layout";
import WideLayout from "../../src/components/layouts/WideLayout";
import getHubTheme from "../../src/themes/fetchHubTheme";
import { transformThemeData } from "../../src/themes/transformThemeData";
import { Project, Sector } from "../../src/types";
import theme from "../../src/themes/theme";

const useStyles = makeStyles((theme) => ({
  root: {
    textAlign: "center",
  },
  errorTitle: {
    textAlign: "center",
    marginTop: theme.spacing(8),
  },
}));

export async function getServerSideProps(ctx) {
  const { auth_token } = NextCookies(ctx);
  const texts = getTexts({ page: "project", locale: ctx.locale });
  if (ctx.req && !auth_token) {
    const message = texts.please_log_in_to_edit_project;
    return sendToLogin(ctx, message);
  }
  const projectUrl = encodeURI(ctx.query.projectUrl);
  const hubUrl = ctx.query.hub;
  const [
    project,
    members,
    userOrganizations,
    projectTypeOptions,
    hubThemeData,
    sectorOptions,
  ] = await Promise.all([
    getProjectByIdIfExists(projectUrl, auth_token, ctx.locale),
    getMembersByProject(projectUrl, auth_token, ctx.locale),
    getUserOrganizations(auth_token, ctx.locale),
    getProjectTypeOptions(ctx.locale),
    getHubTheme(hubUrl),
    getSectorOptions(ctx.locale),
  ]);
  return {
    props: nullifyUndefinedValues({
      project: project,
      members: members,
      userOrganizations: userOrganizations,
      projectTypeOptions: projectTypeOptions,
      hubThemeData: hubThemeData,
      hubUrl: hubUrl,
      sectorOptions: sectorOptions,
    }),
  };
}

export default function EditProjectPage({
  project,
  members,
  userOrganizations,
  projectTypeOptions,
  hubThemeData,
  hubUrl,
  sectorOptions,
}: {
  project: Project;
  members: any[];
  userOrganizations: any[];
  projectTypeOptions: any[];
  hubThemeData: any;
  hubUrl: string;
  sectorOptions: Sector[];
}) {
  const classes = useStyles();
  const [curProject, setCurProject] = useState({
    ...project,
    hubUrl: project?.related_hubs?.length ? project.related_hubs[0] : null,
  });

  // add all sectors that are assigned to the project to the possible sectors
  // so that, when editing a project with e.g. specific sectors all sectors - even

  // hub specific ones are available
  if (project.sectors) {
    for (const sector of project.sectors) {
      // match by sector.key
      const exists = sectorOptions.find((s) => s.key === sector.key);
      if (!exists) {
        sectorOptions.push(sector);
      }
    }
    // sort sectors by name
    sectorOptions.sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  project = {
    ...project,
  };
  const [errorMessage, setErrorMessage] = useState("");
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  const handleSetErrorMessage = (newErrorMessage) => {
    setErrorMessage(newErrorMessage);
  };
  const handleSetProject = (newProject) => {
    setCurProject({ ...newProject });
  };
  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;

  if (!user)
    return (
      <WideLayout
        title={texts.please_log_in_to_edit_project}
        customTheme={customTheme}
        headerBackground={
          customTheme ? customTheme.palette.header.background : theme.palette.background.default
        }
        hubUrl={hubUrl}
      >
        <LoginNudge fullPage whatToDo={texts.to_edit_this_project} />
      </WideLayout>
    );
  else if (!project)
    return (
      <Layout className={classes.root} title={texts.project_not_found}>
        <Typography className={classes.errorTitle} variant="h3">
          {texts.project_does_not_exist}{" "}
          <Link href={getLocalePrefix(locale) + "/share"} underline="hover">
            {texts.click_here}
          </Link>{" "}
          {texts.to_create_a_project}
        </Typography>
      </Layout>
    );
  else if (!members.find((m) => m.user && m.user.id === user.id))
    return (
      <WideLayout
        title={texts.not_a_member}
        customTheme={customTheme}
        headerBackground={
          customTheme ? customTheme.palette.header.background : theme.palette.background.default
        }
        hubUrl={hubUrl}
      >
        <Typography variant="h4" color="primary" className={classes.errorTitle}>
          {texts.not_a_member}. {texts.go_to_the}{" "}
          <a href={getLocalePrefix(locale) + "/projects/" + project.url_slug}>
            {texts.project_page}
          </a>{" "}
          {texts.and_ask_to_be_part_of_the_team}
        </Typography>
      </WideLayout>
    );
  else if (
    members.find((m) => m.user && m.user.id === user.id).role.role_type != ROLE_TYPES.all_type &&
    members.find((m) => m.user && m.user.id === user.id).role.role_type !=
      ROLE_TYPES.read_write_type
  )
    return (
      <WideLayout
        title={texts.no_permissions_to_edit_project}
        customTheme={customTheme}
        headerBackground={
          customTheme ? customTheme.palette.header.background : theme.palette.background.default
        }
        hubUrl={hubUrl}
      >
        <Typography variant="h4" color="primary" className={classes.errorTitle}>
          {texts.need_to_be_admin_to_manage_project_team}
        </Typography>
      </WideLayout>
    );
  else {
    const user_role = members.find((m) => m.user && m.user.id === user.id).role;
    return (
      <WideLayout
        title={texts.edit_project + " " + project.name}
        message={errorMessage}
        messageType={errorMessage && "error"}
        customTheme={customTheme}
        headerBackground={
          customTheme ? customTheme.palette.header.background : theme.palette.background.default
        }
        hubUrl={hubUrl}
      >
        <EditProjectRoot
          oldProject={project}
          project={curProject}
          userOrganizations={userOrganizations}
          handleSetProject={handleSetProject}
          sectorOptions={sectorOptions}
          user_role={user_role}
          handleSetErrorMessage={handleSetErrorMessage}
          initialTranslations={project.translations}
          projectTypeOptions={projectTypeOptions}
          hubUrl={hubUrl}
        />
      </WideLayout>
    );
  }
}

async function getProjectByIdIfExists(projectUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/?edit_view=true",
      token: token,
      locale: locale,
    });
    if (resp.data.length === 0) return null;
    else {
      return parseProject(resp.data);
    }
  } catch (err: any) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

const parseProject = (project) => ({
  ...project,
  image: getImageUrl(project.image),
  project_parents: project.project_parents[0],
  is_personal_project: !project.project_parents[0].parent_organization,
  sectors: project.sectors.map((item) => ({ ...item.sector, order: item.order })),
});

async function getMembersByProject(projectUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/members/",
      token: token,
      locale: locale,
    });
    if (!resp.data) return null;
    else {
      return resp.data.results;
    }
  } catch (err: any) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

import { Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import Cookies from "next-cookies";
import React, { useContext, useState } from "react";

import ROLE_TYPES from "../../public/data/role_types";
import { apiRequest, sendToLogin } from "../../public/lib/apiOperations";
import getTexts from "../../public/texts/texts";
import UserContext from "../../src/components/context/UserContext";
import LoginNudge from "../../src/components/general/LoginNudge";
import Layout from "../../src/components/layouts/layout";
import WideLayout from "../../src/components/layouts/WideLayout";
import ManageProjectMembers from "../../src/components/project/ManageProjectMembers";
import getHubTheme from "../../src/themes/fetchHubTheme";
import { transformThemeData } from "../../src/themes/transformThemeData";
import theme from "../../src/themes/theme";

const useStyles = makeStyles((theme) => {
  return {
    headline: {
      textAlign: "center",
      marginTop: theme.spacing(4),
    },
  };
});

export async function getServerSideProps(ctx) {
  const { auth_token } = Cookies(ctx);
  const texts = getTexts({ page: "project", locale: ctx.locale });
  if (ctx.req && !auth_token) {
    const message = texts.you_have_to_log_in_to_manage_a_projects_members;
    return sendToLogin(ctx, message);
  }
  const projectUrl = encodeURI(ctx.query.projectUrl);
  const hubUrl = ctx?.query?.hub ? ctx.query.hub : null;
  const [project, members, rolesOptions, availabilityOptions, hubThemeData] = await Promise.all([
    getProjectByUrlIfExists(projectUrl, auth_token, ctx.locale),
    getMembersByProject(projectUrl, auth_token, ctx.locale),
    getRolesOptions(auth_token, ctx.locale),
    getAvailabilityOptions(auth_token, ctx.locale),
    hubUrl ? getHubTheme(hubUrl) : null,
  ]);

  return {
    props: {
      project: project,
      members: members,
      rolesOptions: rolesOptions,
      availabilityOptions: availabilityOptions,
      token: auth_token,
      hubUrl: hubUrl || null,
      hubThemeData: hubThemeData,
    },
  };
}

export default function ManageProjectMembersPage({
  project,
  members,
  availabilityOptions,
  rolesOptions,
  token,
  hubUrl,
  hubThemeData,
}) {
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });
  const classes = useStyles();
  const [currentMembers, setCurrentMembers] = useState(
    members ? [...members.sort((a, b) => b.role.role_type - a.role.role_type)] : []
  );
  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;
  const layoutProps = {
    hubUrl: hubUrl,
    customTheme: customTheme,
    headerBackground: customTheme
      ? customTheme.palette.header.background
      : theme.palette.background.default,
  };
  if (!user)
    return (
      <WideLayout
        title={texts.please_log_in + " " + texts.to_manage_the_members_of_this_project}
        hideHeadline
        {...layoutProps}
      >
        <LoginNudge fullPage whatToDo={texts.to_manage_the_members_of_this_project} />
      </WideLayout>
    );
  else if (!members.find((m) => m.id === user.id))
    return (
      <WideLayout
        title={texts.please_log_in + " " + texts.to_manage_the_members_of_this_project}
        hideHeadline
        {...layoutProps}
      >
        <Typography variant="h4" color="primary" className={classes.headline}>
          {texts.you_are_not_a_member_of_this_project}{" "}
        </Typography>
      </WideLayout>
    );
  else if (
    members.find((m) => m.id === user.id).role.role_type != ROLE_TYPES.all_type &&
    members.find((m) => m.id === user.id).role.role_type != ROLE_TYPES.read_write_type
  )
    return (
      <WideLayout
        title={texts.no_permission_to_manage_members_of_this_project}
        // TODO remove hideHeadline props, we are not using it in the WideLayout component
        hideHeadline
        {...layoutProps}
      >
        <Typography variant="h4" color="primary" className={classes.headline}>
          {texts.you_need_to_be_an_administrator_of_the_project_to_manage_project_members}
        </Typography>
      </WideLayout>
    );
  else {
    return (
      <Layout title={texts.manage_projects_members} hideHeadline {...layoutProps}>
        <ManageProjectMembers
          user={user}
          members={members}
          currentMembers={currentMembers}
          setCurrentMembers={setCurrentMembers}
          rolesOptions={rolesOptions}
          project={project}
          token={token}
          availabilityOptions={availabilityOptions}
        />
      </Layout>
    );
  }
}

async function getProjectByUrlIfExists(projectUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/",
      token: token,
      locale: locale,
    });
    return parseProject(resp.data);
  } catch (err) {
    //console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

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
      return parseProjectMembers(resp.data.results);
    }
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

function parseProjectMembers(members) {
  return members.map((m) => {
    const member = m.user;
    return {
      ...member,
      member_id: m.id,
      id: member.id,
      image: process.env.API_URL + member.image,
      name: member.first_name + " " + member.last_name,
      role: m.role,
      availability: m.availability,
      role_in_project: m.role_in_project ? m.role_in_project : "",
      location: member.location,
      isCreator: m.role.role_type === ROLE_TYPES.all_type,
    };
  });
}

// TODO duplicated code? projects/[projectId.tsx] also has this function
function parseProject(project) {
  return {
    name: project.name,
    id: project.id,
    url_slug: project.url_slug,
    image: project.image,
    location: project.location,
    description_html: project.description_html,
    short_description: project.short_description,
    collaborators_welcome: project.collaborators_welcome,
    start_date: project.start_date,
    end_date: project.end_date,
    creation_date: project.created_at,
    creator: project.project_parents[0].parent_organization
      ? project.project_parents[0].parent_organization
      : project.project_parents[0].parent_user,
    isPersonalProject: !project.project_parents[0].parent_organization,
    collaborating_organizations: project.collaborating_organizations.map(
      (o) => o.collaborating_organization
    ),
  };
}

const getRolesOptions = async (token, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/roles/",
      token: token,
      locale: locale,
    });
    if (resp.data.results.length === 0) return null;
    else {
      return resp.data.results;
    }
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
};

const getAvailabilityOptions = async (token, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/availability/",
      token: token,
      locale: locale,
    });
    if (resp.data.results.length === 0) return null;
    else {
      return resp.data.results;
    }
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
};

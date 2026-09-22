import { Button, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext, useState } from "react";
import ROLE_TYPES from "../../../public/data/role_types";
import { apiRequest, redirect } from "../../../public/lib/apiOperations";
import { appHref } from "../../../public/lib/appLink";
import { HubContext } from "../context/HubContext";
import { hasGreaterRole } from "../../../public/lib/manageMembers";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ManageMembers from "../manageMembers/ManageMembers";

const useStyles = makeStyles((theme) => {
  return {
    headline: {
      textAlign: "center",
      marginTop: theme.spacing(4),
      color: theme.palette.background.default_contrastText,
    },
    buttons: {
      float: "right",
    },
    button: {
      marginRight: theme.spacing(2),
    },
    cancelleButton: {
      backgroundColor: theme.palette.grey[800],
      "&:hover": {
        backgroundColor: theme.palette.grey[900],
      },
      color: theme.palette.background.default,
    },
    buttonsContainer: {
      height: 40,
      width: "100%",
    },
  };
});

export default function ManageProjectMembers({
  user,
  members,
  currentMembers,
  setCurrentMembers,
  rolesOptions,
  project,
  token,
  availabilityOptions,
}) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });
  const [user_role, setUserRole] = useState(members.find((m) => m.id === user.id).role);
  if (!user_role) setUserRole(members.find((m) => m.id === user.id).role);
  const handleSetCurrentMembers = (newValue, newUserRoleValue) => {
    setCurrentMembers(newValue);
    if (newUserRoleValue) setUserRole(newUserRoleValue);
  };
  const handleSubmit = (event) => {
    event.preventDefault();
    // add hubUrl to the redirect if it exists
    const getRedirectData = (messageKey) => {
      const data: {
        message?: string;
        errorMessage?: string;
        hub?: string;
      } =
        messageKey === "success"
          ? { message: texts.you_have_successfully_updated_your_team }
          : { errorMessage: texts.not_all_your_updates_have_worked };

      if (hubUrl) data.hub = hubUrl;
      return data;
    };

    onSubmit()
      .then((ret) => {
        if (ret !== false) redirect("/projects/" + project.url_slug, getRedirectData("success"));
      })
      .catch((e) => {
        console.log(e);
        redirect("/projects/" + project.url_slug, getRedirectData("error"));
      });
  };

  const onSubmit = async () => {
    if (!verifyInput()) return false;
    const allChangedMembers = getAllChangedMembers();
    return Promise.all(
      allChangedMembers.map((m) => {
        if (m.operation === "delete") deleteMember(m, locale);
        if (m.operation === "update") updateMember(m, locale);
        if (m.operation === "create") {
          createMembers(m.team_members, locale);
        }
        if (m.operation === "creator_change") {
          updateCreator(m.new_creator, locale);
        }
      })
    );
  };

  const getAllChangedMembers = () => {
    const oldCreatorId = members.filter((m) => m.role.role_type === ROLE_TYPES.all_type)[0].id;
    const newCreatorId = currentMembers.filter((m) => m.role.role_type === ROLE_TYPES.all_type)[0]
      .id;
    const deletedMembers = members.filter((m) => !currentMembers.find((cm) => cm.id === m.id));
    const creatorChange =
      oldCreatorId != newCreatorId ? currentMembers.filter((cm) => cm.id === newCreatorId) : [];
    const createdMembers = currentMembers.filter(
      (cm) =>
        !members.find((m) => m.id === cm.id) &&
        !creatorChange.find((m) => m.id === cm.id) &&
        !(oldCreatorId != newCreatorId && cm.id === oldCreatorId)
    );
    const updatedMembers = currentMembers.filter(
      (cm) =>
        !members.includes(cm) &&
        !createdMembers.includes(cm) &&
        !creatorChange.find((m) => m.id === cm.id) &&
        !(oldCreatorId != newCreatorId && cm.id === oldCreatorId)
    );
    const allChangedMembers = [
      ...deletedMembers.map((m) => ({ ...m, operation: "delete" })),
      ...updatedMembers.map((m) => ({ ...m, operation: "update" })),
    ];
    if (createdMembers.length > 0)
      allChangedMembers.push({ team_members: [...createdMembers], operation: "create" });

    if (creatorChange.length > 0)
      allChangedMembers.push({ new_creator: creatorChange[0], operation: "creator_change" });

    return allChangedMembers;
  };

  const verifyInput = () => {
    if (currentMembers.filter((cm) => cm.role.role_type === ROLE_TYPES.all_type).length !== 1) {
      alert(texts.there_must_be_exactly_one_creator_of_a_project);
      return false;
    }
    if (!members.filter((m) => m.role.role_type === ROLE_TYPES.all_type).length === 1) {
      alert(texts.error_no_creator);
      return false;
    }
    return true;
  };

  const canEdit = (member) => {
    return member.id === user.id || hasGreaterRole(user_role.role_type, member.role.role_type);
  };

  const deleteMember = (m, locale) => {
    apiRequest({
      method: "delete",
      url: "/api/projects/" + project.url_slug + "/members/" + m.member_id + "/",
      token: token,
      locale: locale,
    }).catch(console.error);
  };

  const updateMember = (m, locale) => {
    apiRequest({
      method: "patch",
      url: "/api/projects/" + project.url_slug + "/members/" + m.member_id + "/",
      token: token,
      payload: parseMemberForUpdateRequest(m, project),
      locale: locale,
    }).catch(console.error);
  };

  const createMembers = (team_members, locale) => {
    apiRequest({
      method: "post",
      url: "/api/projects/" + project.url_slug + "/add_members/",
      token: token,
      payload: parseMembersForCreateRequest(team_members, project),
      locale: locale,
    }).catch(console.error);
  };

  const updateCreator = (new_creator, locale) => {
    apiRequest({
      method: "post",
      url: "/api/projects/" + project.url_slug + "/change_creator/",
      token: token,
      payload: parseMemberForUpdateRequest(new_creator, project),
      locale: locale,
    }).catch(console.error);
  };
  return (
    <>
      <Typography variant="h4" className={classes.headline}>
        {texts.manage_members_of_project}
      </Typography>
      <form onSubmit={handleSubmit}>
        <ManageMembers
          currentMembers={currentMembers}
          rolesOptions={rolesOptions}
          setCurrentMembers={handleSetCurrentMembers}
          availabilityOptions={availabilityOptions}
          user={user}
          canEdit={canEdit}
          role_property_name="role_in_project"
          user_role={user_role}
          setUserRole={setUserRole}
        />
        <div className={classes.buttonsContainer}>
          <div className={classes.buttons}>
            <Button
              className={`${classes.button} ${classes.cancelleButton}`}
              href={appHref("/projects/" + project.url_slug, { hubUrl, locale })}
              variant="contained"
            >
              {texts.cancel}
            </Button>
            <Button className={classes.button} variant="contained" color="primary" type="submit">
              {texts.save}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

const parseMembersForCreateRequest = (members) => {
  return {
    team_members: members.map((m) => {
      const parsedMem = {
        ...m,
        permission_type_id: m.role.id,
        role_in_project: m.role_in_project ? m.role_in_project : "",
      };
      if (m.availability) {
        parsedMem.availability = m.availability.id;
      }
      return parsedMem;
    }),
  };
};

const parseMemberForUpdateRequest = (m, project) => {
  return {
    id: m.member_id,
    user: m.id,
    role: m.role.id,
    role_in_project: m.role_in_project ? m.role_in_project : "",
    project: project.id,
    availability: m.availability.id,
  };
};

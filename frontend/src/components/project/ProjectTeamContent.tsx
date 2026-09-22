import { Button, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import React, { useContext, useEffect } from "react";

import ROLE_TYPES from "../../../public/data/role_types";
import { appHref } from "../../../public/lib/appLink";
import { HubContext } from "../context/HubContext";
import getTexts from "../../../public/texts/texts";
import { NOTIFICATION_TYPES } from "../communication/notifications/Notification";
import UserContext from "../context/UserContext";
import LoginNudge from "../general/LoginNudge";
import ProfilePreviews from "./../profile/ProfilePreviews";

const useStyles = makeStyles((theme) => ({
  editButton: {
    float: "right",
    marginBottom: theme.spacing(1),
  },
  leaveProjectButton: {
    float: "right",
    background: theme.palette.error.main,
    color: "white",
    ["&:hover"]: {
      backgroundColor: theme.palette.error.main,
    },
  },
}));

function getTeamWithAdditionalInfo(team, texts) {
  return team.map((m) => {
    const additionalInfo = [];
    if (m.location) {
      additionalInfo.push({
        text: m.location,
        importance: "high",
        icon: LocationOnIcon,
        iconName: "LocationOnIcon",
        toolTipText: texts.location,
      });
    }

    if (m.role) {
      additionalInfo.push({
        text: m.role,
        importance: "high",
        icon: AccountBoxIcon,
        iconName: "AccountBoxIcon",
        toolTipText: texts.role_in_project,
      });
    }

    if (m.availability && m.availability !== "not_specified") {
      additionalInfo.push({
        text: m.availability.name,
        importance: "low",
      });
    }

    return { ...m, additionalInfo: additionalInfo };
  });
}

export default function TeamContent({ project, handleReadNotifications }) {
  const { user, locale } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);
  const texts = getTexts({ page: "project", locale: locale });
  const classes = useStyles();
  useEffect(() => {
    const readNotifications = async () => {
      try {
        await handleReadNotifications(NOTIFICATION_TYPES.indexOf("project_join_request_approved"));
      } catch (error) {
        console.error("Error reading notifications:", error);
      }
    };
    void readNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not logged in
  if (!user) {
    return <LoginNudge whatToDo={texts.to_see_this_projects_team_members} />;
  }

  // TODO: admin access, review members
  if (project.team) {
    return (
      <>
        {user && !!project.team.find((m) => m.id === user.id) && (
          <>
            {[ROLE_TYPES.all_type, ROLE_TYPES.read_write_type].includes(
              project.team.find((m) => m.id === user.id).permission
            ) && (
              <Button
                className={classes.editButton}
                variant="contained"
                href={appHref("/manageProjectMembers/" + project.url_slug, { hubUrl, locale })}
              >
                {texts.manage_members}
              </Button>
            )}
          </>
        )}
        <ProfilePreviews
          profiles={getTeamWithAdditionalInfo(project.team, texts)}
          allowMessage
          showAdditionalInfo={true}
          parentHandlesGridItems={true}
        />
      </>
    );
  }

  return <Typography>{texts.we_could_not_find_any_members_of_this_project}</Typography>;
}

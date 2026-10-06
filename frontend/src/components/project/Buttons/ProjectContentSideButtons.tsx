import React, { useContext, useEffect, useState } from "react";
import { Button, Badge, useMediaQuery, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import Cookies from "universal-cookie";
import dayjs from "dayjs";

import GroupAddIcon from "@mui/icons-material/GroupAdd";
import EditIcon from "@mui/icons-material/Edit";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import SettingsIcon from "@mui/icons-material/Settings";

import UserContext from "../../context/UserContext";
import ROLE_TYPES from "../../../../public/data/role_types";
import getTexts from "../../../../public/texts/texts";
import { getMembershipRequests } from "../../../../public/lib/projectOperations";
import ProjectRequestersDialog from "../../dialogs/ProjectRequestersDialog";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import JoinButton from "./JoinButton";
import theme from "../../../themes/theme";
import EditEventRegistrationModal from "../EditEventRegistrationModal";

const MemberButtons = styled("div")({
  float: "right",
  display: "flex",
  flexDirection: "column",
});

const EditProjectButtonBase = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

// editProjectButton + showRequestsButton were applied together (the latter wins)
const ShowRequestsDesktopButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1),
  background: "#f7f7f7",
  color: theme.palette.secondary.main,
  "&:hover": {
    background: "#e3e3e3",
  },
}));

const LeaveProjectDesktopButton = styled(Button)(({ theme }) => ({
  // TODO: we should really encapsulate
  // spacing style into specific spacing components, akin
  // to what Braid's <Box /> component does. This makes
  // the frontend code more maintainable, and spacing more deterministic
  marginTop: theme.spacing(1),
  background: theme.palette.error.main,
  color: "white",
  ["&:hover"]: {
    backgroundColor: theme.palette.error.main,
  },
}));

const StyledJoinButton = styled(JoinButton)({
  float: "right",
});

const SideIconButton = styled(IconButton)(({ theme }) => ({
  color: "white",
  marginBottom: theme.spacing(1),
  backgroundColor: theme.palette.primary.main,
  "&:hover": {
    backgroundColor: "#36797e",
  },
}));

// iconButton + leaveIconButton were applied together (the latter wins)
const LeaveSideIconButton = styled(SideIconButton)(({ theme }) => ({
  background: theme.palette.error.main,
  "&:hover": {
    backgroundColor: "#c96262",
  },
}));

export default function ProjectContentSideButtons({
  project,
  showRequesters,
  toggleShowRequests,
  handleSendProjectJoinRequest,
  requestedToJoinProject,
  leaveProject,
  hubUrl,
  eventRegistration,
  onEventRegistrationUpdated,
  onMembersRefreshed,
}) {
  const token = new Cookies().get("auth_token");
  const { user, locale, CUSTOM_HUB_URLS } = useContext(UserContext);
  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);

  const texts = getTexts({ page: "project", locale: locale, project: project });
  const isNarrowScreen = useMediaQuery(theme.breakpoints.down("md"));

  const user_permission =
    user && project.team && project.team.find((m) => m.id === user.id)
      ? project.team.find((m) => m.id === user.id).permission
      : null;
  const hasAdminPermissions = [ROLE_TYPES.all_type, ROLE_TYPES.read_write_type].includes(
    user_permission
  );

  const [editRegistrationOpen, setEditRegistrationOpen] = useState(false);

  const isEventEnded = project.end_date ? dayjs(project.end_date).isBefore(dayjs()) : false;

  const showRegistrationButtons =
    project.project_type?.type_id === "event" &&
    eventRegistration != null &&
    hasAdminPermissions &&
    !isEventEnded;

  const [requesters, setRequesters] = useState([]);
  const [requestersRetrieved, setRequestersRetrieved] = useState(false);
  const queryString = hubUrl ? `?hub=${hubUrl}` : "";

  const handleRequestersUpdated = async (updatedRequesters) => {
    setRequesters(updatedRequesters);
    if (onMembersRefreshed) {
      await onMembersRefreshed();
    }
  };

  async function refreshRequesters() {
    // short circuit if the user doesn't have the necessary permissions to see join requests
    if (!(user_permission && hasAdminPermissions)) {
      return;
    }
    try {
      const membershipRequests = await getMembershipRequests(project.url_slug, locale, token);
      const userRequests = membershipRequests.map((r) => ({
        requestId: r.id,
        user: r.user_profile,
      }));
      setRequesters(userRequests);
      setRequestersRetrieved(true);
    } catch (e) {
      console.log(e.response.data);
    }
  }

  // Fetch and populate requesters on initial load
  useEffect(() => {
    (async () => {
      await refreshRequesters();
    })();
  }, []);

  const ShowRequestsButton = () => {
    if (isNarrowScreen) {
      return (
        <Badge badgeContent={requesters.length} color="error">
          <SideIconButton size="large" onClick={toggleShowRequests}>
            <GroupAddIcon />
          </SideIconButton>
        </Badge>
      );
    } else {
      return (
        <Badge badgeContent={requesters.length} color="primary">
          <ShowRequestsDesktopButton variant="contained" onClick={toggleShowRequests} fullWidth>
            {texts.review_join_requests}
          </ShowRequestsDesktopButton>
        </Badge>
      );
    }
  };

  const EditProjectButton = () => {
    if (isNarrowScreen) {
      return (
        <SideIconButton
          size="large"
          href={getLocalePrefix(locale) + "/editProject/" + project.url_slug + queryString}
        >
          <EditIcon />
        </SideIconButton>
      );
    } else {
      return (
        <EditProjectButtonBase
          variant="contained"
          href={getLocalePrefix(locale) + "/editProject/" + project.url_slug + queryString}
        >
          {project.is_draft ? texts.edit_draft : texts.edit}
        </EditProjectButtonBase>
      );
    }
  };

  const EditRegistrationButton = () => {
    if (isNarrowScreen) {
      return (
        <SideIconButton
          size="large"
          onClick={() => setEditRegistrationOpen(true)}
          aria-label={texts.edit_registration_settings}
        >
          <SettingsIcon />
        </SideIconButton>
      );
    } else {
      return (
        <EditProjectButtonBase
          variant="outlined"
          color="primary"
          onClick={() => setEditRegistrationOpen(true)}
          aria-label={texts.edit_registration_settings}
        >
          {texts.edit_registration_settings}
        </EditProjectButtonBase>
      );
    }
  };

  const LeaveProjectButton = () => {
    if (isNarrowScreen) {
      return (
        <LeaveSideIconButton size="large" onClick={leaveProject}>
          <ExitToAppIcon />
        </LeaveSideIconButton>
      );
    } else {
      return (
        <LeaveProjectDesktopButton variant="contained" onClick={leaveProject}>
          {texts.leave_project}
        </LeaveProjectDesktopButton>
      );
    }
  };

  return (
    <div>
      {user && project.team && project.team.find((m) => m.id === user.id) && (
        <MemberButtons>
          {user_permission && hasAdminPermissions && (
            <>
              {/* Badge is dynamic based on the number of membership requesters */}
              <ShowRequestsButton />
              <EditProjectButton isCustomHub={isCustomHub} />
              {showRegistrationButtons && <EditRegistrationButton />}
            </>
          )}
          {/* Otherwise if not a project admin, just show the Leave Project button */}
          <LeaveProjectButton />
        </MemberButtons>
      )}

      {/* If the user is an admin on the project, or is already part
        of the project (has read only permissions), then we don't want to show the membership request button. */}
      {!hasAdminPermissions &&
        project.project_type.type_id !== "event" &&
        !(user_permission && [ROLE_TYPES.read_only_type].includes(user_permission)) && (
          <StyledJoinButton
            handleSendProjectJoinRequest={handleSendProjectJoinRequest}
            requestedToJoin={requestedToJoinProject}
            hasAdminPermissions={hasAdminPermissions}
          />
        )}

      {/* Only present dialog if button has been clicked! */}
      <ProjectRequestersDialog
        open={showRequesters}
        project={project}
        requesters={requesters}
        url=""
        onRequestersUpdated={handleRequestersUpdated}
        onClose={toggleShowRequests}
        user={user}
        loading={!requestersRetrieved}
        user_permission={user_permission}
      />

      {/* Edit event registration settings modal */}
      {showRegistrationButtons && eventRegistration && (
        <EditEventRegistrationModal
          open={editRegistrationOpen}
          onClose={() => setEditRegistrationOpen(false)}
          onSaved={onEventRegistrationUpdated}
          project={project}
          eventRegistration={eventRegistration}
        />
      )}
    </div>
  );
}

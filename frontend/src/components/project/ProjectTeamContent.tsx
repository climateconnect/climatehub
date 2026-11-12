import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { useRouter } from "next/router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import Cookies from "universal-cookie";

import ROLE_TYPES from "../../../public/data/role_types";
import { appHref } from "../../../public/lib/appLink";
import { HubContext } from "../context/HubContext";
import getTexts from "../../../public/texts/texts";
import { NOTIFICATION_TYPES } from "../communication/notifications/Notification";
import UserContext from "../context/UserContext";
import LoginNudge from "../general/LoginNudge";
import ProfilePreviews from "./../profile/ProfilePreviews";
import { useFeatureToggles } from "../featureToggle";
import { getMembershipRequests } from "../../../public/lib/projectOperations";
import JoinRequestDetailDialog from "./JoinRequestDetailDialog";
import OpenJoinRequestsList, { OpenJoinRequest } from "./OpenJoinRequestsList";

const EditButton = styled(Button)(({ theme }) => ({
  float: "right",
  marginBottom: theme.spacing(1),
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
  const router = useRouter();
  const { isEnabled } = useFeatureToggles();
  const joinRequestsEnabled = isEnabled("PROJECT_JOIN_REQUEST_CONFIRMATION", false);
  const token = new Cookies().get("auth_token");

  const isAdmin =
    !!user &&
    !!project.team &&
    [ROLE_TYPES.all_type, ROLE_TYPES.read_write_type].includes(
      project.team.find((m) => m.id === user.id)?.permission
    );

  const [openRequests, setOpenRequests] = useState<OpenJoinRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | number | null>(null);

  const loadOpenRequests = useCallback(async () => {
    try {
      setOpenRequests(await getMembershipRequests(project.url_slug, locale, token));
    } catch (e) {
      console.log(e);
    }
  }, [project.url_slug, locale, token]);

  useEffect(() => {
    if (joinRequestsEnabled && isAdmin) void loadOpenRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinRequestsEnabled, isAdmin]);

  // Deep link: open the dialog from ?join_request=<id> (client-side only, after mount)
  const queryJoinRequest = router?.query?.join_request;
  useEffect(() => {
    if (!joinRequestsEnabled) return;
    const id = Array.isArray(queryJoinRequest) ? queryJoinRequest[0] : queryJoinRequest;
    setSelectedRequestId(id ?? null);
  }, [joinRequestsEnabled, queryJoinRequest]);

  const setJoinRequestParam = (id: string | number | null) => {
    setSelectedRequestId(id);
    // Rebuild the URL from the current one so the tab hash (#team) is preserved.
    // The tabs set the hash via window.location, which router.asPath doesn't track.
    const hash = window.location.hash.replace("#", "");
    const [path, queryString] = router.asPath.split("#")[0].split("?");
    const params = new URLSearchParams(queryString);
    if (id == null) params.delete("join_request");
    else params.set("join_request", String(id));
    const query = params.toString();
    const url = path + (query ? "?" + query : "") + (hash ? "#" + hash : "");
    void router.replace(url, undefined, { shallow: true, scroll: false });
  };

  const handleDecided = async (action: "approve" | "reject") => {
    await loadOpenRequests();
    // refresh the team (server-side props) after an approval
    if (action === "approve") void router.replace(router.asPath, undefined, { scroll: false });
  };

  const dialog = joinRequestsEnabled ? (
    <JoinRequestDetailDialog
      open={selectedRequestId != null}
      projectUrlSlug={project.url_slug}
      requestId={selectedRequestId}
      onClose={() => setJoinRequestParam(null)}
      onDecided={handleDecided}
    />
  ) : null;
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
    return (
      <>
        <LoginNudge whatToDo={texts.to_see_this_projects_team_members} />
        {dialog}
      </>
    );
  }

  // TODO: admin access, review members
  if (project.team) {
    return (
      <>
        {dialog}
        {joinRequestsEnabled && isAdmin && (
          <OpenJoinRequestsList requests={openRequests} onSelect={setJoinRequestParam} />
        )}
        {user && !!project.team.find((m) => m.id === user.id) && (
          <>
            {[ROLE_TYPES.all_type, ROLE_TYPES.read_write_type].includes(
              project.team.find((m) => m.id === user.id).permission
            ) && (
              <EditButton
                variant="contained"
                href={appHref("/manageProjectMembers/" + project.url_slug, { hubUrl, locale })}
              >
                {texts.manage_members}
              </EditButton>
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

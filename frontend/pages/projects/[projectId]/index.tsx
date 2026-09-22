import NextCookies from "next-cookies";
import React, { useContext, useEffect, useState, useMemo } from "react";
import Cookies from "universal-cookie";
import ROLE_TYPES from "../../../public/data/role_types";
import { apiRequest } from "../../../public/lib/apiOperations";
import { nullifyUndefinedValues } from "../../../public/lib/profileOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../../../src/components/context/UserContext";
import PageNotFound from "../../../src/components/general/PageNotFound";
import WideLayout from "../../../src/components/layouts/WideLayout";
import ProjectPageRoot from "../../../src/components/project/ProjectPageRoot";
import HubsSubHeader from "../../../src/components/indexPage/hubsSubHeader/HubsSubHeader";
import { useMediaQuery } from "@mui/material";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { Theme } from "@mui/material/styles";
import makeStyles from "@mui/styles/makeStyles";
import ProjectSideBar from "../../../src/components/project/ProjectSideBar";
import { transformThemeData } from "../../../src/themes/transformThemeData";
import getHubTheme from "../../../src/themes/fetchHubTheme";
import theme from "../../../src/themes/theme";
import { NOTIFICATION_TYPES } from "../../../src/components/communication/notifications/Notification";
import { HubContext } from "../../../src/components/context/HubContext";
import { parseData } from "../../../public/lib/parsingOperations";
import {
  WASSERAKTIONSWOCHEN_PARENT_SLUG,
  isWasseraktionswochenEnabled,
} from "../../../public/data/wasseraktionswochen_config.js";

type StyleProps = {
  showSimilarProjects: boolean;
};
const useStyles = makeStyles<Theme, StyleProps>((theme) => {
  return {
    contentWrapper: {
      display: "flex",
    },
    mainContent: (props) => ({
      width: props.showSimilarProjects ? "80%" : "100%",
      [theme.breakpoints.down("lg")]: {
        width: "100%",
      },
    }),
    secondaryContent: (props) => ({
      width: props.showSimilarProjects ? "20%" : "0%",
      [theme.breakpoints.down("lg")]: {
        width: "0%",
        marginTop: theme.spacing(0),
        marginRight: theme.spacing(0),
        marginLeft: theme.spacing(0),
      },
      marginTop: theme.spacing(2),
      marginRight: theme.spacing(7),
      marginLeft: theme.spacing(1),
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
    }),
  };
});

const parseComments = (comments) => {
  return comments
    .filter((c) => {
      return !c.parent_comment_id;
    })
    .map((c) => {
      return {
        ...c,
        replies: comments
          .filter((r) => r.parent_comment_id === c.id)
          .sort((a, b) => {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }),
      };
    });
};

export async function getServerSideProps(ctx) {
  const { auth_token } = NextCookies(ctx);
  const projectUrl = encodeURI(ctx?.query?.projectId);
  // Updated to ensure `hubUrl` is only encoded if `ctx.query.hub` is defined and not null.
  // This prevents `encodeURI` from converting `undefined` or `null` into the string "undefined" or "null".
  const hubUrl = ctx?.query?.hub ? encodeURI(ctx.query.hub) : null;
  const [
    project,
    members,
    posts,
    comments,
    userInteractions,
    hubSupporters,
    hubThemeData,
  ] = await Promise.all([
    getProjectByIdIfExists(projectUrl, auth_token, ctx.locale, hubUrl),
    getProjectMembersByIdIfExists(projectUrl, ctx.locale),
    getPostsByProject(projectUrl, auth_token, ctx.locale),
    getCommentsByProject(projectUrl, auth_token, ctx.locale),
    auth_token ? getUsersInteractionWithProject(projectUrl, auth_token, ctx.locale) : false,
    hubUrl ? getHubSupporters(hubUrl, ctx.locale) : null,
    hubUrl ? getHubTheme(hubUrl) : null,
  ]);

  const similarProjects =
    project && !project.is_draft ? await getSimilarProjects(projectUrl, ctx.locale, hubUrl) : null;

  // Fetch sibling events if this is a Wasseraktionswochen event
  let siblingProjects = null;

  if (
    // eventually we can decide to always show sibling projects if they exist
    isWasseraktionswochenEnabled() &&
    project?.parent_project_slug === WASSERAKTIONSWOCHEN_PARENT_SLUG
  ) {
    siblingProjects = await getSiblingProjects(
      project.parent_project_slug,
      project.url_slug,
      ctx.locale
    );
  }

  return {
    props: nullifyUndefinedValues({
      project: project,
      members: members,
      posts: posts,
      comments: comments,
      following: userInteractions.following,
      liking: userInteractions.liking,
      hasRequestedToJoin: userInteractions.has_requested_to_join,
      isRegistered: userInteractions.is_registered ?? false,
      hasAttended: userInteractions.has_attended ?? false,
      adminCancelled: userInteractions.admin_cancelled ?? false,
      similarProjects: similarProjects,
      hubSupporters: hubSupporters,
      hubUrl,
      hubThemeData: hubThemeData,
      siblingProjects: siblingProjects,
      isWasseraktionswochenEnabled: isWasseraktionswochenEnabled(),
    }),
  };
}

export default function ProjectPage({
  project,
  members,
  posts,
  comments,
  following,
  liking,
  hasRequestedToJoin,
  isRegistered,
  hasAttended,
  adminCancelled,
  similarProjects,
  hubSupporters,
  hubUrl,
  hubThemeData,
  siblingProjects,
  isWasseraktionswochenEnabled,
}) {
  const token = new Cookies().get("auth_token");
  const [curComments, setCurComments] = useState(parseComments(comments));
  const [currentMembers, setCurrentMembers] = useState(members);
  const [message, setMessage] = useState({ message: undefined, messageType: undefined });
  const [isUserFollowing, setIsUserFollowing] = useState(following);
  const [isUserLiking, setIsUserLiking] = useState(liking);
  const [requestedToJoinProject, setRequestedToJoinProject] = useState(hasRequestedToJoin);
  const [followingChangePending, setFollowingChangePending] = useState(false);
  const [likingChangePending, setLikingChangePending] = useState(false);
  const [numberOfLikes, setNumberOfLikes] = useState(project?.number_of_likes);
  const [numberOfFollowers, setNumberOfFollowers] = useState(project?.number_of_followers);
  const { CUSTOM_HUB_URLS, locale, user } = useContext(UserContext);
  const { hubs } = useContext(HubContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });
  const [showSimilarProjects, setShowSimilarProjects] = useState(true);
  // Get registered event slugs from user profile for showing "Registered ✓" status
  const registeredEventSlugs = useMemo(() => {
    return new Set(user?.registered_event_slugs || []);
  }, [user?.registered_event_slugs]);

  const classes = useStyles({
    showSimilarProjects: showSimilarProjects,
  });

  const handleHideContent = () => {
    setShowSimilarProjects(!showSimilarProjects);
  };
  const smallScreenSize = useMediaQuery<Theme>((theme) => theme.breakpoints.down("lg"));

  // Handle remove bell icon notification
  const { notifications, setNotificationsRead, refreshNotifications } = useContext(UserContext);
  const handleReadNotifications = async (notificationType) => {
    if (!notifications || notifications.length === 0) return;
    const notification_to_set_read = notifications.filter(
      (n) => n.notification_type === notificationType && n.project.url_slug === project.url_slug
    );
    await setNotificationsRead(token, notification_to_set_read, locale);
    await refreshNotifications();
  };

  useEffect(() => {
    if (notifications && notifications.length !== 0) {
      handleReadNotifications(NOTIFICATION_TYPES.indexOf("org_project_published"));
    }
  }, [notifications?.length]);

  const handleFollow = (userFollows, updateCount, pending) => {
    setIsUserFollowing(userFollows);
    if (updateCount) {
      if (userFollows) {
        setNumberOfFollowers(numberOfFollowers + 1);
      } else {
        setNumberOfFollowers(numberOfFollowers - 1);
      }
    }
    setFollowingChangePending(pending);
  };

  //We only update the count once the frontend received a response from the backend. This is what the updateCount variable is for
  const handleLike = (userLikes, updateCount, pending) => {
    setIsUserLiking(userLikes);
    if (updateCount) {
      if (userLikes) {
        setNumberOfLikes(numberOfLikes + 1);
      } else {
        setNumberOfLikes(numberOfLikes - 1);
      }
    }
    setLikingChangePending(pending);
  };

  const handleJoinRequest = (newValue) => {
    setRequestedToJoinProject(newValue);
  };

  const refreshMembers = async () => {
    const updatedMembers = await getProjectMembersByIdIfExists(project.url_slug, locale);
    if (updatedMembers) {
      setCurrentMembers(updatedMembers);
    }
  };

  const handleWindowClose = (e) => {
    if (
      curComments.filter((c) => c.unconfirmed).length > 0 ||
      followingChangePending ||
      likingChangePending
    ) {
      e.preventDefault();
      return (e.returnValue = texts.changes_might_not_be_saved);
    }
  };

  useEffect(() => {
    window.addEventListener("beforeunload", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
    };
  });

  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);
  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;

  return (
    <WideLayout
      description={project?.short_description}
      message={message?.message}
      messageType={message?.messageType}
      title={project ? project.name : texts.project + " " + texts.not_found}
      showDonationGoal={true}
      subHeader={
        <HubsSubHeader
          hubs={hubs}
          onlyShowDropDown={true}
          isCustomHub={isCustomHub}
          hubSlug={hubUrl}
          project={project}
        />
      }
      customTheme={customTheme}
      isHubPage={!!hubUrl}
      hubUrl={hubUrl}
      headerBackground={
        customTheme ? customTheme.palette.header.background : theme.palette.background.default
      }
      image={project ? getImageUrl(project.image) : undefined}
    >
      {project ? (
        <div className={classes.contentWrapper}>
          <div className={classes.mainContent}>
            <ProjectPageRoot
              project={{
                ...project,
                team: currentMembers,
                timeline_posts: posts,
                comments: curComments,
              }}
              setMessage={setMessage}
              isUserFollowing={isUserFollowing}
              setCurComments={setCurComments}
              followingChangePending={followingChangePending}
              likingChangePending={likingChangePending}
              projectAdmin={members?.find((m) => m.permission === ROLE_TYPES.all_type)}
              isUserLiking={isUserLiking}
              numberOfLikes={numberOfLikes}
              numberOfFollowers={numberOfFollowers}
              handleFollow={handleFollow}
              handleLike={handleLike}
              similarProjects={similarProjects}
              handleHideContent={handleHideContent}
              showSimilarProjects={showSimilarProjects}
              requestedToJoinProject={requestedToJoinProject}
              handleJoinRequest={handleJoinRequest}
              onMembersRefreshed={refreshMembers}
              hubSupporters={hubSupporters}
              hubPage={hubUrl}
              siblingProjects={siblingProjects}
              isWasseraktionswochenEnabled={isWasseraktionswochenEnabled}
              isRegistered={isRegistered}
              hasAttended={hasAttended}
              adminCancelled={adminCancelled}
            />
          </div>
          <div className={classes.secondaryContent}>
            {!smallScreenSize && (
              <ProjectSideBar
                similarProjects={similarProjects}
                siblingProjects={siblingProjects}
                isWasseraktionswochenEnabled={isWasseraktionswochenEnabled}
                handleHideContent={handleHideContent}
                showSimilarProjects={showSimilarProjects}
                locale={locale}
                texts={texts}
                hubSupporters={hubSupporters}
                hubName={hubUrl}
                isSmallScreen={false}
                registeredEventSlugs={registeredEventSlugs}
                hubUrl={hubUrl}
              />
            )}
          </div>
        </div>
      ) : (
        <PageNotFound itemName={texts.project} />
      )}
    </WideLayout>
  );
}

async function getProjectByIdIfExists(projectUrl, token, locale, hubUrl?: string | null) {
  const query = hubUrl ? `?hub=${hubUrl}` : "";

  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/" + query,
      token: token,
      locale: locale,
    });
    if (resp.data.length === 0) return null;
    else {
      return parseProject(resp.data);
    }
  } catch (err) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getUsersInteractionWithProject(projectUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/my_interactions/",
      token: token,
      locale: locale,
    });
    if (resp.data.length === 0) return null;
    else {
      return resp.data;
    }
  } catch (err) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getPostsByProject(projectUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/posts/",
      token: token,
      locale: locale,
    });
    if (resp.data.length === 0) return null;
    else {
      return resp.data.results;
    }
  } catch (err) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getCommentsByProject(projectUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/comments/",
      token: token,
      locale: locale,
    });
    if (resp.data.length === 0) return null;
    else {
      return resp.data.results;
    }
  } catch (err) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getProjectMembersByIdIfExists(projectUrl, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/members/",
      locale: locale,
    });
    if (resp.data.results.length === 0) return null;
    else {
      return parseProjectMembers(resp.data.results);
    }
  } catch (err) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getSimilarProjects(projectUrl, locale, hubUrl?: string | null) {
  const query = hubUrl ? `?hub=${hubUrl}` : "";
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/projects/" + projectUrl + "/similar/" + query,
      locale: locale,
    });
    if (resp.data.results.length === 0) return null;
    else {
      return parseData({ type: "projects", data: resp.data.results });
    }
  } catch (err) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getSiblingProjects(parentProjectSlug, currentProjectSlug, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/projects/?parent_project_slug=${parentProjectSlug}&page_size=100`,
      locale: locale,
    });

    const allSiblings = resp.data.results || [];

    // Filter out current project, sort by date, and limit to 4
    const siblings = allSiblings
      .filter((p) => p.url_slug !== currentProjectSlug)
      .sort((a, b) => {
        const dateA = new Date(a.start_date || a.created_at);
        const dateB = new Date(b.start_date || b.created_at);
        const now = new Date();

        // Upcoming events first, then past events
        const aIsUpcoming = dateA >= now;
        const bIsUpcoming = dateB >= now;

        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;

        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 4);

    return parseData({ type: "projects", data: siblings });
  } catch (err) {
    console.error("Error fetching sibling events:", err);
    return null;
  }
}

const getHubSupporters = async (url_slug, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/hubs/${url_slug}/supporters/`,
      locale: locale,
    });
    return resp.data;
  } catch (err: any) {
    //Don't log an error if there simply are no supporters for this hub
    if (err?.response?.status === 404) {
      return null;
    }
    if (err.response && err.response.data)
      console.log("Error in getHubSupportersData: " + err.response.data.detail);
    console.log(err);
    return null;
  }
};

// TODO duplicated code? manage project members also has this function
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
    is_draft: project.is_draft,
    sectors: project.sectors.sort((a, b) => a.order - b.order).map((s) => s.sector),
    collaborating_organizations: project.collaborating_organizations.map(
      (o) => o.collaborating_organization
    ),
    website: project.website,
    number_of_followers: project.number_of_followers,
    number_of_likes: project.number_of_likes,
    project_type: project.project_type,
    additional_loc_info: project.additional_loc_info,
    parent_project_id: project.parent_project_id,
    parent_project_name: project.parent_project_name,
    parent_project_slug: project.parent_project_slug,
    is_online: project.is_online,
    registration_config: project.registration_config ?? null,
    my_event_registration: project.my_event_registration ?? null,
    devlink_component: project.devlink_component ?? null,
  };
}

function parseProjectMembers(projectMembers) {
  return projectMembers.map((m) => {
    return {
      ...m.user,
      url_slug: m.user.url_slug,
      role: m.role_in_project,
      permission: m.role.role_type,
      availability: m.availability,
      name: m.user.first_name + " " + m.user.last_name,
      location: m.user.location,
    };
  });
}

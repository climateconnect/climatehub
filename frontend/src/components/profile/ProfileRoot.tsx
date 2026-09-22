import { Button, Container, Typography, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { Theme, useTheme } from "@mui/material/styles";
import { useRouter } from "next/router";
import React, { useContext, useEffect, useRef, useState } from "react";
import Cookies from "universal-cookie";
import { apiRequest } from "../../../public/lib/apiOperations";
import { appHref } from "../../../public/lib/appLink";
import { startPrivateChat } from "../../../public/lib/messagingOperations";
import {
  parseDirectProjectStubs,
  parseOrganizationStubs,
  parseProjectStubs,
} from "../../../public/lib/parsingOperations";
import AccountPage from "../account/AccountPage";
import LoginNudge from "../general/LoginNudge";
import OrganizationPreviews from "../organization/OrganizationPreviews";
import ProjectPreviews from "../project/ProjectPreviews";
import ControlPointSharpIcon from "@mui/icons-material/ControlPointSharp";
import IconButton from "@mui/material/IconButton";
import FeedbackContext from "../context/FeedbackContext";

const DEFAULT_BACKGROUND_IMAGE = "/images/default_background_user.jpg";

const useStyles = makeStyles((theme) => {
  return {
    background: {
      width: "100%",
    },
    profilePreview: {
      margin: "0 auto",
      marginTop: theme.spacing(-11),
      [theme.breakpoints.up("sm")]: {
        margin: 0,
        marginTop: theme.spacing(-11),
        display: "inline-block",
        width: "auto",
      },
    },
    memberInfoContainer: {
      [theme.breakpoints.up("sm")]: {
        display: "inline-block",
      },
      padding: 0,
    },
    content: {
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
      color: `${theme.palette.secondary.main}`,
      fontWeight: "bold",
    },
    noPadding: {
      padding: 0,
    },
    infoContainer: {
      [theme.breakpoints.up("sm")]: {
        display: "flex",
      },
    },
    noprofile: {
      textAlign: "center",
      padding: theme.spacing(5),
    },
    marginTop: {
      marginTop: theme.spacing(1),
    },
    loginNudge: {
      textAlign: "center",
      margin: "0 auto",
    },
    container: {
      position: "relative",
    },
    sectionHeadlineWithButtonContainer: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: theme.spacing(3),
    },
    innerIcon: {
      marginRight: theme.spacing(0.5),
      marginLeft: -theme.spacing(1),
    },
    createButton: {
      right: theme.spacing(1),
      position: "absolute",
      [theme.breakpoints.down("sm")]: {
        position: "relative",
        marginTop: theme.spacing(2),
      },
    },
    title: {
      color: theme.palette.background.default_contrastText,
    },
  };
});

export default function ProfileRoot({
  profile,
  projects,
  projectsHasMore,
  organizations,
  organizationsHasMore,
  infoMetadata,
  user,
  token,
  texts,
  locale,
  hubUrl,
}) {
  const { showFeedbackMessage } = useContext(FeedbackContext);
  const classes = useStyles();
  const theme = useTheme();
  const isOwnAccount = user && user.url_slug === profile.url_slug;
  const router = useRouter();
  const [registeredEvents, setRegisteredEvents] = useState<any>(null);

  // Projects pagination state (see spec 20260728_1030_paginate_projects_on_member_profile)
  const [allProjects, setAllProjects] = useState(projects || []);
  const [hasMoreProjects, setHasMoreProjects] = useState(projectsHasMore);
  const [nextProjectsPage, setNextProjectsPage] = useState(2);
  const [isLoadingMoreProjects, setIsLoadingMoreProjects] = useState(false);

  // Organizations pagination state
  const [allOrganizations, setAllOrganizations] = useState(organizations || []);
  const [hasMoreOrganizations, setHasMoreOrganizations] = useState(organizationsHasMore);
  const [nextOrganizationsPage, setNextOrganizationsPage] = useState(2);
  const [isLoadingMoreOrganizations, setIsLoadingMoreOrganizations] = useState(false);

  const handleLoadMoreProjects = async () => {
    if (isLoadingMoreProjects || !hasMoreProjects) return;
    setIsLoadingMoreProjects(true);
    try {
      const resp = await apiRequest({
        method: "get",
        url: `/api/member/${profile.url_slug}/projects/?page=${nextProjectsPage}`,
        token: new Cookies().get("auth_token"),
        locale: locale,
      });
      if (resp.data) {
        const newProjects = parseProjectStubs(resp.data.results);
        setAllProjects((prev) => [...prev, ...newProjects]);
        setHasMoreProjects(!!resp.data.next);
        setNextProjectsPage((prev) => prev + 1);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoadingMoreProjects(false);
    }
  };

  const handleLoadMoreOrganizations = async () => {
    if (isLoadingMoreOrganizations || !hasMoreOrganizations) return;
    setIsLoadingMoreOrganizations(true);
    try {
      const resp = await apiRequest({
        method: "get",
        url: `/api/member/${profile.url_slug}/organizations/?page=${nextOrganizationsPage}`,
        token: new Cookies().get("auth_token"),
        locale: locale,
      });
      if (resp.data) {
        const newOrganizations = parseOrganizationStubs(resp.data.results);
        setAllOrganizations((prev) => [...prev, ...newOrganizations]);
        setHasMoreOrganizations(!!resp.data.next);
        setNextOrganizationsPage((prev) => prev + 1);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoadingMoreOrganizations(false);
    }
  };

  const handleConnectBtn = async (e) => {
    e.preventDefault();
    try {
      const chat = await startPrivateChat(profile, token, locale);
      router.push({
        pathname: "/chat/" + chat.chat_uuid + "/",
      });
    } catch (e) {
      showFeedbackMessage({
        message: <span>{e.response.data.message}</span>,
        error: true,
      });
    }
  };
  const projectsRef = useRef(null);
  const organizationsRef = useRef(null);
  const scrollDownSmooth = (ref) => {
    ref.current.scrollIntoView({ behavior: "smooth" });
  };
  const isTinyScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const isSmallScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));

  useEffect(() => {
    const URL = window.location.href;
    if (URL.slice(-9) == "#projects") {
      scrollDownSmooth(projectsRef);
    }
    if (URL.slice(-14) == "#organizations") {
      scrollDownSmooth(organizationsRef);
    }
  }, []);

  // Fetch registered events only for own account on client-side
  useEffect(() => {
    if (isOwnAccount && token && !registeredEvents) {
      apiRequest({
        method: "get",
        url: "/api/members/me/registered-events/",
        token: token,
        locale: locale,
      })
        .then((resp) => {
          if (resp.data) {
            setRegisteredEvents(parseDirectProjectStubs(resp.data.results));
          }
        })
        .catch((err) => {
          console.log(err);
          if (err.response && err.response.data) {
            console.log("Error: " + err.response.data.detail);
          }
        });
    }
  }, [isOwnAccount, token, locale]);

  return (
    <AccountPage
      account={profile}
      default_background={DEFAULT_BACKGROUND_IMAGE}
      editHref={appHref("/editprofile", { hubUrl, locale })}
      isOwnAccount={isOwnAccount}
      isOrganization={false}
      infoMetadata={infoMetadata}
      isSmallScreen={isSmallScreen}
    >
      {!user && (
        <LoginNudge
          className={classes.loginNudge}
          whatToDo={texts.to_see_this_users_full_information}
        />
      )}
      {user && user.url_slug !== profile.url_slug && (
        <Button variant="contained" color="primary" onClick={handleConnectBtn}>
          {texts.send_message}
        </Button>
      )}
      {isOwnAccount && (
        <Container className={classes.container}>
          <div className={classes.sectionHeadlineWithButtonContainer}>
            <h2 className={classes.title}>{texts.your_registered_events}</h2>
          </div>
          {registeredEvents && registeredEvents.length > 0 ? (
            <ProjectPreviews projects={registeredEvents} hubUrl={hubUrl} isUserRegistered />
          ) : (
            <Typography>{texts.no_registered_events_yet}</Typography>
          )}
        </Container>
      )}
      <Container className={classes.container} ref={projectsRef}>
        <div className={classes.sectionHeadlineWithButtonContainer}>
          <h2 className={classes.title}>
            {isOwnAccount ? texts.your_projects : texts.this_users_projects}
          </h2>
          {isTinyScreen ? (
            <IconButton href={appHref("/share", { hubUrl, locale })} size="large">
              <ControlPointSharpIcon
                className={classes.button}
                variant="contained"
                color="primary"
              />
            </IconButton>
          ) : (
            <Button
              variant="contained"
              color="primary"
              href={appHref("/share", { hubUrl, locale })}
            >
              <ControlPointSharpIcon className={classes.innerIcon} />
              {texts.share_a_project}
            </Button>
          )}
        </div>
        {allProjects && allProjects.length ? (
          <>
            <ProjectPreviews projects={allProjects} hubUrl={hubUrl} parentHandlesGridItems />
            {hasMoreProjects && (
              <Button
                variant="outlined"
                color="primary"
                onClick={handleLoadMoreProjects}
                disabled={isLoadingMoreProjects}
                fullWidth
                sx={{ mt: 2 }}
              >
                {isLoadingMoreProjects ? texts.loading : texts.load_more}
              </Button>
            )}
          </>
        ) : (
          <Typography>
            {(isOwnAccount ? texts.you_are : texts.user_name_is) +
              " " +
              texts.not_involved_in_any_projects_yet}
          </Typography>
        )}
      </Container>
      <Container className={classes.container} ref={organizationsRef}>
        <div className={classes.sectionHeadlineWithButtonContainer}>
          <h2 className={classes.title}>
            {isOwnAccount ? texts.your_organizations : texts.this_users_organizations}
          </h2>
          {isTinyScreen ? (
            <IconButton href={appHref("/createorganization", { hubUrl, locale })} size="large">
              <ControlPointSharpIcon
                className={classes.button}
                variant="contained"
                color="primary"
              />
            </IconButton>
          ) : (
            <Button
              variant="contained"
              color="primary"
              href={appHref("/createorganization", { hubUrl, locale })}
            >
              <ControlPointSharpIcon className={classes.innerIcon} />
              {texts.create_an_organization}
            </Button>
          )}
        </div>
        {allOrganizations && allOrganizations.length > 0 ? (
          <>
            <OrganizationPreviews organizations={allOrganizations} parentHandlesGridItems />
            {hasMoreOrganizations && (
              <Button
                variant="outlined"
                color="primary"
                onClick={handleLoadMoreOrganizations}
                disabled={isLoadingMoreOrganizations}
                fullWidth
                sx={{ mt: 2 }}
              >
                {isLoadingMoreOrganizations ? texts.loading : texts.load_more}
              </Button>
            )}
          </>
        ) : (
          <Typography>
            {(isOwnAccount ? texts.you_are : texts.user_name_is) +
              " " +
              texts.not_involved_in_any_organizations_yet}
          </Typography>
        )}
      </Container>
    </AccountPage>
  );
}

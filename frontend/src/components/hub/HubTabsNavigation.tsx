import { Theme } from "@emotion/react";
import { Container, Link, Tab, Tabs, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext, useMemo, useState } from "react";
import { useRouter } from "next/router";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import { useFeatureToggles } from "../featureToggle";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import HubsDropDown from "../indexPage/hubsSubHeader/HubsDropDown";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import { getCustomHubData } from "../../../public/data/customHubData";
import HubLinks from "../indexPage/hubsSubHeader/HubLinks";

const useStyles = makeStyles((theme) => ({
  root: {
    background: theme.palette.primary.main,
  },
  tabs: {
    "& .MuiTabs-indicator": {
      background: "transparent",
    },
  },
  tab: {
    textTransform: "none",
    color: theme.palette.primary.contrastText,
    fontSize: 16,
    "&.Mui-selected": {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      "& .tabLabel": {
        color: theme.palette.primary.main,
        background: theme.palette.primary.contrastText,
        borderRadius: 15,
        paddingTop: 3,
        paddingBottom: 3,
        padding: theme.spacing(1.5),
        display: "flex",
        alignItems: "center",
      },
    },
    "&:hover": {
      textDecoration: "underline",
    },
  },
  path: {
    color: theme.palette.primary.contrastText,
    fontWeight: 600,
  },
  link: {
    color: theme.palette.primary.contrastText,
    display: "inline-block",
    fontWeight: 600,
    marginRight: theme.spacing(2),
    marginLeft: theme.spacing(2),
  },
  activeEventLink: {
    color: theme.palette.primary.main,
    background: theme.palette.primary.contrastText,
    borderRadius: 15,
    padding: "3px 12px",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    marginRight: theme.spacing(2),
    marginLeft: theme.spacing(2),
    "&:hover": {
      textDecoration: "none",
    },
  },
  flexContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rightSideContainer: {
    display: "flex",
    alignItems: "center",
  },
  allProjectsLink: {
    marginRight: theme.spacing(1.5),
  },
  climateMatchLink: {
    color: theme.palette.primary.contrastText,
    fontWeight: 600,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(4),
  },
  wasseraktionsButton: {
    backgroundColor: "#D5F1FF",
    color: theme.palette.primary.main,
    borderRadius: theme.spacing(3),
    padding: theme.spacing(0.75, 2),
    fontWeight: 600,
    marginLeft: theme.spacing(1.5),
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    columnGap: theme.spacing(1),
    "&:hover": {
      backgroundColor: "#C0E6FF",
      textDecoration: "none",
    },
  },
  wasseraktionsIcon: {
    width: 20,
    height: 20,
    flexShrink: 0,
  },
  linksAndTabsWrapper: {
    display: "flex",
    alignItems: "center",
    [theme.breakpoints.down("md")]: {
      justifyContent: "space-between",
    },
  },
  container: {
    display: "flex",
    justifyContent: "space-between",
  },
}));

export default function HubTabsNavigation({
  TYPES_BY_TAB_VALUE,
  tabValue,
  handleTabChange,
  type_names,
  hubUrl,
  className,
  allHubs,
  fromPage,
}) {
  const { locale, CUSTOM_HUB_URLS } = useContext(UserContext);
  const classes = useStyles();
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const { isEnabled } = useFeatureToggles();
  const isEventsEnabled = isEnabled("EVENT_CALENDAR_FEATURE");
  const isEventsPage = router.pathname.includes("events");

  // Computed values
  const texts = getTexts({ page: "navigation", locale: locale });
  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);
  const isEmmendingenHub = hubUrl === "em";
  const isHubPage = fromPage === "hub";

  const locationHubs = useMemo(
    () => (allHubs || []).filter((h) => isLocationHubLikeHub(h.hub_type)),
    [allHubs]
  );

  const hubTabLink = useMemo(() => getCustomHubData({ hubUrl, texts })?.hubTabLinkNarrowScreen, [
    hubUrl,
    texts,
  ]);

  // Dropdown handlers
  const handleOpen = () => setDropdownOpen(true);
  const handleClose = () => setDropdownOpen(false);
  const handleToggleOpen = () => setDropdownOpen(!dropdownOpen);

  // Render helpers
  const renderTabs = () => {
    if (isNarrowScreen) return null;

    return (
      <Tabs
        variant="standard"
        value={tabValue}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        className={classes.tabs}
      >
        {TYPES_BY_TAB_VALUE.map((type, index) => (
          <Tab
            key={index}
            disableRipple
            classes={{
              root: classes.tab,
            }}
            label={<div className="tabLabel">{type_names[type]}</div>}
          />
        ))}
      </Tabs>
    );
  };

  const renderNarrowScreenLinks = () => {
    if (!isNarrowScreen) return null;

    return (
      <>
        {hubTabLink && (
          <Link
            className={classes.climateMatchLink}
            href={hubTabLink.href}
            target="_blank"
            underline="hover"
          >
            {hubTabLink.text}
          </Link>
        )}
      </>
    );
  };

  const renderRightSection = () => {
    // Show dropdown on hub page for non-custom hubs
    if (!isCustomHub && isHubPage) {
      return (
        <HubsDropDown
          hubs={locationHubs}
          label={texts.all_hubs}
          isNarrowScreen={isNarrowScreen}
          onToggleOpen={handleToggleOpen}
          open={dropdownOpen}
          onOpen={handleOpen}
          onClose={handleClose}
          addLocationHubExplainerLink
          height={48}
        />
      );
    }

    // Show hub links on browse page for non-custom hubs
    if (allHubs && !isCustomHub) {
      return (
        <HubLinks
          linkClassName={classes.link}
          hubs={allHubs}
          locale={locale}
          isNarrowScreen={isNarrowScreen}
        />
      );
    }

    return null;
  };

  return (
    <div className={`${className} ${classes.root}`}>
      {isNarrowScreen ? (
        isEmmendingenHub || hubTabLink ? (
          <Container maxWidth="lg" className={classes.container}>
            <div className={classes.linksAndTabsWrapper}>
              {isEmmendingenHub && (
                <Link
                  className={classes.climateMatchLink}
                  href="https://climatehub.earth/burgerenergie-em"
                  underline="hover"
                >
                  {texts.emmerdingen_buergerenergie}
                </Link>
              )}
              {renderNarrowScreenLinks()}
            </div>
          </Container>
        ) : null
      ) : (
        <Container maxWidth="lg" className={classes.container}>
          <div className={classes.linksAndTabsWrapper}>
            {renderTabs()}
            {isEventsEnabled && !isNarrowScreen && (
              <Link
                className={isEventsPage ? classes.activeEventLink : classes.link}
                href={`${getLocalePrefix(locale)}${hubUrl ? `/hubs/${hubUrl}/events` : "/events"}`}
                underline={isEventsPage ? "none" : "hover"}
              >
                {texts.event_calendar ?? "Event calendar"}
              </Link>
            )}
            {isEmmendingenHub && (
              <Link
                className={classes.climateMatchLink}
                href="https://climatehub.earth/burgerenergie-em"
                underline="hover"
              >
                {texts.emmerdingen_buergerenergie}
              </Link>
            )}
            {renderNarrowScreenLinks()}
          </div>
          {renderRightSection()}
        </Container>
      )}
    </div>
  );
}

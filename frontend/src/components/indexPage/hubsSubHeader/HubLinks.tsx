import { Link, Theme, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useState } from "react";
import { useRouter } from "next/router";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import getTexts from "../../../../public/texts/texts";
import theme from "../../../themes/theme";
import HubsDropDown from "./HubsDropDown";
import isLocationHubLikeHub from "../../../../public/lib/isLocationHubLikeHub";
import { useIsEventsPage, usePageNavEntries } from "../../../hooks/usePageNavEntries";
import { BrowseEntity } from "../../../types";

const useStyles = makeStyles(() => ({
  spaceAround: {
    display: "flex",
    justifyContent: "flex-end",
    width: "100%",
  },
  wrapper: {
    display: "flex",
    alignItems: "center",
  },
}));

/**
 * Maps a pathname to the active `BrowseEntity` (or null) by reading the
 * pathname from the router.
 */
function useActiveEntryFromPathname(): BrowseEntity | null {
  const router = useRouter();
  const segments = router.pathname.split("/").filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg === "browse") return "projects";
    if (seg === "organizations" || seg === "members") return seg as BrowseEntity;
  }
  return null;
}

export default function HubLinks({
  hubs,
  locale,
  linkClassName,
  isNarrowScreen,
  showAllProjectsButton,
  onlyShowDropDown,
}: any) {
  const classes = useStyles();
  const [open, setOpen] = useState({ climateHubs: false });
  const texts = getTexts({ page: "navigation", locale: locale });
  const locationHubs = hubs?.filter((h) => isLocationHubLikeHub(h.hub_type));
  const isMediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const isEventsPage = useIsEventsPage();
  const { getHref } = usePageNavEntries({});
  const activeEntry = useActiveEntryFromPathname();

  const handleOpen = (e, type) => {
    e.preventDefault();
    const newOpen = {
      ...open,
      [type]: true,
    };
    for (const key of Object.keys(open)) {
      if (key !== type) {
        newOpen[key] = false;
      }
    }
    setOpen(newOpen);
  };

  const handleClose = (type) => {
    setOpen({ ...open, [type]: false });
  };

  const handleToggleOpen = (e, type) => {
    e.preventDefault();
    const newOpen = {
      ...open,
      [type]: !open[type],
    };
    if (!open[type]) {
      for (const key of Object.keys(open)) {
        if (key !== type) {
          newOpen[key] = false;
        }
      }
    }
    setOpen(newOpen);
  };

  // The "all projects" link mirrors what the dropdown would render when
  // switching to a hub: the current entity-browser entry's global URL, or
  // `/events` on the events page, or `/browse` otherwise.
  const allProjectsPath = (() => {
    if (isEventsPage) return "/events";
    if (activeEntry) return getHref(activeEntry);
    return "/browse";
  })();

  return (
    <div className={`${isNarrowScreen && classes.spaceAround} ${classes.wrapper}`}>
      {!isMediumScreen && !onlyShowDropDown && showAllProjectsButton && (
        <Link
          className={linkClassName}
          href={getLocalePrefix(locale) + allProjectsPath}
          underline="hover"
        >
          {texts.all_projects}
        </Link>
      )}
      {locationHubs?.length > 0 && (
        <HubsDropDown
          activeEntry={activeEntry}
          hubs={locationHubs}
          label="ClimateHubs"
          isNarrowScreen={isNarrowScreen}
          onToggleOpen={(e) => handleToggleOpen(e, "climateHubs")}
          open={open["climateHubs"]}
          onOpen={(e) => handleOpen(e, "climateHubs")}
          onClose={() => handleClose("climateHubs")}
          addLocationHubExplainerLink
        />
      )}
    </div>
  );
}

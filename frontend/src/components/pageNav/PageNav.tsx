import { Theme } from "@emotion/react";
import { Container, Link, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useMemo, useState } from "react";
import { useRouter } from "next/router";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import { useFeatureToggles } from "../featureToggle";
import AppLink from "../general/AppLink";
import HubsDropDown from "../indexPage/hubsSubHeader/HubsDropDown";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import { getCustomHubData } from "../../../public/data/customHubData";
import HubLinks from "../indexPage/hubsSubHeader/HubLinks";
import { usePageNavEntries } from "../../hooks/usePageNavEntries";
import { BrowseEntity } from "../../types";

const Root = styled("div")(({ theme }) => ({
  background: theme.palette.primary.main,
}));

const NavLink = styled(AppLink)(({ theme }) => ({
  color: theme.palette.primary.contrastText,
  display: "inline-block",
  fontWeight: 600,
  marginRight: theme.spacing(2),
  marginLeft: theme.spacing(2),
}));

const ActiveNavLink = styled(AppLink)(({ theme }) => ({
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
}));

const HighlightedLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.contrastText,
  fontWeight: 600,
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(4),
}));

const LinksAndTabsWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  // Match the MUI <Tabs> default height that the old nav used; without this
  // the row collapses to the height of its tallest entry on pages that
  // don't render a hub dropdown or hub links on the right (e.g. the events
  // page, custom hubs like prio1, or sub-hub pages that have no linked
  // hubs).
  minHeight: 48,
  [theme.breakpoints.down("md")]: {
    justifyContent: "space-between",
  },
}));

const NavContainer = styled(Container)({
  display: "flex",
  justifyContent: "space-between",
});

/**
 * The main page nav shown at the top of the browse pages and the events
 * calendar. Renders the three entity-browser links and the events-calendar
 * link, plus a hub dropdown / hub links on hub pages.
 *
 * The page that renders the nav is the source of truth for which entry is
 * currently active — pass `activeEntry` to highlight the matching link. Pass
 * `null` when the user is on a page that doesn't have an entry in this nav
 * (e.g. the hub landing page).
 */
export default function PageNav({
  activeEntry = null,
  type_names,
  hubUrl = "",
  className,
  allHubs,
  fromPage,
  subHubSegment,
}: {
  activeEntry?: BrowseEntity | null;
  type_names: Record<string, string>;
  hubUrl?: string;
  className?: string;
  allHubs?: any[];
  fromPage?: string;
  subHubSegment?: string;
}) {
  const { locale, CUSTOM_HUB_URLS } = useContext(UserContext);
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const { isEnabled } = useFeatureToggles();
  const isEventsEnabled = isEnabled("EVENT_CALENDAR_FEATURE");
  const { browseEntries, getHref, isActive } = usePageNavEntries({
    hubUrl,
    subHubSegment,
  });

  // Computed values
  const texts = getTexts({ page: "navigation", locale: locale });
  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);
  const isEmmendingenHub = hubUrl === "em";
  const isHubPage = fromPage === "hub";

  const locationHubs = useMemo(
    () => (allHubs || []).filter((h) => isLocationHubLikeHub(h.hub_type)),
    [allHubs]
  );

  // Only look up custom-hub data for known custom hubs. The keys of
  // `CustomHubConfig` are restricted to the custom-hub slugs, so calling
  // `getCustomHubData` with any other `hubUrl` would be a type error.
  const hubTabLink = useMemo(
    () =>
      hubUrl && (hubUrl === "prio1" || hubUrl === "perth")
        ? getCustomHubData({ hubUrl: hubUrl as "prio1" | "perth", texts })?.hubTabLinkNarrowScreen
        : undefined,
    [hubUrl, texts]
  );

  // Dropdown handlers
  const handleOpen = () => setDropdownOpen(true);
  const handleClose = () => setDropdownOpen(false);
  const handleToggleOpen = () => setDropdownOpen(!dropdownOpen);

  const EventsLink = isActive("events", activeEntry) ? ActiveNavLink : NavLink;

  const renderBrowseLinks = () => {
    if (isNarrowScreen) return null;

    return (
      <>
        {browseEntries.map((entry) => {
          const path = getHref(entry);
          const active = isActive(entry, activeEntry);
          const BrowseLink = active ? ActiveNavLink : NavLink;
          return (
            <BrowseLink
              key={entry}
              href={path}
              underline={active ? "none" : "hover"}
              onClick={(e: React.MouseEvent) => {
                // Preserve the current filter query string when switching
                // between entries via SPA navigation. For modifier-clicks
                // (cmd/ctrl/shift/middle) we let the browser open the link
                // in a new tab with the bare href.
                if (active) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                const params = new URLSearchParams(window.location.search);
                router.push(`${path}${params.toString() ? `?${params}` : ""}`);
              }}
            >
              {type_names[entry]}
            </BrowseLink>
          );
        })}
      </>
    );
  };

  const renderNarrowScreenLinks = () => {
    if (!isNarrowScreen) return null;

    return (
      <>
        {hubTabLink && (
          <HighlightedLink href={hubTabLink.href} target="_blank" underline="hover">
            {hubTabLink.text}
          </HighlightedLink>
        )}
      </>
    );
  };

  const renderRightSection = () => {
    // Show dropdown on hub page for non-custom hubs
    if (!isCustomHub && isHubPage) {
      return (
        <HubsDropDown
          activeEntry={activeEntry}
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
      return <HubLinks hubs={allHubs} locale={locale} isNarrowScreen={isNarrowScreen} />;
    }

    return null;
  };

  return (
    <Root className={className}>
      <NavContainer maxWidth="lg">
        <LinksAndTabsWrapper>
          {renderBrowseLinks()}
          {isEventsEnabled && !isNarrowScreen && (
            <EventsLink
              href={getHref("events")}
              underline={isActive("events", activeEntry) ? "none" : "hover"}
            >
              {texts.event_calendar ?? "Event calendar"}
            </EventsLink>
          )}
          {isEmmendingenHub && !isNarrowScreen && (
            <HighlightedLink href="https://climatehub.earth/burgerenergie-em" underline="hover">
              {texts.emmerdingen_buergerenergie}
            </HighlightedLink>
          )}
          {renderNarrowScreenLinks()}
        </LinksAndTabsWrapper>
        {renderRightSection()}
      </NavContainer>
    </Root>
  );
}

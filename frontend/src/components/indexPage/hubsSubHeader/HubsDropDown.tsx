import { Button, ButtonProps } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import React, { useContext, useRef } from "react";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import DropDownList from "../../header/DropDownList";
import { useIsEventsPage } from "../../../hooks/usePageNavEntries";
import { getHubBrowsePathForType } from "../../../../public/lib/urlOperations";
import { BrowseEntity } from "../../../types";

type MakeStylesProps = {
  height: number;
};

const useStyles = makeStyles((theme) => ({
  hubsDropDownButton: (props: MakeStylesProps) => ({
    textTransform: "none",
    color: theme.palette.primary.contrastText,
    fontSize: 16,
    height: props.height ? props.height : 54,
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  }),
}));

/**
 * Generic dropdown that lists the available hubs. Each entry is rewritten to
 * land on the same *page type* (entity-browser entry or events calendar) as
 * the page the user is currently on, so a click on a hub preserves the
 * active browse view.
 *
 * - `activeEntry` is the entity-browser entry currently active on the page
 *   (one of "projects" / "organizations" / "members"), or `null` for pages
 *   that don't have one (e.g. the hub landing page).
 * - The events-page check is derived from the URL via `useIsEventsPage`.
 *
 * When neither an `activeEntry` nor an events page applies (i.e. on the hub
 * landing page), the dropdown offers a hub's landing page to logged-out
 * users (if the hub has one) and its browse/projects page otherwise. The
 * "all locations" trailing link follows the same rule.
 */
export default function HubsDropDown({
  activeEntry,
  open,
  hubs,
  label,
  isNarrowScreen,
  onToggleOpen,
  onOpen,
  onClose,
  addLocationHubExplainerLink,
  height,
}: {
  activeEntry?: BrowseEntity | null;
  open: boolean;
  hubs: { name: string; url_slug: string; landing_page_component?: string | null }[];
  label: string;
  isNarrowScreen: boolean;
  onToggleOpen: (_e: React.MouseEvent) => void;
  onOpen: (_e: React.MouseEvent) => void;
  onClose: (_e?: React.MouseEvent) => void;
  addLocationHubExplainerLink?: boolean;
  height?: number;
}) {
  const classes = useStyles({ height: height ?? 54 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popperRef = useRef<HTMLAnchorElement | null>(null);
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  const isEventsPage = useIsEventsPage();

  const toggleButtonProps: ButtonProps = {};
  if (!isNarrowScreen) {
    toggleButtonProps.onMouseEnter = onOpen;
    toggleButtonProps.onMouseLeave = onClose;
  }

  const handleBlur = (e: React.FocusEvent) => {
    if (isNarrowScreen && !popperRef?.current?.contains(e.relatedTarget as Node | null)) {
      onClose();
    }
  };

  const hubHref = (urlSlug: string): string => {
    if (isEventsPage) {
      return `/hubs/${urlSlug}/events`;
    }
    // Logged-out users on hubs that have a curated landing page should be
    // routed there. This takes priority over the active-entry preservation:
    // a logged-out user on `/browse` who clicks a hub link should see the
    // hub's landing page (curated content), not the project list.
    if (!user && hubs.find((h) => h.url_slug === urlSlug)?.landing_page_component) {
      return `/hubs/${urlSlug}`;
    }
    if (activeEntry) {
      return getHubBrowsePathForType(activeEntry, urlSlug);
    }
    return `/hubs/${urlSlug}/browse`;
  };

  const dropDownHubItems = hubs.map((h) => ({
    href: hubHref(h.url_slug),
    text: h.name,
  }));

  const allLocationsHref = isEventsPage
    ? "/events"
    : activeEntry
    ? `/${activeEntry === "projects" ? "browse" : activeEntry}`
    : "/browse";

  const dropDownItems = addLocationHubExplainerLink
    ? [
        ...dropDownHubItems,
        {
          href: allLocationsHref,
          text: texts.all_locations,
        },
      ]
    : [...dropDownHubItems];

  return (
    <span onBlur={handleBlur} id={`dropdown-${label.toLowerCase()}`}>
      <Button
        {...toggleButtonProps}
        onClick={onToggleOpen}
        aria-haspopup="true"
        ref={buttonRef}
        className={classes.hubsDropDownButton}
      >
        {label}
        <ArrowDropDownIcon />
      </Button>
      <DropDownList
        buttonRef={buttonRef}
        handleOpen={onOpen}
        items={dropDownItems}
        handleClose={onClose}
        open={open}
        popperRef={popperRef}
      />
    </span>
  );
}

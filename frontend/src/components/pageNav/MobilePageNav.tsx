import React, { useContext, useMemo } from "react";
import { Box } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import ContactAmbassadorButton from "../hub/ContactAmbassadorButton";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Groups2Icon from "@mui/icons-material/Groups2";
import DateRangeRoundedIcon from "@mui/icons-material/DateRangeRounded";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import AppLink from "../general/AppLink";
import { usePageNavEntries } from "../../hooks/usePageNavEntries";
import { BrowseEntity } from "../../types";

const useStyles = makeStyles((theme) => ({
  nav: {
    display: "flex",
    backgroundColor: "transparent",
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
  },
  entry: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 4px 8px",
    gap: 2,
    textDecoration: "none !important",
    color: theme.palette.text.secondary,
    "& .MuiSvgIcon-root": {
      color: theme.palette.text.secondary,
      fontSize: "1.4rem",
    },
    "& .entryLabel": {
      fontSize: "0.6rem",
      lineHeight: 1.2,
      marginTop: 1,
      whiteSpace: "nowrap",
    },
  },
  entryActive: {
    backgroundColor: theme.palette.background.default_contrastText || theme.palette.primary.main,
    borderRadius: 16,
    margin: "4px 6px",
    paddingTop: 6,
    paddingBottom: 8,
    color: theme.palette.getContrastText(
      theme.palette.background.default_contrastText || theme.palette.primary.main
    ),
    "& .MuiSvgIcon-root": {
      color: theme.palette.getContrastText(
        theme.palette.background.default_contrastText || theme.palette.primary.main
      ),
    },
    "&:hover": {
      textDecoration: "none !important",
    },
  },
}));

const type_icons: Record<string, React.ElementType> = {
  projects: AssignmentIcon,
  organizations: Groups2Icon,
  events: DateRangeRoundedIcon,
  members: AccountCircleIcon,
};

const TYPE_TEXT_KEYS: Record<string, string> = {
  projects: "projects",
  organizations: "organizations",
  members: "members",
  events: "event_calendar",
};

/**
 * The mobile counterpart to `PageNav`. Fixed to the bottom of the viewport
 * with one entry per page in the main nav (browse projects / organisations /
 * members / events calendar). Each entry is a real `<a>` so cmd-click,
 * middle-click and "open in new tab" all work the way users expect.
 *
 * The page that renders the nav is the source of truth for which entry is
 * currently active — pass `activeEntry` to highlight the matching link. Pass
 * `null` when the user is on a page that doesn't have an entry in this nav
 * (e.g. the hub landing page).
 */
export default function MobilePageNav({
  activeEntry = null,
  hubUrl = "",
  subHubSegment,
  hubAmbassador,
}: {
  activeEntry?: BrowseEntity | null;
  hubUrl?: string;
  subHubSegment?: string;
  hubAmbassador?: any;
}) {
  const { locale } = useContext(UserContext);
  const classes = useStyles();
  const texts = useMemo(() => getTexts({ page: "hub", locale: locale }), [locale]);
  const { browseEntries, getHref, isActive } = usePageNavEntries({
    hubUrl,
    subHubSegment,
  });

  const entries = [...browseEntries, "events" as const];

  return (
    <Box
      sx={(theme) => ({
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        backgroundColor: theme.palette.background.paper,
        borderTop: `1px solid ${theme.palette.divider}`,
      })}
    >
      <ContactAmbassadorButton mobile hubAmbassador={hubAmbassador} />
      <nav className={classes.nav}>
        {entries.map((entry) => {
          const Icon = type_icons[entry];
          const label = texts[TYPE_TEXT_KEYS[entry]] || entry;
          const active = isActive(entry, activeEntry);
          return (
            <AppLink
              key={entry}
              href={getHref(entry)}
              className={`${classes.entry} ${active ? classes.entryActive : ""}`}
              underline="none"
              aria-current={active ? "page" : undefined}
            >
              {Icon ? <Icon /> : null}
              <span className="entryLabel">{label}</span>
            </AppLink>
          );
        })}
      </nav>
    </Box>
  );
}

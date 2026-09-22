import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DateRangeRoundedIcon from "@mui/icons-material/DateRangeRounded";
import { Button, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ProjectPreviews from "../project/ProjectPreviews";

const useStyles = makeStyles((theme) => ({
  // Option 1 highlight: a light tint behind just this event section.
  // Horizontal padding is 0 so the event grid's left/right edges line
  // up exactly with the normal grid below (both share the same lg
  // container); only vertical padding gives the tint breathing room.
  // Option-1 highlight: a light tint behind just this event section.
  // The band bleeds a bit past the grid edges (lg+ where there is
  // gutter room) so it reads as deliberately wider than the cards,
  // while the inner content is re-inset by the same amount so the
  // title/CTA/cards still line up with the grid borders below.
  group: {
    backgroundColor: theme.palette.primary.extraLight,
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(3),
    marginLeft: `calc(-1 * ${theme.spacing(3)})`,
    marginRight: `calc(-1 * ${theme.spacing(3)})`,
    [theme.breakpoints.down("lg")]: {
      marginLeft: 0,
      marginRight: 0,
    },
  },
  inner: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
    [theme.breakpoints.down("lg")]: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  },
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    flexWrap: "wrap",
  },
  title: {
    fontWeight: 700,
    fontSize: 20,
    color: theme.palette.secondary.main,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    // Align the title with the project cards, which are inset 8px by the
    // grid item padding in ProjectPreviews (see classes.items -> padding: 8px).
    paddingLeft: theme.spacing(1),
  },
  titleIcon: {
    fontSize: 24,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    // Mirror the title's 8px inset so the button's right edge lines up
    // with the project cards (which are inset 8px by the grid item padding).
    paddingRight: theme.spacing(1),
  },
  calendarButton: {
    whiteSpace: "nowrap",
    textTransform: "none",
    alignSelf: "center",
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
    "& .MuiButton-startIcon": {
      marginRight: theme.spacing(0.5),
    },
    "& .MuiButton-endIcon": {
      marginLeft: theme.spacing(0.5),
    },
  },
  calendarButtonLabel: {
    [theme.breakpoints.down(450)]: {
      display: "none",
    },
  },
}));

export default function UpcomingEventsGroup({
  events,
  hubUrl,
  subHubSegment,
}: {
  events: any[];
  hubUrl?: string;
  subHubSegment?: string;
}) {
  const { locale } = useContext(UserContext);
  const classes = useStyles();
  const texts = getTexts({ page: "hub", locale: locale });

  const calendarHref = `${getLocalePrefix(locale)}${
    hubUrl ? `/hubs/${hubUrl}${subHubSegment ? `/${subHubSegment}` : ""}/events` : "/events"
  }`;

  return (
    <section className={classes.group} aria-label={texts.upcoming_events}>
      <div className={classes.inner}>
        <div className={classes.headerRow}>
          <Typography component="h2" className={classes.title}>
            <AccessTimeIcon className={classes.titleIcon} />
            {texts.upcoming_events}
          </Typography>
          <div className={classes.headerActions}>
            <Button
              className={classes.calendarButton}
              href={calendarHref}
              startIcon={<DateRangeRoundedIcon />}
              endIcon={<ArrowForwardIcon />}
              variant="contained"
              color="primary"
              size="small"
            >
              <span className={classes.calendarButtonLabel}>{texts.event_calendar}</span>
            </Button>
          </div>
        </div>
        <ProjectPreviews
          parentHandlesGridItems
          projects={events}
          hubUrl={hubUrl}
          analyticsSurface="browse_upcoming_events"
        />
      </div>
    </section>
  );
}

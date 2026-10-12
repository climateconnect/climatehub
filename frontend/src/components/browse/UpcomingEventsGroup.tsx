import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DateRangeRoundedIcon from "@mui/icons-material/DateRangeRounded";
import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ProjectPreviews from "../project/ProjectPreviews";

// Option-1 highlight: a light tint behind just this event section.
// The band bleeds a bit past the grid edges (lg+ where there is
// gutter room) so it reads as deliberately wider than the cards,
// while the inner content is re-inset by the same amount so the
// title/CTA/cards still line up with the grid borders below.
// Horizontal padding is 0 so the event grid's left/right edges line
// up exactly with the normal grid below (both share the same lg
// container); only vertical padding gives the tint breathing room.
const Group = styled("section")(({ theme }) => ({
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
}));

const Inner = styled("div")(({ theme }) => ({
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  [theme.breakpoints.down("lg")]: {
    paddingLeft: 0,
    paddingRight: 0,
  },
}));

const HeaderRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(1.5),
  flexWrap: "wrap",
}));

const Title = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: 20,
  color: theme.palette.secondary.main,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  // Align the title with the project cards, which are inset 8px by the
  // grid item padding in ProjectPreviews.
  paddingLeft: theme.spacing(1),
})) as typeof Typography;

const HeaderActions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
  // Mirror the title's 8px inset so the button's right edge lines up
  // with the project cards (which are inset 8px by the grid item padding).
  paddingRight: theme.spacing(1),
}));

const CalendarButton = styled(Button)(({ theme }) => ({
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
}));

const CalendarButtonLabel = styled("span")(({ theme }) => ({
  [theme.breakpoints.down(450)]: {
    display: "none",
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
  const texts = getTexts({ page: "hub", locale: locale });

  const calendarHref = `${getLocalePrefix(locale)}${
    hubUrl ? `/hubs/${hubUrl}${subHubSegment ? `/${subHubSegment}` : ""}/events` : "/events"
  }`;

  return (
    <Group aria-label={texts.upcoming_events}>
      <Inner>
        <HeaderRow>
          <Title component="h2">
            <AccessTimeIcon sx={{ fontSize: 24 }} />
            {texts.upcoming_events}
          </Title>
          <HeaderActions>
            <CalendarButton
              href={calendarHref}
              startIcon={<DateRangeRoundedIcon />}
              endIcon={<ArrowForwardIcon />}
              variant="contained"
              color="primary"
              size="small"
            >
              <CalendarButtonLabel>{texts.event_calendar}</CalendarButtonLabel>
            </CalendarButton>
          </HeaderActions>
        </HeaderRow>
        <ProjectPreviews
          parentHandlesGridItems
          projects={events}
          hubUrl={hubUrl}
          analyticsSurface="browse_upcoming_events"
        />
      </Inner>
    </Group>
  );
}

import { Badge, Box, CircularProgress, Typography, useTheme } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import Cookies from "universal-cookie";
import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";
import { getDisplaySortTimestamp, toTimestamp } from "../../utils/eventSorting";
import EventCardWide from "./EventCardWide";
import NoItemsFound from "../browse/NoItemsFound";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { Dayjs } from "dayjs";

const useStyles = makeStyles((theme) => ({
  dayHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingBottom: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  },
  dayTile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1.5),
    minWidth: 64,
  },
  dayTileMonth: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    lineHeight: 1.2,
  },
  dayTileDay: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  dayWeekday: {
    fontSize: 18,
    fontWeight: 600,
  },
  dayGroup: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  emptyState: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(4),
  },
  todayBadge: {
    "& .MuiBadge-badge": {
      fontSize: 9,
      height: 16,
      minWidth: 36,
      padding: "0 4px",
      borderRadius: 8,
      fontWeight: 700,
    },
  },
}));

const toYyyyMmDd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

interface DayGroup {
  key: string;
  dayStartMs: number;
  weekday: string;
  dayNumber: string;
  monthName: string;
  occurrences: { project: any }[];
}

const buildDayGroups = (events: any[], locale: string): DayGroup[] => {
  const groups = new Map<string, DayGroup>();

  events.forEach((project) => {
    const start = new Date(project.start_date);
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayStartMs = day.getTime();
    const key = toYyyyMmDd(day);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        dayStartMs,
        weekday: day.toLocaleDateString(locale, { weekday: "long" }),
        dayNumber: day.toLocaleDateString(locale, { day: "numeric" }),
        monthName: day.toLocaleDateString(locale, { month: "long" }),
        occurrences: [],
      });
    }
    groups.get(key)!.occurrences.push({ project });
  });

  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.dayStartMs - b.dayStartMs);

  sortedGroups.forEach((group) => {
    group.occurrences.sort((a, b) => {
      const ta = getDisplaySortTimestamp(a.project, group.dayStartMs);
      const tb = getDisplaySortTimestamp(b.project, group.dayStartMs);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      if (ta !== tb) return ta - tb;
      const aa = toTimestamp(a.project?.start_date) ?? 0;
      const bb = toTimestamp(b.project?.start_date) ?? 0;
      return aa - bb;
    });
  });

  return sortedGroups;
};

export default function EventCalendarEventList({
  initialEvents = [],
  initialHasMore = false,
  search,
  sectors,
  selectedDay,
  hubUrl,
  subHubName,
}: {
  initialEvents?: any[];
  initialHasMore?: boolean;
  search: string;
  sectors: string[];
  selectedDay: Dayjs;
  hubUrl?: string;
  subHubName?: string;
}) {
  const { locale, CUSTOM_HUB_URLS } = useContext(UserContext);
  const { hubData, hubUrl: contextHubUrl } = useContext(HubContext);
  const hubName = hubData?.name;
  const classes = useStyles();
  const texts = getTexts({ page: "hub", locale: locale });
  const theme = useTheme();
  const isCustomHub = CUSTOM_HUB_URLS?.includes(contextHubUrl || hubUrl);
  const startOfTodayMs = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const [allEvents, setAllEvents] = useState<any[]>(initialEvents);
  const currentPageRef = useRef(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const didInitFetch = useRef(false);

  const fetchEvents = useCallback(
    async (page: number, append: boolean) => {
      setLoading(true);
      setError(false);
      const token = new Cookies().get("auth_token");
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (sectors.length) params.set("sectors", sectors.join(","));
      const start = selectedDay.startOf("day");
      params.set("start_date", start.format("YYYY-MM-DDTHH:mm:ssZ"));
      params.set("page", String(page));
      params.set("page_size", "12");
      if (hubUrl) params.set("hub", hubUrl);

      try {
        const { data } = await apiRequest({
          method: "get",
          url: `/api/events/?${params.toString()}`,
          token,
          locale,
        });
        const results = data.results || [];
        setAllEvents((prev) => (append ? [...prev, ...results] : results));
        currentPageRef.current = page;
        setHasMore(data.next !== null);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [search, sectors, selectedDay, hubUrl, locale]
  );

  const loadMore = useCallback(async () => {
    await fetchEvents(currentPageRef.current + 1, true);
  }, [fetchEvents]);

  const { lastElementRef } = useInfiniteScroll({
    hasMore,
    isLoading: loading,
    onLoadMore: loadMore,
  });

  useEffect(() => {
    if (didInitFetch.current) {
      const handler = setTimeout(
        () => {
          setAllEvents([]);
          currentPageRef.current = 1;
          setHasMore(false);
          fetchEvents(1, false);
        },
        search ? 400 : 0
      );
      return () => clearTimeout(handler);
    }
    didInitFetch.current = true;
    if (initialEvents.length === 0) {
      const handler = setTimeout(() => {
        fetchEvents(1, false);
      }, 0);
      return () => clearTimeout(handler);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sectors, selectedDay, hubUrl]);

  const dayGroups = buildDayGroups(allEvents, locale);

  return (
    <>
      {loading && allEvents.length === 0 && <CircularProgress />}
      {error && (
        <Typography className={classes.emptyState}>
          {texts.error_loading_events ?? "Failed to load events."}
        </Typography>
      )}
      {!loading && !error && dayGroups.length === 0 && (
        <NoItemsFound type="events" hubName={hubName} subHubName={subHubName} />
      )}
      {!error &&
        dayGroups.map((group, groupIdx) => {
          const isLastGroup = groupIdx === dayGroups.length - 1;
          const isToday = group.dayStartMs === startOfTodayMs;
          const isPast = group.dayStartMs < startOfTodayMs;
          const tileBg = isPast
            ? isCustomHub
              ? theme.palette.grey.light
              : theme.palette.secondary.extraLight
            : isCustomHub
            ? theme.palette.primary.main
            : theme.palette.yellow.main;
          const tileColor = isPast
            ? isCustomHub
              ? theme.palette.text.primary
              : theme.palette.secondary.main
            : theme.palette.background.default_contrastText;

          return (
            <Box key={group.key} ref={isLastGroup ? lastElementRef : undefined}>
              <div className={classes.dayHeader}>
                <Badge
                  badgeContent={isToday ? texts.today : null}
                  color="secondary"
                  className={classes.todayBadge}
                  anchorOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  <div
                    className={classes.dayTile}
                    style={{
                      backgroundColor: tileBg,
                      color: tileColor,
                    }}
                  >
                    <span className={classes.dayTileMonth}>{group.monthName}</span>
                    <span className={classes.dayTileDay}>{group.dayNumber}</span>
                  </div>
                </Badge>
                <Typography className={classes.dayWeekday} component="span">
                  {group.weekday}
                </Typography>
              </div>
              <div className={classes.dayGroup}>
                {group.occurrences.map((occurrence) => (
                  <EventCardWide key={occurrence.project.url_slug} project={occurrence.project} />
                ))}
              </div>
            </Box>
          );
        })}
      {loading && allEvents.length > 0 && <CircularProgress size={24} />}
    </>
  );
}

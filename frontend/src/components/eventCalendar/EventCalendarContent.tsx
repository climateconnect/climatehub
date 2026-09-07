import {
  Badge,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  Typography,
  useMediaQuery,
  Theme,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import TuneIcon from "@mui/icons-material/Tune";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import FilterSearchBar from "../filter/FilterSearchBar";
import GenericDialog from "../dialogs/GenericDialog";
import EventCalendarEventList from "./EventCalendarEventList";
import SubscribeToCalendarButton from "./SubscribeToCalendarButton";
import { useFeatureToggles } from "../featureToggle/FeatureToggleProvider";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/de";
import "dayjs/locale/en";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import Cookies from "universal-cookie";
import { apiRequest } from "../../../public/lib/apiOperations";

const useStyles = makeStyles((theme) => ({
  mobileSearchBar: {
    width: "100%",
    marginBottom: theme.spacing(0),
  },
  leftSearchBar: {
    width: "100%",
  },
  filterLabel: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
  topicList: {
    display: "flex",
    flexDirection: "column",
  },
  topicIcon: {
    height: 20,
    width: 20,
    marginRight: theme.spacing(0.5),
    flexShrink: 0,
  },
  topicLabel: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  layout: {
    display: "flex",
    gap: theme.spacing(4),
    alignItems: "flex-start",
    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
    },
  },
  pageContainer: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(10),
    },
  },
  leftPanel: {
    width: 260,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
      width: "100%",
    },
  },
  rightPanel: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
  },
  mobileFilterRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
  mobileFilterButton: {
    borderColor: "#707070",
    height: 40,
    flexShrink: 0,
    marginLeft: theme.spacing(1),
  },
  mobileFilterIcon: {
    color: theme.palette.background.default_contrastText,
  },
  mobileFilterDialogContent: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    padding: theme.spacing(0, 1),
  },
  resetButton: {
    alignSelf: "flex-start",
    marginTop: theme.spacing(1),
  },
  calendar: {
    width: "100%",
    overflow: "visible",
  },
  dayCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: "1 1 0",
    minWidth: 0,
    overflow: "hidden",
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    backgroundColor: theme.palette.primary.main,
    marginTop: 2,
  },
}));

function syncFiltersToUrl(search: string, sectors: string[], selectedDay: Dayjs) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sectors.length) params.set("sectors", sectors.join(","));
  params.set("date", selectedDay.format("YYYY-MM-DD"));
  const qs = params.toString();
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const newUrl = `${origin}${pathname}?${qs}`;
  if (newUrl !== window.location.href) {
    window.history.replaceState({}, "", newUrl);
  }
}

function readFiltersFromUrl() {
  if (typeof window === "undefined")
    return {} as { search?: string; sectors?: string[]; selectedDay?: Dayjs };
  const params = new URLSearchParams(window.location.search);
  const search = params.get("search") || "";
  const sectorsParam = params.get("sectors");
  const sectors = sectorsParam ? sectorsParam.split(",") : [];
  const dateParam = params.get("date");
  let selectedDay: Dayjs | undefined;
  if (dateParam) {
    const parsed = dayjs(dateParam, "YYYY-MM-DD", true);
    if (parsed.isValid()) selectedDay = parsed;
  }
  return { search, sectors, selectedDay };
}

export default function EventCalendarContent({
  initialEvents = [],
  initialHasMore = false,
  initialSearch = "",
  initialSectors = [] as string[],
  initialSelectedDay,
  filterChoices,
  hubUrl,
  subHubName,
}: any) {
  const { locale } = useContext(UserContext);
  const classes = useStyles();
  const texts = getTexts({ page: "hub", locale: locale });
  const filterTexts = getTexts({ page: "filter_and_search", locale: locale });
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const { isEnabled } = useFeatureToggles();
  const showSubscribe = isEnabled("ICAL_SUBSCRIPTION_FEED_FEATURE");

  const urlFilters = useRef(readFiltersFromUrl());
  const initialDay = initialSelectedDay
    ? dayjs(initialSelectedDay)
    : urlFilters.current.selectedDay || dayjs();

  const [search, setSearch] = useState(urlFilters.current.search || initialSearch);
  const [sectors, setSectors] = useState<string[]>(
    urlFilters.current.sectors?.length ? urlFilters.current.sectors : initialSectors
  );
  const [selectedDay, setSelectedDay] = useState<Dayjs>(initialDay);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Dayjs>(initialDay.startOf("month"));
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});

  // --- Draft state for mobile staged apply ---
  const [draftSectors, setDraftSectors] = useState<string[]>(sectors);
  const [draftSelectedDay, setDraftSelectedDay] = useState<Dayjs>(selectedDay);
  const [draftViewMonth, setDraftViewMonth] = useState<Dayjs>(viewMonth);
  const overlayOpenRef = useRef(false);

  // Snapshot applied filters into draft when the dialog opens
  useEffect(() => {
    if (mobileFiltersOpen && !overlayOpenRef.current) {
      setDraftSectors([...sectors]);
      setDraftSelectedDay(selectedDay);
      setDraftViewMonth(viewMonth);
      overlayOpenRef.current = true;
    }
    if (!mobileFiltersOpen) {
      overlayOpenRef.current = false;
    }
  }, [mobileFiltersOpen]);

  // Active filter count: sectors + non-today date
  const activeFilterCount =
    (sectors.length > 0 ? 1 : 0) + (!selectedDay.isSame(dayjs(), "day") ? 1 : 0);

  // Sync filter state to URL
  useEffect(() => {
    const handler = setTimeout(
      () => {
        syncFiltersToUrl(search, sectors, selectedDay);
      },
      search ? 400 : 0
    );
    return () => clearTimeout(handler);
  }, [search, sectors, selectedDay]);

  const fetchCounts = async () => {
    const token = new Cookies().get("auth_token");
    const params = new URLSearchParams();
    params.set("year", String(viewMonth.year()));
    params.set("month", String(viewMonth.month() + 1));
    params.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (search) params.set("search", search);
    if (sectors.length) params.set("sectors", sectors.join(","));
    if (hubUrl) params.set("hub", hubUrl);
    try {
      const { data } = await apiRequest({
        method: "get",
        url: `/api/events/calendar/?${params.toString()}`,
        token,
        locale,
      });
      const map: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((item: { date: string; count: number }) => {
          map[item.date] = item.count;
        });
      }
      setDayCounts(map);
    } catch (e) {
      setDayCounts({});
    }
  };

  useEffect(() => {
    const handler = setTimeout(
      () => {
        fetchCounts();
      },
      search ? 400 : 0
    );
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, search, sectors, hubUrl]);

  const handleToggleSector = (name: string) => {
    setSectors((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  const handleReset = () => {
    setSearch("");
    setSectors([]);
    setSelectedDay(dayjs());
  };

  // --- Mobile staged handlers ---
  const handleToggleDraftSector = useCallback((name: string) => {
    setDraftSectors((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }, []);

  const handleDraftDayChange = useCallback(
    (newValue: Dayjs | null) => {
      const value = newValue ?? dayjs();
      setDraftSelectedDay(value);
      if (value.year() !== draftViewMonth.year() || value.month() !== draftViewMonth.month()) {
        setDraftViewMonth(value.startOf("month"));
      }
    },
    [draftViewMonth]
  );

  const handleDraftMonthChange = useCallback((newValue: Dayjs) => {
    setDraftViewMonth(newValue.startOf("month"));
  }, []);

  const handleResetDraft = useCallback(() => {
    setDraftSectors([]);
    setDraftSelectedDay(dayjs());
    setDraftViewMonth(dayjs().startOf("month"));
  }, []);

  const handleApplyMobileFilters = useCallback(() => {
    setSectors(draftSectors);
    setSelectedDay(draftSelectedDay);
    setViewMonth(draftViewMonth);
    setMobileFiltersOpen(false);
  }, [draftSectors, draftSelectedDay, draftViewMonth]);

  const DayWithEvents = (props: any) => {
    const { day, outsideCurrentMonth, ...other } = props;
    const key = day.format("YYYY-MM-DD");
    const count = dayCounts[key] || 0;
    return (
      <div className={classes.dayCell}>
        <PickersDay
          {...other}
          day={day}
          outsideCurrentMonth={outsideCurrentMonth}
          sx={{ width: 32, height: 32, fontSize: 13, margin: 0 }}
        />
        {!outsideCurrentMonth && count > 0 && (
          <span
            className={classes.eventDot}
            title={`${count} ${count === 1 ? "event" : "events"}`}
          />
        )}
      </div>
    );
  };

  return (
    <Container maxWidth="lg" className={classes.pageContainer}>
      {isNarrowScreen && (
        <div className={classes.mobileFilterRow}>
          <FilterSearchBar
            className={classes.mobileSearchBar}
            label={texts.search_events ?? "Search events"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSubmit={(_type, value) => setSearch(value)}
            type="events"
          />
          <Badge
            badgeContent={activeFilterCount > 0 ? activeFilterCount : null}
            color="secondary"
            max={9}
            aria-label={activeFilterCount > 0 ? `${activeFilterCount} active filters` : undefined}
          >
            <Button
              className={classes.mobileFilterButton}
              variant="outlined"
              onClick={() => setMobileFiltersOpen(true)}
              startIcon={<TuneIcon className={classes.mobileFilterIcon} />}
            >
              {texts.filters ?? "Filters"}
            </Button>
          </Badge>
          {showSubscribe && (
            <SubscribeToCalendarButton
              hubUrl={hubUrl}
              search={search}
              sectors={sectors}
              date={selectedDay.format("YYYY-MM-DD")}
              variant="icon"
            />
          )}
        </div>
      )}

      {isNarrowScreen && (
        <GenericDialog
          activeFilterCount={activeFilterCount}
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          onApply={handleApplyMobileFilters}
          title={filterTexts.filters ?? "Filters"}
          fullScreen
          useApplyButton
          applyText={filterTexts.apply_filters ?? "Apply filters"}
          topBarFixed
        >
          <div className={classes.mobileFilterDialogContent}>
            <LocalizationProvider adapterLocale={locale} dateAdapter={AdapterDayjs}>
              <DateCalendar
                className={classes.calendar}
                value={draftSelectedDay}
                onChange={handleDraftDayChange}
                onMonthChange={handleDraftMonthChange}
                slots={{ day: DayWithEvents }}
              />
            </LocalizationProvider>

            <FormControl component="fieldset" fullWidth>
              <Typography component="legend" className={classes.filterLabel}>
                {texts.topic ?? "Topics"}
              </Typography>
              <div className={classes.topicList}>
                {(filterChoices?.sectors || []).map((s: any) => (
                  <FormControlLabel
                    key={s.original_name}
                    control={
                      <Checkbox
                        size="small"
                        checked={draftSectors.includes(s.original_name)}
                        onChange={() => handleToggleDraftSector(s.original_name)}
                      />
                    }
                    label={
                      <span className={classes.topicLabel}>
                        {s.icon && (
                          <img src={getImageUrl(s.icon)} className={classes.topicIcon} alt="" />
                        )}
                        <Typography component="span" variant="body2" noWrap>
                          {s.name}
                        </Typography>
                      </span>
                    }
                  />
                ))}
              </div>
            </FormControl>

            <Button
              className={classes.resetButton}
              variant="outlined"
              color="primary"
              onClick={handleResetDraft}
            >
              {filterTexts.clear_all ?? "Clear all"}
            </Button>

            {showSubscribe && (
              <SubscribeToCalendarButton
                hubUrl={hubUrl}
                search={search}
                sectors={draftSectors}
                date={draftSelectedDay.format("YYYY-MM-DD")}
              />
            )}
          </div>
        </GenericDialog>
      )}

      <div className={classes.layout}>
        {!isNarrowScreen && (
          <div className={classes.leftPanel}>
            <FilterSearchBar
              className={classes.leftSearchBar}
              label={texts.search_events ?? "Search events"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSubmit={(_type, value) => setSearch(value)}
              type="events"
            />
            <LocalizationProvider adapterLocale={locale} dateAdapter={AdapterDayjs}>
              <DateCalendar
                className={classes.calendar}
                value={selectedDay}
                onChange={(newValue: Dayjs | null) => {
                  const value = newValue ?? dayjs();
                  setSelectedDay(value);
                  if (value.year() !== viewMonth.year() || value.month() !== viewMonth.month()) {
                    setViewMonth(value.startOf("month"));
                  }
                }}
                onMonthChange={(newValue: Dayjs) => setViewMonth(newValue.startOf("month"))}
                slots={{ day: DayWithEvents }}
              />
            </LocalizationProvider>

            <FormControl component="fieldset" fullWidth>
              <Typography component="legend" className={classes.filterLabel}>
                {texts.topic ?? "Topics"}
              </Typography>
              <div className={classes.topicList}>
                {(filterChoices?.sectors || []).map((s: any) => (
                  <FormControlLabel
                    key={s.original_name}
                    control={
                      <Checkbox
                        size="small"
                        checked={sectors.includes(s.original_name)}
                        onChange={() => handleToggleSector(s.original_name)}
                      />
                    }
                    label={
                      <span className={classes.topicLabel}>
                        {s.icon && (
                          <img src={getImageUrl(s.icon)} className={classes.topicIcon} alt="" />
                        )}
                        <Typography component="span" variant="body2" noWrap>
                          {s.name}
                        </Typography>
                      </span>
                    }
                  />
                ))}
              </div>
            </FormControl>

            <Button
              className={classes.resetButton}
              variant="outlined"
              color="primary"
              onClick={handleReset}
            >
              {texts.reset ?? "Reset"}
            </Button>

            {showSubscribe && (
              <SubscribeToCalendarButton
                hubUrl={hubUrl}
                search={search}
                sectors={sectors}
                date={selectedDay.format("YYYY-MM-DD")}
              />
            )}
          </div>
        )}

        <div className={classes.rightPanel}>
          <EventCalendarEventList
            initialEvents={initialEvents}
            initialHasMore={initialHasMore}
            search={search}
            sectors={sectors}
            selectedDay={selectedDay}
            hubUrl={hubUrl}
            subHubName={subHubName}
          />
        </div>
      </div>
    </Container>
  );
}

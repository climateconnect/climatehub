import { useState, useEffect, useMemo, useContext } from "react";
import { getUpcomingEvents } from "../../public/lib/getDataOperations";
import { isLocationValid } from "../../public/lib/locationOperations";
import { useFeatureToggles } from "../components/featureToggle";
import { useUpcomingEventsDisplayCount } from "./useUpcomingEventsDisplayCount";
import UserContext from "../components/context/UserContext";
import Cookies from "universal-cookie";

export function useUpcomingEvents(filters: any, hubUrl?: string) {
  const token = new Cookies().get("auth_token");
  const { locale } = useContext(UserContext);
  const { isEnabled } = useFeatureToggles();
  const isEventsEnabled = isEnabled("EVENT_CALENDAR_FEATURE");
  const eventsDisplayCount = useUpcomingEventsDisplayCount();

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  const startDateFilter = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  }, []);

  const stableLocation = useMemo(
    () => (isLocationValid(filters.location) ? filters.location : undefined),
    [filters.location]
  );

  useEffect(() => {
    if (!isEventsEnabled) {
      setUpcomingEvents([]);
      return;
    }

    const fetchUpcoming = async () => {
      const events = await getUpcomingEvents({
        token,
        locale,
        hubUrl: hubUrl,
        filters: {
          search: filters.search,
          sectors: filters.sectors,
          start_date: startDateFilter,
        },
        location: stableLocation,
      });
      setUpcomingEvents(events || []);
    };

    fetchUpcoming();
  }, [
    isEventsEnabled,
    filters.search,
    filters.sectors,
    startDateFilter,
    stableLocation,
    token,
    locale,
    hubUrl,
  ]);

  const visibleEvents = useMemo(() => upcomingEvents.slice(0, eventsDisplayCount), [
    upcomingEvents,
    eventsDisplayCount,
  ]);
  const shouldRenderUpcomingBand = isEventsEnabled && upcomingEvents.length >= eventsDisplayCount;
  const featuredProjects = useMemo(() => {
    if (!isEventsEnabled || upcomingEvents.length === 0) return [];
    return shouldRenderUpcomingBand ? upcomingEvents.slice(eventsDisplayCount) : upcomingEvents;
  }, [isEventsEnabled, upcomingEvents, shouldRenderUpcomingBand, eventsDisplayCount]);
  const bandEventSlugs = useMemo(
    () => (shouldRenderUpcomingBand ? new Set(visibleEvents.map((e) => e.url_slug)) : new Set()),
    [shouldRenderUpcomingBand, visibleEvents]
  );

  return {
    visibleEvents,
    featuredProjects,
    bandEventSlugs,
    shouldRenderUpcomingBand,
    isEventsEnabled,
  };
}

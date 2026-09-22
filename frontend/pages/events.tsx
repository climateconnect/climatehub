import { GetServerSideProps } from "next";
import NextCookies from "next-cookies";
import React, { useContext, useMemo } from "react";
import { Theme, useMediaQuery } from "@mui/material";
import { getSectorOptions } from "../public/lib/getOptions";
import { apiRequest } from "../public/lib/apiOperations";
import { getFeatureTogglesFromRequest } from "../src/hooks/featureToggles";
import getTexts from "../public/texts/texts";
import UserContext from "../src/components/context/UserContext";
import { HubContext } from "../src/components/context/HubContext";
import WideLayout from "../src/components/layouts/WideLayout";
import PageNav from "../src/components/pageNav/PageNav";
import EventCalendarContent from "../src/components/eventCalendar/EventCalendarContent";
import MobilePageNav from "../src/components/pageNav/MobilePageNav";

const toOffsetIso = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { featureToggles } = await getFeatureTogglesFromRequest(ctx.req);
  if (!featureToggles.EVENT_CALENDAR_FEATURE) {
    return { notFound: true };
  }

  const locale = ctx.locale ?? "en";
  const token = NextCookies(ctx).auth_token;

  const [sectorOptions] = await Promise.all([getSectorOptions(locale)]);

  const querySearch = (ctx.query.search as string) || "";
  const querySectors = (ctx.query.sectors as string) || "";
  const queryDate = ctx.query.date as string | undefined;

  let startDateStr: string;
  let initialSelectedDay: string | undefined;
  if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
    const [y, m, d] = queryDate.split("-").map(Number);
    startDateStr = toOffsetIso(new Date(y, m - 1, d, 0, 0, 0));
    initialSelectedDay = queryDate;
  } else {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    startDateStr = toOffsetIso(start);
  }

  let initialEvents: any[] = [];
  let initialHasMore = false;
  try {
    const params = new URLSearchParams({
      start_date: startDateStr,
      page: "1",
      page_size: "12",
    });
    if (querySearch) params.set("search", querySearch);
    if (querySectors) params.set("sectors", querySectors);
    const { data } = await apiRequest({
      method: "get",
      url: `/api/events/?${params.toString()}`,
      token,
      locale: locale as any,
    });
    initialEvents = data.results || [];
    initialHasMore = data.next !== null;
  } catch (e) {
    // Initial fetch failed; the client will retry when filters change.
  }

  return {
    props: {
      filterChoices: { sectors: sectorOptions },
      initialEvents,
      initialHasMore,
      initialSearch: querySearch,
      initialSectors: querySectors ? querySectors.split(",") : [],
      initialSelectedDay: initialSelectedDay || null,
    },
  };
};

export default function EventsPage({
  filterChoices,
  initialEvents,
  initialHasMore,
  initialSearch,
  initialSectors,
  initialSelectedDay,
}: any) {
  const { locale, hubUrl } = useContext(UserContext);
  const { hubs } = useContext(HubContext);
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const texts = useMemo(() => getTexts({ page: "hub", locale: locale }), [locale]);

  const type_names = {
    projects: texts.projects,
    organizations: isNarrowScreen ? texts.orgs : texts.organizations,
    members: texts.members,
  };

  return (
    <WideLayout>
      <PageNav
        activeEntry={null}
        type_names={type_names}
        hubUrl={hubUrl}
        className=""
        allHubs={hubs}
        fromPage="browse"
        subHubSegment={undefined}
      />
      <EventCalendarContent
        initialEvents={initialEvents}
        initialHasMore={initialHasMore}
        initialSearch={initialSearch}
        initialSectors={initialSectors}
        initialSelectedDay={initialSelectedDay}
        filterChoices={filterChoices}
        hubUrl={hubUrl}
      />
      {isNarrowScreen && <MobilePageNav activeEntry={null} hubUrl={hubUrl} hubAmbassador={null} />}
    </WideLayout>
  );
}

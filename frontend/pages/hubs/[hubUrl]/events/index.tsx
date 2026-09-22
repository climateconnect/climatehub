import { GetServerSideProps, GetServerSidePropsContext } from "next";
import NextCookies from "next-cookies";
import React from "react";
import { extractHubUrlsFromContext, getAllHubs } from "../../../../public/lib/hubOperations";
import { getSectorOptions } from "../../../../public/lib/getOptions";
import { apiRequest } from "../../../../public/lib/apiOperations";
import { getFeatureTogglesFromRequest } from "../../../../src/hooks/featureToggles";
import HubPageLayout from "../../../../src/components/hub/HubPageLayout";
import EventCalendarContent from "../../../../src/components/eventCalendar/EventCalendarContent";
import { getHubData, getLinkedHubsData } from "../../../../public/lib/getHubData";
import getHubTheme from "../../../../src/themes/fetchHubTheme";

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

export async function getHubEventsServerSideProps(ctx: GetServerSidePropsContext) {
  const parentHubUrl = Array.isArray(ctx.query.hubUrl)
    ? ctx.query.hubUrl[0]
    : ctx.query.hubUrl ?? "";
  const subHubSegment = Array.isArray(ctx.query.subHub)
    ? ctx.query.subHub[0]
    : ctx.query.subHub ?? null;
  const { subHub } = extractHubUrlsFromContext(ctx);

  const hubSlug = subHub || parentHubUrl;

  const { featureToggles } = await getFeatureTogglesFromRequest(ctx.req);
  if (!featureToggles.EVENT_CALENDAR_FEATURE) {
    return { notFound: true };
  }

  const locale = ctx.locale ?? "en";
  const token = NextCookies(ctx).auth_token;

  const hubs = await getAllHubs(locale);
  const hubExists = hubs.some((h: any) => h.url_slug === parentHubUrl || h.url_slug === hubSlug);
  if (!hubExists) {
    return { notFound: true };
  }

  const sectorOptions = await getSectorOptions(locale);

  const [hubData, hubThemeData, linkedHubs] = await Promise.all([
    getHubData(hubSlug, locale),
    getHubTheme(parentHubUrl),
    getLinkedHubsData(hubSlug),
  ]);

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
      hub: hubSlug,
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
      hubs,
      hubUrl: parentHubUrl,
      subHubUrl: subHub || null,
      subHubSegment: subHubSegment || null,
      filterChoices: { sectors: sectorOptions },
      initialEvents,
      initialHasMore,
      initialSearch: querySearch,
      initialSectors: querySectors ? querySectors.split(",") : [],
      initialSelectedDay: initialSelectedDay || null,
      hubData,
      hubThemeData,
      linkedHubs: linkedHubs || [],
    },
  };
}

export const getServerSideProps: GetServerSideProps = getHubEventsServerSideProps;

export default function HubEventsPage({
  hubs,
  hubUrl,
  subHubUrl,
  subHubSegment,
  filterChoices,
  initialEvents,
  initialHasMore,
  initialSearch,
  initialSectors,
  initialSelectedDay,
  hubData,
  hubThemeData,
  linkedHubs,
  autoOpenSubscribe,
}: any) {
  const effectiveHubUrl = subHubUrl || hubUrl;

  return (
    <HubPageLayout
      activeEntry={null}
      isEventsPage
      hubUrl={hubUrl}
      subHubSegment={subHubSegment}
      linkedHubs={linkedHubs}
      hubData={hubData}
      hubThemeData={hubThemeData}
      allHubs={hubs}
    >
      <EventCalendarContent
        initialEvents={initialEvents}
        initialHasMore={initialHasMore}
        initialSearch={initialSearch}
        initialSectors={initialSectors}
        initialSelectedDay={initialSelectedDay}
        filterChoices={filterChoices}
        hubUrl={effectiveHubUrl}
        hubName={hubData?.name}
        subHubName={hubData?.parent_hub ? hubData?.name : undefined}
        autoOpenSubscribe={autoOpenSubscribe}
      />
    </HubPageLayout>
  );
}

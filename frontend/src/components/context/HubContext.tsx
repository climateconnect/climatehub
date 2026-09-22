import React, { createContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getAllHubs, getHubslugFromUrl } from "../../../public/lib/hubOperations";
import { getHubData } from "../../../public/lib/getHubData";
import getHubTheme from "../../themes/fetchHubTheme";
import { HubData, HubListItem, LocaleType } from "../../types";

export interface HubContextValue {
  /** Active hub slug derived from the URL. On sub-hub pages this is the
   *  composed slug (e.g. "perth_energy"), on parent-hub pages the raw slug. */
  hubUrl: string;
  /** Full active hub object, when one is set. */
  hubData: HubData | null;
  /** Active hub theme, when a hub is active and a theme exists. */
  hubTheme: any | null;
  /** Full hubs list, fetched once and shared app-wide. */
  hubs: HubListItem[];
}

const defaultHubContextValue: HubContextValue = {
  hubUrl: "",
  hubData: null,
  hubTheme: null,
  hubs: [],
};

export const HubContext = createContext<HubContextValue>(defaultHubContextValue);

/**
 * App-wide source of truth for "the active hub". It is placed *outside*
 * `UserContext.Provider` in `pages/_app.tsx` so that `UserContext.hubUrl` can
 * be shimmed to read from here during the migration.
 *
 * - The hubs list is fetched once (on the server via `getInitialProps`) and
 *   shared by every page; the client never refetches it.
 * - The active slug is derived reactively from `router.query` (path `hubUrl`
 *   preferred, `?hub=` fallback) and updates on client-side navigation.
 * - Hub data + theme are fetched on slug change and cached by slug.
 */
export function HubProvider({
  initialHubs,
  children,
}: {
  initialHubs?: HubListItem[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hubUrl = getHubslugFromUrl(router.query) || "";
  const [hubs, setHubs] = useState<any[]>(initialHubs ?? []);
  const [hubData, setHubData] = useState<HubData | null>(null);
  const [hubTheme, setHubTheme] = useState<any | null>(null);

  // In-memory caches keyed by slug so repeated visits to a hub don't refetch.
  const hubDataCache = useRef<Record<string, HubData | null>>({});
  const hubThemeCache = useRef<Record<string, any | null>>({});

  // Fallback client-side fetch of the hubs list if the server didn't provide
  // it (e.g. after a full client-side reload before any SSR pass).
  useEffect(() => {
    let cancelled = false;
    if (!initialHubs) {
      (async () => {
        const list = await getAllHubs(router.locale as LocaleType);
        if (!cancelled) setHubs(list ?? []);
      })();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHubs]);

  // Fetch hub data + theme whenever the active slug changes, cached by slug.
  useEffect(() => {
    if (!hubUrl) {
      setHubData(null);
      setHubTheme(null);
      return;
    }

    const cachedData = hubDataCache.current[hubUrl];
    const cachedTheme = hubThemeCache.current[hubUrl];
    if (cachedData !== undefined) setHubData(cachedData);
    if (cachedTheme !== undefined) setHubTheme(cachedTheme);

    let cancelled = false;
    (async () => {
      const locale = (router.locale as LocaleType) ?? "en";
      const [data, theme] = await Promise.all([getHubData(hubUrl, locale), getHubTheme(hubUrl)]);
      if (cancelled) return;
      hubDataCache.current[hubUrl] = data;
      hubThemeCache.current[hubUrl] = theme;
      setHubData(data);
      setHubTheme(theme);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubUrl]);

  const value: HubContextValue = { hubUrl, hubData, hubTheme, hubs };
  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

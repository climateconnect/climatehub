import { useRouter } from "next/router";
import { getBrowsePathForType, getHubBrowsePathForType } from "../../public/lib/urlOperations";
import { BrowseEntity } from "../types";

// The four entries shown in the main page nav (desktop top, mobile bottom).
// `BrowseEntity` covers the three entity browsers; the events calendar is
// added as a sibling because it shares the nav row and the same URL-rewriting
// conventions, even though it is a different view on the data.
export type PageNavEntry = BrowseEntity | "events";

const BROWSE_ENTRIES: readonly BrowseEntity[] = ["projects", "organizations", "members"] as const;

/**
 * Detect the events page from the URL. Events is a different *view* (not an
 * entity browser), so pages that render the events calendar don't have an
 * `activeEntry` to pass. Any component that needs to know "are we on the
 * events page?" can read the URL instead.
 */
export function useIsEventsPage(): boolean {
  const router = useRouter();
  return router.pathname.includes("/events");
}

/**
 * Centralised helper for the four page types in the main page nav. Pages
 * signal which entity-browser entry is active via the `activeEntry` prop
 * (the page is the source of truth for that); the events page signals
 * "I am the events page" via the `isEventsPage` URL check above.
 */
export function usePageNavEntries(args: { hubUrl?: string; subHubSegment?: string }) {
  const router = useRouter();
  const { hubUrl = "", subHubSegment } = args;
  const isEventsPage = router.pathname.includes("/events");

  const getHref = (entry: PageNavEntry): string => {
    if (entry === "events") {
      return hubUrl
        ? `/hubs/${hubUrl}${subHubSegment ? `/${subHubSegment}` : ""}/events`
        : "/events";
    }
    return hubUrl
      ? getHubBrowsePathForType(entry, hubUrl, subHubSegment)
      : getBrowsePathForType(entry);
  };

  /**
   * Whether the given entry is the one the user is currently on. `activeEntry`
   * is the entity-browser entry that the page reports as active; the events
   * entry is derived from the URL pathname.
   */
  const isActive = (entry: PageNavEntry, activeEntry: BrowseEntity | null): boolean => {
    if (entry === "events") return isEventsPage;
    return activeEntry === entry;
  };

  return { browseEntries: BROWSE_ENTRIES, getHref, isActive, isEventsPage };
}

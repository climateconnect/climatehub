import { getLocationFilterKeys } from "../data/locationFilters";
import possibleFilters from "../data/possibleFilters";

/**
 * Dummy origin used to parse relative hrefs through the platform `URL` API so
 * that pathname / search / hash are split correctly even when no real origin
 * is available (e.g. in unit tests or server-side code).
 */
const ABSOLUTE_BASE = "http://localhost.invalid";

const isAbsoluteUrl = (href: string): boolean => /^(https?:)?\/\//i.test(href);

/**
 * Serialize a parsed `URL` back to a string, dropping the dummy origin for
 * relative hrefs while keeping absolute URLs intact.
 */
const serializeUrl = (href: string, url: URL): string => {
  if (isAbsoluteUrl(href)) {
    return url.toString();
  }
  return url.pathname + url.search + url.hash;
};

/**
 * Append a single query parameter to an href, returning a well-formed URL.
 *
 * Built on the platform `URL` / `URLSearchParams` APIs so the result is always
 * well-formed: an existing query string is joined with `&` (never a second
 * `?`), a fragment (`#anchor`) is preserved and placed *after* the query, and
 * the value is URL-encoded in exactly one place.
 *
 * Works for both relative paths (`/browse?x=1#top`) and absolute URLs.
 */
export const appendQueryParam = (href: string, key: string, value: string): string => {
  const url = new URL(href, ABSOLUTE_BASE);
  url.searchParams.append(key, value);
  return serializeUrl(href, url);
};

/**
 * Append several query parameters at once (in insertion order). See
 * `appendQueryParam` for the well-formedness guarantees.
 */
export const withQuery = (href: string, params: Record<string, string>): string => {
  const url = new URL(href, ABSOLUTE_BASE);
  Object.keys(params).forEach((key) => {
    url.searchParams.append(key, params[key]);
  });
  return serializeUrl(href, url);
};

/**
 * Builds a URL with the active filters applied.
 *
 * Uses the platform URLSearchParams API so the result is always well-formed.
 */
const getFilterUrl = ({
  activeFilters,
  infoMetadata,
  filterChoices,
  locale,
  idea,
  nonFilterParams,
}: any) => {
  const params = new URLSearchParams();

  const filteredParamsStr = encodeQueryParamsFromFilters({
    filters: activeFilters,
    infoMetadata: infoMetadata,
    filterChoices: filterChoices,
    locale: locale,
  });
  if (filteredParamsStr) {
    new URLSearchParams(filteredParamsStr).forEach((value, key) => params.append(key, value));
  }

  if (nonFilterParams) {
    Object.keys(nonFilterParams).forEach((key) => {
      params.append(key, nonFilterParams[key]);
    });
  }

  if (idea) {
    params.append("idea", idea.url_slug);
  }

  const origin = window?.location?.origin;
  const pathname = window?.location?.pathname;
  const hashFragment = window?.location?.hash;
  const queryString = params.toString();
  const newUrl = `${origin}${pathname}${queryString ? `?${queryString}` : ""}${hashFragment}`;
  return newUrl;
};

const findOptionByNameDeep = ({ filterChoices, propertyToFilterBy, valueToFilterBy }) => {
  return filterChoices?.reduce((result, filterChoice) => {
    if (filterChoice[propertyToFilterBy] === valueToFilterBy) {
      result = filterChoice;
    }
    const subcategoriesFiltered = filterChoice?.subcategories?.filter(
      (fc) => fc[propertyToFilterBy] === valueToFilterBy
    );
    if (subcategoriesFiltered?.length > 0) {
      result = subcategoriesFiltered[0];
    }
    return result;
  }, null);
};

const getFilterName = (filter, key, filterChoices) => {
  const keyToFilterChoicesKeyMap = {
    organization_type: "organization_types",
    skills: "skills",
    sectors: "sectors",
  };
  //get the filter choice we were looking for (either on top level or one level down)
  const filterName = findOptionByNameDeep({
    filterChoices: filterChoices[keyToFilterChoicesKeyMap[key]],
    propertyToFilterBy: "name",
    valueToFilterBy: filter,
  })?.original_name;

  return filterName;
};

/**
 * Encodes active filters into a URLSearchParams query string.
 *
 * Returns a clean query string (e.g. "sectors=Energy&search=climate") without
 * leading "?" or "&". Uses the platform URLSearchParams API for proper encoding.
 */
const encodeQueryParamsFromFilters = ({ filters, infoMetadata, filterChoices, locale }) => {
  if (!filters || Object.entries(filters).length === 0) {
    return "";
  }
  const params = new URLSearchParams();
  const allPossibleFilters = possibleFilters({
    key: "all",
    filterChoices: filterChoices,
    locale: locale,
  });

  const usedFilterKeys = allPossibleFilters.map((f) => f.key);
  if (usedFilterKeys.includes("location")) {
    usedFilterKeys.push("radius");
  }

  Object.keys(filters)
    .filter((filterKey) => usedFilterKeys.includes(filterKey))
    .forEach((filterKey) => {
      const type = infoMetadata && infoMetadata[filterKey]?.type;
      const locationFilterkeys = getLocationFilterKeys();

      if (type === "location") {
        if (typeof filters[filterKey] === "object") {
          const locationFilter = filters[filterKey];
          params.append("place_id", locationFilter.place_id ?? "");
          params.append("osm_id", locationFilter.osm_id ?? "");
          params.append("osm_type", locationFilter.osm_type ?? "");
          params.append("osm_class", locationFilter.osm_class ?? "");
        }
      } else if (
        !["search", "radius"].includes(filterKey) &&
        filterKey !== "idea" &&
        filters[filterKey] &&
        filters[filterKey].length > 0 &&
        !locationFilterkeys.includes(filterKey)
      ) {
        let filterValues;
        const possibleFiltersForFilterKey = possibleFilters({
          key: "all",
          filterChoices: filterChoices,
          locale: locale,
        }).find((f) => f.key === filterKey);
        if (Array.isArray(filters[filterKey])) {
          filterValues = [
            filters[filterKey].map((filter) => {
              return getFilterName(filter, filterKey, filterChoices);
            }),
          ].join();
        } else {
          const options = (possibleFiltersForFilterKey as any).options;
          filterValues = findOptionByNameDeep({
            filterChoices: options,
            propertyToFilterBy: "name",
            valueToFilterBy: filters[filterKey],
          })?.original_name;
        }
        if (filterValues) {
          params.append(filterKey, filterValues);
        }
      } else if (
        ["search", "radius"].includes(filterKey) &&
        filters[filterKey] &&
        filters[filterKey].length > 0
      ) {
        const value =
          filterKey === "radius" ? filters[filterKey].replace("km", "") : filters[filterKey];
        params.append(filterKey, value);
      }
    });
  return params.toString();
};

const getSearchParams = (searchString) => {
  const urlSearchParams = new URLSearchParams(searchString);
  const params = {};
  for (const [key, value] of urlSearchParams) {
    params[key] = value;
  }
  return params;
};

/**
 * Maps a browse tab type to its URL path segment.
 *
 * `projects` maps to `browse` (not `projects`) because the projects page also
 * includes ideas and events, and `browse` is the more intuitive name for users.
 * Use this everywhere instead of hardcoding `tab === "projects" ? "/browse" : ...`.
 */
const BROWSE_TYPE_TO_PATH: Record<string, string> = {
  projects: "browse",
  organizations: "organizations",
  members: "members",
};

/**
 * Returns the global browse path for a given tab type
 * (e.g. "projects" → "/browse", "organizations" → "/organizations").
 */
const getBrowsePathForType = (type: string): string => `/${BROWSE_TYPE_TO_PATH[type] ?? type}`;

/**
 * Returns the hub-scoped browse path for a given tab type and hub context.
 * e.g. ("projects", "kassel") → "/hubs/kassel/browse",
 *      ("projects", "kassel", "zerowaste") → "/hubs/kassel/zerowaste/browse"
 */
const getHubBrowsePathForType = (type: string, hubUrl: string, subHubSegment?: string): string => {
  const browsePath = subHubSegment ? `/hubs/${hubUrl}/${subHubSegment}` : `/hubs/${hubUrl}`;
  return `${browsePath}/${BROWSE_TYPE_TO_PATH[type] ?? type}`;
};

export {
  getFilterUrl,
  encodeQueryParamsFromFilters,
  getSearchParams,
  findOptionByNameDeep,
  getBrowsePathForType,
  getHubBrowsePathForType,
};

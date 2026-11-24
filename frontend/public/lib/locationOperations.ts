import { getLocationFilterKeys } from "../data/locationFilters";
import { apiRequest } from "./apiOperations";
import { CcLocale } from "../../src/types";

const CUSTOM_NAME_MAPPINGS = {
  "Scotland (state), Scotland": "Scotland",
};

//These countries are wrongly categorized as states in Nominatim. We want to show them as countries as this is more clear
const MAP_STATE_AS_COUNTRY_CODES = new Set(["gb"]);

const buildLocationName = (firstPart: string, middlePart: string, lastPart: string): string => {
  const parts: string[] = [];

  if (firstPart) {
    parts.push(firstPart);
  }

  const showMiddlePart = middlePart && middlePart !== firstPart && middlePart !== lastPart;

  if (showMiddlePart) {
    parts.push(middlePart);
  }

  if (lastPart && lastPart !== firstPart) {
    parts.push(lastPart);
  }

  return parts.join(", ");
};

type DisplayLocation = {
  name: string;
  city: string;
  state: string;
  country: string;
};

const DEFAULT_DISPLAY_LOCATION: DisplayLocation = {
  name: "",
  city: "",
  state: "",
  country: "",
};

//This function has an equivalent in backend/location/utility.py -> format_location_name
//We should consider using the same codebase for these
export function getDisplayLocationFromLocation(location): DisplayLocation {
  if (location.added_manually)
    return {
      name: location.name,
      city: location.city,
      state: location.state,
      country: location.country,
    };
  if (!location.address || !location.address.country)
    return { ...DEFAULT_DISPLAY_LOCATION, name: location.display_name };
  const firstPartOrder = [
    "hamlet",
    "village",
    "town",
    "city_district",
    "suburb",
    "borough",
    "subdivision",
    "neighbourhood",
    "place",
    "city",
    "district",
    "municipality",
    "county",
    "state_district",
    "province",
    "administrative",
    "state",
    "region",
  ];
  const middlePartOrder = [
    "city_district",
    "county",
    "district",
    "suburb",
    "borough",
    "subdivision",
    "neighbourhood",
    "town",
    "village",
  ];
  if (isCountry(location)) {
    return {
      ...DEFAULT_DISPLAY_LOCATION,
      country: location.address.country,
      name: location.display_name,
    };
  }
  const middlePartSuffixes = ["town", "city", "county", "state"];
  const firstPart = getFirstPart(location.address, firstPartOrder);
  const middlePart = getMiddlePart(location.address, middlePartOrder, middlePartSuffixes);
  const lastPart =
    MAP_STATE_AS_COUNTRY_CODES.has(location?.address?.country_code?.toLowerCase()) &&
    location?.address?.state
      ? location.address.state
      : location.address.country;
  let name = buildLocationName(firstPart, middlePart, lastPart);
  //For certain locations our automatic name generation doesn't work. In this case we want to override the name with a custom one
  if (Object.keys(CUSTOM_NAME_MAPPINGS).includes(name)) {
    name = CUSTOM_NAME_MAPPINGS[name];
  }
  return {
    city: firstPart,
    state: location.address?.state || middlePart,
    country: location.address.country,
    name: name,
  };
}

const getCityOrCountyName = (address) => {
  const cityElementOrder = [
    "city",
    "place",
    "boundary",
    "town",
    "village",
    "place",
    "municipality",
    "county",
    "state_district",
    "province",
    "administrative",
    "state",
    "region",
  ];
  return getFirstPart(address, cityElementOrder);
};

const getPlaceSpecificName = (location): string => {
  return location.address[location.class] || location.address[location.type] || "";
};

const buildStreetAddress = (location): string => {
  if (!location?.address?.road) {
    return "";
  }
  const road = location.address.road;
  const houseNumber = location.address.house_number;
  return houseNumber ? `${road} ${houseNumber}` : road;
};

const buildCityAndCountryPart = (city: string, country: string, firstPart: string): string => {
  const shouldIncludeCity = firstPart !== city && city;
  return shouldIncludeCity ? `${city}, ${country}` : country;
};

export function getDisplayLocationFromExactLocation(location): DisplayLocation {
  //If the location object is empty, just return empty strings
  if (Object.keys(location).length === 0) {
    return DEFAULT_DISPLAY_LOCATION;
  }
  const isConcretePlace = isExactLocation(location);
  const firstPart = isConcretePlace ? getPlaceSpecificName(location) : "";
  const middlePart = isConcretePlace ? buildStreetAddress(location) : "";
  const city = getCityOrCountyName(location.address);
  const country =
    MAP_STATE_AS_COUNTRY_CODES.has(location?.address?.country_code?.toLowerCase()) &&
    location?.address?.state
      ? location.address.state
      : location.address.country;
  const cityAndCountry = buildCityAndCountryPart(city, country, firstPart);

  let name = buildLocationName(firstPart, middlePart, cityAndCountry);

  //For certain locations our automatic name generation doesn't work. In this case we want to override the name with a custom one
  if (Object.keys(CUSTOM_NAME_MAPPINGS).includes(name)) {
    name = CUSTOM_NAME_MAPPINGS[name];
  }
  return {
    name: name || location.display_name || "test",
    city: city,
    state: location.address.state,
    country: location.address.country,
  };
}

const getFirstPart = (address, order) => {
  for (const el of order) {
    if (address[el]) {
      if (el === "state") return address[el] + " (state)";
      if (el === "municipality") return address[el] + " (municipality)";
      return address[el];
    }
  }
  return "";
};

const getMiddlePart = (address, order, suffixes) => {
  for (const el of order) {
    if (address[el]) {
      for (const suffix of suffixes) {
        if (address[suffix]) {
          return address[suffix];
        }
      }
    }
  }
  return "";
};

const isCountry = (location) => {
  if (location.type !== "administrative") {
    return false;
  }
  //short circuit if the address contains any information other than country and country code
  for (const key of Object.keys(location.address)) {
    if (!["country", "country_code"].includes(key)) {
      return false;
    }
  }
  return true;
};

export function isLocationValid(location) {
  if (!location || typeof location == "string") return false;
  else return true;
}

export function isExactLocation(location) {
  const placeClasses = [
    "amenity",
    "building",
    "historic",
    "tourism",
    "landuse",
    "leisure",
    "place",
    "highway",
    "office",
  ];
  return placeClasses.includes(location.class);
}

//Sometimes the Nominatim API does not return any "geojson" for points
//For these cases we reconstruct it by assuming it's a point with lat and lon as coordinates
const generateGeoJson = (location) => {
  return {
    type: "Point",
    coordinates: [parseFloat(location.lon), parseFloat(location.lat)],
  };
};

const getLocationType = (location) => {
  if (!location) return;
  if (location.added_manually) {
    return location.type;
  }
  //If Nominatim does not provice a geojson we assume the location is a Point
  if (!location.geojson) {
    return "Point";
  }
  return location.geojson.type;
};

export function parseLocation(location, isConcretePlace = false) {
  const displayLocation = isConcretePlace
    ? getDisplayLocationFromExactLocation(location)
    : getDisplayLocationFromLocation(location);
  //don't do anything if location is already parsed
  if (typeof location === "object" && alreadyParsed(location)) {
    return location;
  }

  //placeName is the name of the concrete building, e.g. "City Hall"
  let placeName: string = "";

  if (isConcretePlace && (location.address[location.class] || location.address[location.type])) {
    placeName = location.address[location.class] || location.address[location.type];
  }

  //For exact locations we also want the address in the format `<streetname> <number>`
  let exactAddress: string = "";

  if (isConcretePlace && location.address.road) {
    exactAddress =
      location.address.road +
      (location.address.house_number ? ` ${location.address.house_number}` : "");
  }
  return {
    type: getLocationType(location),
    coordinates: location?.geojson?.coordinates,
    geojson: location.geojson ? location.geojson : generateGeoJson(location),
    place_id: location?.place_id,
    osm_id: location?.osm_id,
    osm_type:
      typeof location?.osm_type === "string"
        ? location?.osm_type.charAt(0).toUpperCase()
        : undefined,
    osm_class: location?.class,
    osm_class_type: location?.type,
    display_name: location?.display_name,
    name: displayLocation.name,
    lon: location?.lon,
    lat: location?.lat,
    city: displayLocation.city,
    state: displayLocation.state,
    country: displayLocation.country,
    place_name: placeName,
    exact_address: exactAddress,
    additional_info: location?.additionalInfoText || location?.additionalInfo,
    is_exact_location: isConcretePlace,
  };
}

const props = [
  "type",
  "coordinates",
  "geojson",
  "place_id",
  "osm_id",
  "osm_type",
  "osm_class",
  "osm_class_type",
  "display_name",
  "name",
  "city",
  "state",
  "country",
  "lon",
  "lat",
  "place_name",
  "exact_address",
  "additional_info",
  "is_exact_location",
];
const alreadyParsed = (location) => {
  for (const prop of props) {
    if (!Object.keys(location).includes(prop)) {
      return false;
    }
  }
  return true;
};

export function indicateWrongLocation(
  locationInputRef,
  setLocationOptionsOpen,
  setErrorMessage,
  texts
) {
  locationInputRef.current.focus();
  setLocationOptionsOpen(true);
  setErrorMessage(texts.please_choose_one_of_the_location_options);
}

export function getLocationFields({
  locationInputRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
  values,
  locationKey,
  texts,
}) {
  return [
    {
      required: true,
      label: texts.location,
      type: "location",
      key: locationKey ? locationKey : "location",
      value: values[locationKey],
      ref: locationInputRef,
      locationOptionsOpen: locationOptionsOpen,
      handleSetLocationOptionsOpen: handleSetLocationOptionsOpen,
    },
  ];
}

export function getLocationValue(values, locationKey) {
  return values[locationKey];
}

/**
 * When filtering by location, the URL stores identifiers and not full location data.
 * We resolve it from the backend using OSM-first lookup and place_id fallback.
 * Either all three OSM identifiers (osm_id, osm_type, osm_class) OR a place_id must be
 * present for the filter to be considered active.
 */
export async function getLocationFilteredBy(query, locale?: CcLocale) {
  const osmRequired = getLocationFilterKeys(true);
  const hasOsmComposite = osmRequired.every((param) => Object.keys(query).includes(param));
  const hasPlaceId = Object.keys(query).includes("place_id");

  // Return null if neither identifier set is present — not filtering by location.
  if (!hasOsmComposite && !hasPlaceId) {
    return null;
  }
  const url = `/api/get_location/`;
  const payload = {
    place_id: query.place_id,
    osm_id: query.osm_id,
    osm_type: query.osm_type,
    osm_class: query.osm_class,
  };
  try {
    const res = await apiRequest({
      method: "post",
      url: url,
      payload: payload,
      locale: locale,
    });
    const full_location = {
      ...res.data,
      place_id: res.data?.place_id || query.place_id,
      osm_id: res.data?.osm_id || query.osm_id,
      osm_type: res.data?.osm_type || query.osm_type,
      osm_class: res.data?.osm_class || query.osm_class,
    };
    return full_location;
  } catch (e) {
    console.log(e);
  }
}

/**
 * True if `location` is a selected location object (picked from the
 * autocomplete or resolved via getLocationFilteredBy) that can be used for
 * filtering. A plain string means the user is still typing.
 */
export function isSelectedFilterLocation(location: any): boolean {
  return (
    !!location &&
    typeof location === "object" &&
    Boolean((location.osm_id && location.osm_type) || location.place_id)
  );
}

/**
 * Builds the location filter query params (same names as the browse pages):
 * osm_id, osm_type, osm_class, place_id (legacy) and radius in km without
 * the "km" suffix. Returns an empty object if no location is selected, so a
 * radius on its own never filters.
 */
export function locationToQueryParams(location: any, radius?: string): Record<string, string> {
  if (!isSelectedFilterLocation(location)) return {};
  const params: Record<string, string> = {};
  for (const key of ["osm_id", "osm_type", "osm_class", "place_id"]) {
    const value = location[key];
    if (value !== undefined && value !== null && value !== "") params[key] = String(value);
  }
  const radiusKm = radius ? String(radius).replace("km", "").trim() : "";
  if (radiusKm && radiusKm !== "0") params.radius = radiusKm;
  return params;
}

/**
 * Server-side: resolves the event calendar's location filter from the page
 * query. Returns the location object (for pre-filling the input), the radius
 * in the "25km" format used by the radius select, and the query params to
 * forward to /api/events/. Never throws: an unresolvable location yields no
 * filter so the page still renders (unfiltered).
 */
export async function getInitialEventLocationFilter(
  query: Record<string, any>,
  locale?: CcLocale
): Promise<{
  initialLocation: any;
  initialRadius: string;
  locationParams: Record<string, string>;
}> {
  const none = { initialLocation: null, initialRadius: "", locationParams: {} };
  let location: any = null;
  try {
    location = await getLocationFilteredBy(query, locale);
  } catch (e) {
    return none;
  }
  if (!isSelectedFilterLocation(location)) return none;

  const rawRadius = Array.isArray(query.radius) ? query.radius[0] : query.radius;
  const radiusKm = rawRadius ? String(rawRadius).replace("km", "").trim() : "";
  const initialRadius = /^\d+$/.test(radiusKm) && radiusKm !== "0" ? `${radiusKm}km` : "";
  return {
    initialLocation: location,
    initialRadius,
    locationParams: locationToQueryParams(location, initialRadius),
  };
}

const LOCATION_HUB_TYPE = "location hub";

/**
 * Whether a hub's event calendar shows the location filter. Hidden on
 * location hubs and on sub-hubs of location hubs: those are already
 * geographically scoped by the hub filter. `parentHub` is a fallback for
 * when `hubData.parent_hub` isn't available.
 * Spec: doc/spec/20261116_1005_event_calendar_location_filter.md (Decisions §1)
 */
export function shouldShowEventLocationFilter(hubData: any, parentHub?: any): boolean {
  const parent = hubData?.parent_hub ?? parentHub;
  return hubData?.hub_type !== LOCATION_HUB_TYPE && parent?.hub_type !== LOCATION_HUB_TYPE;
}

import _ from "lodash";
import { getLocationFilterKeys } from "../data/locationFilters";
import possibleFilters from "../data/possibleFilters";
import { getDataFromServer } from "./getDataOperations";
import { membersWithAdditionalInfo } from "./getOptions";
import { getInfoMetadataByType, getReducedPossibleFilters } from "./parsingOperations";
import { encodeQueryParamsFromFilters } from "./urlOperations";

export function getKeysOfDifferingValues({ obj, newObj, type, filterChoices, locale }) {
  const possibleFilterKeys = possibleFilters({
    key: type,
    filterChoices: filterChoices,
    locale: locale,
  }).map((f) => f.key);
  const locationKeys = getLocationFilterKeys();
  const differingKeys: string[] = [];
  for (const key of possibleFilterKeys) {
    if (key === "location" && (!newObj[key] || typeof newObj[key] === "object")) {
      let isLocationEqual = true;
      //if there are no location keys in either object we still check whether the user selected a location
      //If a user selects a location from the options it changes from a string to an obj
      if (typeof obj?.location === "string" && typeof newObj?.location === "object") {
        isLocationEqual = false;
      } else {
        //Otherwise we'll have to check for each key from the url whether it has changed.
        for (const locKey of locationKeys) {
          if (!_.isEqual(newObj[locKey], obj[locKey])) {
            isLocationEqual = false;
          }
        }
        //If no location was selected before and after the change but the radius changed:
        //Pretend the location didn't change because a radius filter without a selected location does nothing
        if (
          _.isEqual(
            locationKeys.filter((k) => newObj[k]?.length > 0 && obj[k]?.length > 0),
            ["radius"]
          )
        ) {
          isLocationEqual = true;
        }
      }
      if (!isLocationEqual) {
        differingKeys.push("location");
      }
    } else if (!_.isEqual(newObj[key], obj[key])) {
      differingKeys.push(key);
    }
  }
  return differingKeys;
}

export function hasDifferingValues({ obj, newObj, type, filterChoices, locale }) {
  return (
    getKeysOfDifferingValues({
      obj: obj,
      newObj: newObj,
      type: type,
      filterChoices: filterChoices,
      locale: locale,
    }).length > 0
  );
}

export function getInitialFilters({ filterChoices, locale, initialLocationFilter }) {
  return {
    ...getReducedPossibleFilters(
      possibleFilters({ key: "all", filterChoices: filterChoices, locale: locale }),
      initialLocationFilter
    ),
    search: "",
  };
}

//Splits a query array from a url into filters and non-fitlers
export function splitFiltersFromQueryObject(queryObject, possibleFilters): any {
  if (!queryObject) return { filters: {}, nonFilters: {} };
  const possibleFilterKeys = possibleFilters.map((f) => f.key);
  const filters = Object.keys(queryObject).reduce((obj, curKey) => {
    if (possibleFilterKeys.includes(curKey)) {
      obj[curKey] = queryObject[curKey];
    }
    return obj;
  }, {});
  const restOfQueryObject = Object.keys(queryObject).reduce((obj, curKey) => {
    if (!possibleFilterKeys.includes(curKey)) {
      obj[curKey] = queryObject[curKey];
    }
    return obj;
  }, {});
  return { filters: filters, nonFilters: restOfQueryObject };
}

/**
 * Fetches data from the server based on the newly provided
 * filters. Returns an object with the new filter data, as well
 * as other options.
 *
 * @param {string} type one of ["projects", "organizations", "members", "ideas"]
 * @param {Object} filters the old filters: something like {"location": "", etc... } // TODO: create type definition for filters
 * @param {Object} newFilters the new filters after a change happened
 * @param {boolean} closeFilters
 * @param {Object} filterChoices the choices for select and multiselect filters
 * @param {string} locale the user's language, e.g. "en" or "de"
 * @param {string} token the user's login token to authenticate with the backend
 * @param {function} handleAddFilters a function that allows adding additional filters to the current ones
 * @param {function} handleSetErrorMessage function to display an error message
 * @param {string} hubUrl is set if only results from a certain hub should be displayed
 */
export async function applyNewFilters({
  type,
  filters,
  newFilters,
  closeFilters,
  filterChoices,
  locale,
  token,
  handleAddFilters,
  handleSetErrorMessage,
  hubUrl,
}: any) {
  if (
    !hasDifferingValues({
      obj: filters,
      newObj: newFilters,
      type: type,
      filterChoices: filterChoices,
      locale: locale,
    })
  ) {
    return null;
  }
  handleAddFilters(newFilters);
  const newUrlEnding = encodeQueryParamsFromFilters({
    filters: newFilters,
    infoMetadata: getInfoMetadataByType(type, locale),
    filterChoices: filterChoices,
    locale: locale,
  });
  handleSetErrorMessage(null);

  try {
    // Only treat a location as "active" when it is a non-empty object or a
    // non-empty string. An empty string (e.g. after clearing the location
    // filter) must be treated as "no location" so the request falls back to
    // GET instead of a POST with an empty body.
    const rawLocation = newFilters.location;
    const hasLocation =
      !!rawLocation &&
      (typeof rawLocation !== "string" || rawLocation.trim() !== "") &&
      (typeof rawLocation !== "object" || Object.keys(rawLocation).length > 0);
    const payload: any = {
      type: type,
      page: 1,
      token: token,
      urlEnding: newUrlEnding,
      location: hasLocation ? rawLocation : undefined,
      locale: locale,
    };

    if (hubUrl) {
      payload.hubUrl = hubUrl;
    }
    const filteredItemsObject: any = await getDataFromServer(payload);

    if (type === "members") {
      filteredItemsObject.members = membersWithAdditionalInfo(filteredItemsObject.members);
    }

    return {
      closeFilters: closeFilters,
      filteredItemsObject: filteredItemsObject,
      newUrlEnding: newUrlEnding,
    };
  } catch (e) {
    console.log(e);
    // TODO: in the future, throw the error
    // but make sure that the calling component catches
    /// the error and gives feedback to the user
    // throw e;
  }
  return null;
}

export function getActiveFilterCount(
  filters: Record<string, any>,
  possibleFiltersList: any[]
): number {
  let count = 0;
  for (const pf of possibleFiltersList) {
    if (pf.key === "search") continue;
    const value = filters[pf.key];
    if (pf.type === "location") {
      if (typeof value === "object" && value !== null && Object.keys(value).length > 0) {
        count++;
      }
    } else if (Array.isArray(value) && value.length > 0) {
      count++;
    } else if (typeof value === "string" && value.trim() !== "") {
      count++;
    }
  }
  if (filters.radius && typeof filters.radius === "string" && filters.radius.trim() !== "") {
    const hasLocation = typeof filters.location === "object" && filters.location !== null;
    if (!hasLocation) count++;
  }
  return count;
}

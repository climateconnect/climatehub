import { useCallback, useRef } from "react";
import _ from "lodash";
import getFilters from "../../public/data/possibleFilters";
import { splitFiltersFromQueryObject } from "../../public/lib/filterOperations";
import { findOptionByNameDeep, getSearchParams } from "../../public/lib/urlOperations";

function getValueInCurrentLanguage(metadata: any, value: string, _filterChoices: any) {
  return findOptionByNameDeep({
    filterChoices: metadata.options,
    propertyToFilterBy: "original_name",
    valueToFilterBy: value,
  })?.name;
}

function getQueryObjectFromUrl(query: any, filterChoices: any, locale: any) {
  const queryObject = _.cloneDeep(query);
  const possibleFiltersMetadata = getFilters({
    key: "all",
    filterChoices: filterChoices,
    locale: locale,
  });
  const splitQueryObject = splitFiltersFromQueryObject(queryObject, possibleFiltersMetadata);
  for (const [key, value] of Object.entries(splitQueryObject.filters) as any) {
    const metadata = possibleFiltersMetadata.find((f: any) => f.key === key);
    if (value.indexOf(",") > 0) {
      queryObject[key] = value
        .split(",")
        .map((v: string) => getValueInCurrentLanguage(metadata, v, filterChoices));
    } else if (
      metadata?.type === "multiselect" ||
      metadata?.type === "openMultiSelectDialogButton"
    ) {
      queryObject[key] = [getValueInCurrentLanguage(metadata, value, filterChoices)];
    } else if (key === "radius") {
      queryObject[key] = value + "km";
    }
  }
  return queryObject;
}

export function useBrowseUrlSync(filterChoices: any, locale: any) {
  const initializedRef = useRef(false);

  const initializeFromUrl = useCallback(
    (type: string, initialLocationFilter?: any, showFeedbackMessage?: (_msg: any) => void) => {
      if (initializedRef.current) return null;
      initializedRef.current = true;

      const possibleFilters = getFilters({
        key: type,
        filterChoices: filterChoices,
        locale: locale,
      });
      const queryObject = getQueryObjectFromUrl(
        getSearchParams(window.location.search),
        filterChoices,
        locale
      );
      const splitQueryObject = splitFiltersFromQueryObject(queryObject, possibleFilters);
      const newFilters: any = { ...splitQueryObject.filters };

      if (splitQueryObject?.nonFilters?.message && showFeedbackMessage) {
        showFeedbackMessage({ message: splitQueryObject.nonFilters.message });
      }

      if (initialLocationFilter) {
        const locationFilter: any = possibleFilters.find((f: any) => f.type === "location");
        if (locationFilter) {
          newFilters[locationFilter.key] = initialLocationFilter;
        }
      }

      return {
        newFilters,
        nonFilterParams: splitQueryObject.nonFilters,
      };
    },
    [filterChoices, locale]
  );

  const reset = useCallback(() => {
    initializedRef.current = false;
  }, []);

  return { initializeFromUrl, reset };
}

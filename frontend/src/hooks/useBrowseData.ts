import { useState, useContext, useCallback, useRef, useMemo } from "react";
import Cookies from "universal-cookie";
import { loadMoreData } from "../../public/lib/getDataOperations";
import { getFilterUrl } from "../../public/lib/urlOperations";
import { getInfoMetadataByType } from "../../public/lib/parsingOperations";
import { isLocationValid, indicateWrongLocation } from "../../public/lib/locationOperations";
import { FilterContext } from "../components/context/FilterContext";
import UserContext from "../components/context/UserContext";
import getTexts from "../../public/texts/texts";

export function useBrowseData(type: string) {
  const token = new Cookies().get("auth_token");
  const { locale } = useContext(UserContext);
  const {
    filters,
    handleUpdateFilterValues,
    handleSetErrorMessage,
    handleApplyNewFilters: applyNewFilters,
  } = useContext(FilterContext);

  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState(2);
  const [urlEnding, setUrlEnding] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [isFetchingMoreData, setIsFetchingMoreData] = useState(false);
  const isFetchingMoreDataRef = useRef(false);
  const [nonFilterParams, setNonFilterParams] = useState<any>({});

  const locationInputRef = useRef<any>(null);
  const [locationOptionsOpen, setLocationOptionsOpen] = useState(false);

  const texts = useMemo(() => getTexts({ page: "hub", locale }), [locale]);

  const handleApplyNewFilters = useCallback(
    async ({
      newFilters,
      closeFilters,
      filterChoices,
      hubUrl: _hubUrl,
      initialLocationFilter: _initialLocationFilter,
    }) => {
      const newUrl = getFilterUrl({
        activeFilters: newFilters,
        infoMetadata: getInfoMetadataByType(type),
        filterChoices: filterChoices,
        locale: locale,
        nonFilterParams: nonFilterParams,
      });
      if (newUrl !== window?.location?.href) {
        window.history.pushState({}, "", newUrl);
      }

      if (newFilters.location && !isLocationValid(newFilters.location)) {
        indicateWrongLocation(
          locationInputRef,
          setLocationOptionsOpen,
          handleSetErrorMessage,
          texts
        );
        return null;
      }

      handleSetErrorMessage("");
      setIsFiltering(true);
      const res = await applyNewFilters({
        type: type,
        newFilters: newFilters,
        closeFilters: closeFilters,
      });
      if (res?.filteredItemsObject) {
        setItems(res.filteredItemsObject[type] || []);
        setHasMore(res.filteredItemsObject.hasMore);
        setUrlEnding(res.newUrlEnding);
        setNextPage(2);
      }
      setIsFiltering(false);
      return res;
    },
    [type, locale, nonFilterParams, applyNewFilters, handleSetErrorMessage, texts]
  );

  const handleSearchSubmit = useCallback(
    async ({ searchValue, filterChoices, hubUrl: _hubUrl }) => {
      setIsFiltering(true);
      const newFilters = { ...filters, search: searchValue };
      const newUrl = getFilterUrl({
        activeFilters: newFilters,
        infoMetadata: getInfoMetadataByType(type),
        filterChoices: filterChoices,
        locale: locale,
        nonFilterParams: nonFilterParams,
      });

      const res = await applyNewFilters({
        type: type,
        newFilters: newFilters,
        closeFilters: false,
      });
      setIsFiltering(false);
      if (newUrl !== window?.location?.href) {
        window.history.pushState({}, "", newUrl);
      }

      if (res?.filteredItemsObject) {
        setItems(res.filteredItemsObject[type] || []);
        setHasMore(res.filteredItemsObject.hasMore);
        setUrlEnding(res.newUrlEnding);
        setNextPage(2);
      }
    },
    [type, filters, locale, nonFilterParams, applyNewFilters]
  );

  const handleLoadMoreData = useCallback(
    async (hubUrl?: string) => {
      if (isFetchingMoreDataRef.current) return;
      try {
        isFetchingMoreDataRef.current = true;
        setIsFetchingMoreData(true);
        const res = await loadMoreData({
          type: type,
          page: nextPage,
          urlEnding: urlEnding,
          token: token,
          locale: locale,
          hubUrl: hubUrl,
        });
        setItems((prev) => [...prev, ...res.newData]);
        setHasMore(res.hasMore);
        setNextPage((prev) => prev + 1);
      } catch (e) {
        setHasMore(false);
      } finally {
        isFetchingMoreDataRef.current = false;
        setIsFetchingMoreData(false);
      }
    },
    [type, nextPage, urlEnding, token, locale]
  );

  const setInitialItems = useCallback((initialData: any[] | undefined) => {
    if (initialData) {
      setItems(initialData);
    }
  }, []);

  return {
    items,
    hasMore,
    isFiltering,
    isFetchingMoreData,
    filters,
    nonFilterParams,
    locationInputRef,
    locationOptionsOpen,
    setLocationOptionsOpen,
    handleApplyNewFilters,
    handleSearchSubmit,
    handleLoadMoreData,
    handleUpdateFilterValues,
    handleSetErrorMessage,
    setNonFilterParams,
    setInitialItems,
    setIsFiltering,
  };
}

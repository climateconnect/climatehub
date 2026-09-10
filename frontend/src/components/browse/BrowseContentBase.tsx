import React, { Suspense, lazy, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Container, Theme, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import getFilters from "../../../public/data/possibleFilters";
import { getActiveFilterCount } from "../../../public/lib/filterOperations";
import { FilterContext } from "../context/FilterContext";
import FeedbackContext from "../context/FeedbackContext";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";
import LoadingSpinner from "../general/LoadingSpinner";
import NoItemsFound from "./NoItemsFound";
import FilterContent from "../filter/FilterContent";
import { useBrowseData } from "../../hooks/useBrowseData";
import { useBrowseUrlSync } from "../../hooks/useBrowseUrlSync";
import { BrowseEntity } from "../../types";

const FilterSection = lazy(() => import("../indexPage/FilterSection"));

const useStyles = makeStyles((theme) => ({
  // The container provides 24px horizontal padding on each side and a
  // sensible max-width (1200px on `lg`). When nested inside another
  // width-constrained Container (e.g. `HubPageLayout`), MUI's Container
  // still applies its own padding — so the parent Container must not
  // also add horizontal padding, or we'd get double padding. See
  // `HubPageLayout` for the matching `disableGutters` on its outer
  // Container.
  contentContainer: {
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: theme.spacing(4),
    position: "relative",
    [theme.breakpoints.down("md")]: {
      paddingTop: theme.spacing(2),
    },
  },
  tabContent: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    paddingLeft: theme.spacing(1),
  },
}));

type Props = {
  type: BrowseEntity;
  filterChoices: any;
  initialLocationFilter?: any;
  customSearchBarLabels?: any;
  /**
   * Optional content rendered between the filter and the preview grid
   * (e.g. the upcoming-events band on the projects page). The caller
   * is responsible for any state updates this content needs (e.g.
   * recomputing on filter changes); `BrowseContentBase` simply renders
   * whatever React node is passed in.
   */
  belowFilterContent?: ReactNode;
  /**
   * Renders the entity-specific preview grid once data is available.
   * Receives the current items, filters, pagination handlers, and the
   * hub URL. The `filters` are passed in case the renderer needs them
   * (e.g. the projects page filters out events from the main grid).
   */
  renderItems: (_args: {
    items: any[];
    filters: any;
    hasMore: boolean;
    isFetchingMoreData: boolean;
    handleLoadMoreData: (_hubUrl?: string) => Promise<void>;
    hubUrl: string;
  }) => ReactNode;
};

/**
 * Shared body for the three browse content components. Handles the data
 * fetching, URL sync, filter UI, and loading/empty states. The per-type
 * component provides the entity type, the preview renderer, and an optional
 * `topContent` slot (used for the upcoming-events band on the projects page).
 */
export default function BrowseContentBase({
  type,
  filterChoices,
  initialLocationFilter,
  customSearchBarLabels,
  belowFilterContent,
  renderItems,
}: Props) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);
  const { showFeedbackMessage } = useContext(FeedbackContext);
  const { handleUpdateFilterValues } = useContext(FilterContext);
  const {
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
    setNonFilterParams,
  } = useBrowseData(type);

  const { initializeFromUrl } = useBrowseUrlSync(filterChoices, locale);

  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [filtersExpandedOnMobile, setFiltersExpandedOnMobile] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const childrenRenderedRef = useRef(false);

  const isSmallScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));

  useEffect(() => {
    if (!initialized) {
      const result = initializeFromUrl(type, initialLocationFilter, showFeedbackMessage);
      if (result) {
        setNonFilterParams(result.nonFilterParams);
        handleApplyNewFilters({
          newFilters: result.newFilters,
          closeFilters: false,
          filterChoices,
          hubUrl,
          initialLocationFilter,
        });
      }
      setInitialized(true);
    }
  }, [initialized]);

  const possibleFilters = getFilters({ key: type, filterChoices, locale });
  const activeFilterCount = getActiveFilterCount(filters, possibleFilters);

  const hasItems = items.length > 0;
  if (hasItems) childrenRenderedRef.current = true;
  const showChildren = hasItems || (isFiltering && childrenRenderedRef.current);
  const shouldShowNoItems = !isFiltering && !hasItems;

  const unexpandFilters = () => setFiltersExpanded(false);
  const unexpandFiltersOnMobile = () => setFiltersExpandedOnMobile(false);

  return (
    <Container maxWidth="lg" className={classes.contentContainer}>
      {isSmallScreen && (
        <Suspense fallback={null}>
          <FilterSection
            activeFilterCount={activeFilterCount}
            filtersExpanded={filtersExpandedOnMobile}
            onSubmit={(searchType, value) =>
              handleSearchSubmit({ searchValue: value, filterChoices, hubUrl })
            }
            setFiltersExpanded={isSmallScreen ? setFiltersExpandedOnMobile : setFiltersExpanded}
            type={type}
            customSearchBarLabels={customSearchBarLabels}
          />
        </Suspense>
      )}
      {filtersExpanded && (
        <FilterContent
          className={classes.tabContent}
          type={type}
          applyFilters={async ({
            type: _type,
            newFilters,
            closeFilters,
            nonFilterParams: _nfp,
          }) => {
            // The data hook owns the network round-trip; this layer owns the
            // UI state (whether the filter overlay is open). `closeFilters:
            // true` means the caller wants the overlay closed on success —
            // we used to do this in the old `BrowseContent` based on
            // `res?.closeFilters`. Without this the mobile filter stays
            // open after the user clicks Apply.
            const res = await handleApplyNewFilters({
              newFilters,
              closeFilters,
              filterChoices,
              hubUrl,
              initialLocationFilter,
            });
            if (res?.closeFilters) {
              if (isSmallScreen) unexpandFiltersOnMobile();
              else unexpandFilters();
            }
            return res;
          }}
          handleUpdateFilters={handleUpdateFilterValues}
          errorMessage=""
          filtersExpanded={isSmallScreen ? filtersExpandedOnMobile : filtersExpanded}
          handleSetLocationOptionsOpen={setLocationOptionsOpen}
          locationInputRef={locationInputRef}
          locationOptionsOpen={locationOptionsOpen}
          possibleFilters={possibleFilters}
          unexpandFilters={isSmallScreen ? unexpandFiltersOnMobile : unexpandFilters}
          initialLocationFilter={initialLocationFilter}
          nonFilterParams={nonFilterParams}
          searchSubmit={(searchType, value) =>
            handleSearchSubmit({ searchValue: value, filterChoices, hubUrl })
          }
        />
      )}
      {belowFilterContent}
      {isFiltering && !childrenRenderedRef.current && <LoadingSpinner isLoading />}
      <div style={{ opacity: isFiltering && showChildren ? 0.5 : 1, transition: "opacity 150ms" }}>
        {showChildren && (
          <Suspense fallback={null}>
            {renderItems({
              items,
              filters,
              hasMore,
              isFetchingMoreData,
              handleLoadMoreData,
              hubUrl,
            })}
          </Suspense>
        )}
      </div>
      {shouldShowNoItems && <NoItemsFound type={type} hubName="" />}
    </Container>
  );
}

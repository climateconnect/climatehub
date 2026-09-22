import React, { ReactNode, useState } from "react";
import { FilterContext } from "../context/FilterContext";
import { applyNewFilters, getInitialFilters } from "../../../public/lib/filterOperations";

// For the initial construction, filters use information provided in the pages/browse.tsx and the pages/[hubUrl].tsx
// But the filters it self are used in a multiple deeply nested components (e.g. FilterSearchBar, FilterTabs and BrowseContent)
// In order to simplify code and avoid prop drilling, we use a context to provide the filters to all components that need it

// See: https://react.dev/learn/passing-data-deeply-with-context

// FUTURE WORK:
// As BrowseContent.tsx is observing the filtered Data, one might continue to refactor the code so that
// the filters use a Reducer pattern in combination with.
// This way handleAddFilters, handleChangeFilter etc. can be dispatched to the reducer and the content will be updated automatically
// Additionally, all the logic will be placed inside this file, making the other components more readable

export function FilterProvider({
  children,
  initialLocationFilter,
  filterChoices,
  locale,
  token,
  hubUrl,
}: {
  children: ReactNode;
  initialLocationFilter: any;
  filterChoices: any;
  locale: any;
  token: any;
  hubUrl?: any;
}) {
  // State

  // Initialize filters. We use one set of filters for all tabs (projects, organizations, members)
  const [filters, setFilters] = useState(
    getInitialFilters({
      filterChoices,
      locale,
      initialLocationFilter,
    })
  );
  const [errorMessage, setErrorMessage] = useState("");

  // Handlers
  const handleSetErrorMessage = (newMessage) => {
    setErrorMessage(newMessage);
  };

  const handleAddFilters = (newFilters) => {
    setFilters({ ...filters, ...newFilters });
  };

  const handleUpdateFilterValues = (valuesToUpdate) => {
    setFilters({ ...filters, ...valuesToUpdate });
  };

  const handleApplyNewFilters = async ({ type, newFilters, closeFilters }) => {
    return await applyNewFilters({
      type,
      filters,
      newFilters,
      closeFilters,
      filterChoices,
      locale,
      token,
      handleAddFilters,
      handleSetErrorMessage,
      hubUrl: hubUrl ?? undefined,
    });
  };

  return (
    <FilterContext.Provider
      value={{
        filters,
        errorMessage,
        handleSetErrorMessage,
        handleAddFilters,
        handleApplyNewFilters,
        handleUpdateFilterValues,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

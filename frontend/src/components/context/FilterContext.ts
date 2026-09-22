import { createContext } from "react";

interface FilterContextType {
  filters: any;
  errorMessage: string;
  /* eslint-disable no-unused-vars */
  handleSetErrorMessage: (newMessage: any) => void;
  handleAddFilters: (newFilters: any) => void;
  /* eslint-disable no-unused-vars */
  handleApplyNewFilters: ({
    type,
    newFilters,
    closeFilters,
  }: {
    type: any;
    newFilters: any;
    closeFilters: any;
  }) => Promise<{
    closeFilters: any;
    filteredItemsObject: any;
    newUrlEnding: string;
  } | null>;
  // eslint-disable-next-line no-unused-vars
  handleUpdateFilterValues: (valuesToUpdate: any) => void;
}

export const FilterContext = createContext<FilterContextType>(null!);

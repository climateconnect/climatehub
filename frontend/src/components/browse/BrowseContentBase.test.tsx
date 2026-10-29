import React, { createElement, createContext } from "react";
import { render, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import BrowseContentBase from "./BrowseContentBase";

const testTheme = createTheme({
  spacing: (factor: number) => `${8 * factor}px`,
});

// Mock the heavy context providers that BrowseContentBase reads.
jest.mock("../context/UserContext", () => {
  return {
    __esModule: true,
    default: createContext({
      locale: "en",
    }),
  };
});
jest.mock("../context/HubContext", () => {
  return { __esModule: true, HubContext: createContext({ hubUrl: "" }) };
});
jest.mock("../context/FeedbackContext", () => {
  return { __esModule: true, default: createContext({ showFeedbackMessage: () => {} }) };
});
jest.mock("../context/FilterContext", () => {
  return {
    __esModule: true,
    FilterContext: createContext({
      handleUpdateFilterValues: () => {},
      handleSetErrorMessage: () => {},
      filters: {},
      setFiltersExpanded: () => {},
      handleApplyNewFilters: async ({ closeFilters }: { closeFilters: boolean }) => ({
        closeFilters,
        filteredItemsObject: {},
      }),
    }),
  };
});

const applyFiltersMock = jest.fn(async () => ({ closeFilters: true, filteredItemsObject: {} }));

jest.mock("../../../public/data/possibleFilters", () => ({
  __esModule: true,
  default: () => [],
}));

jest.mock("../filter/FilterContent", () => {
  return {
    __esModule: true,
    default: function FilterContentMock({ applyFilters, filtersExpanded, unexpandFilters }: any) {
      // Render only when expanded. Expose the applyFilters callback via a
      // button so the test can trigger it.
      if (!filtersExpanded) return null;
      return createElement(
        "div",
        { "data-testid": "filter-content" },
        createElement(
          "button",
          {
            "data-testid": "trigger-apply",
            onClick: () =>
              applyFilters({
                type: "projects",
                newFilters: {},
                closeFilters: true,
                nonFilterParams: {},
              }),
          },
          "Apply (close)"
        ),
        createElement(
          "button",
          {
            "data-testid": "trigger-apply-no-close",
            onClick: () =>
              applyFilters({
                type: "projects",
                newFilters: {},
                closeFilters: false,
                nonFilterParams: {},
              }),
          },
          "Apply (no close)"
        ),
        createElement(
          "button",
          {
            "data-testid": "trigger-unexpand",
            onClick: unexpandFilters,
          },
          "Close"
        )
      );
    },
  };
});

function renderBase() {
  return render(
    <ThemeProvider theme={testTheme}>
      <BrowseContentBase
        type="projects"
        filterChoices={{}}
        renderItems={() => <div data-testid="items" />}
      />
    </ThemeProvider>
  );
}

describe("BrowseContentBase filter close behavior", () => {
  beforeEach(() => {
    applyFiltersMock.mockClear();
  });

  it("closes the filter after apply when closeFilters: true is requested", async () => {
    applyFiltersMock.mockResolvedValue({ closeFilters: true, filteredItemsObject: {} });
    const { getByTestId, queryByTestId } = renderBase();
    // The filter starts open (filtersExpanded default is true on desktop).
    expect(getByTestId("filter-content")).toBeTruthy();

    await act(async () => {
      fireEvent.click(getByTestId("trigger-apply"));
    });

    // The filter should be closed after the apply returns closeFilters: true.
    expect(queryByTestId("filter-content")).toBeNull();
  });

  it("does NOT close the filter when closeFilters is false on the request", async () => {
    applyFiltersMock.mockResolvedValue({ closeFilters: false, filteredItemsObject: {} });
    const { getByTestId, queryByTestId } = renderBase();
    expect(getByTestId("filter-content")).toBeTruthy();

    await act(async () => {
      fireEvent.click(getByTestId("trigger-apply-no-close"));
    });

    // The filter stays open because the request didn't ask to close.
    expect(queryByTestId("filter-content")).toBeTruthy();
  });
});

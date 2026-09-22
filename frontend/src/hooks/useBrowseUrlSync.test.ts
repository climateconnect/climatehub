import { renderHook } from "@testing-library/react";
import { useBrowseUrlSync } from "./useBrowseUrlSync";

jest.mock("next/router", () => ({
  useRouter: () => ({ query: {}, locale: "en" }),
}));

const mockGetSearchParams = jest.fn().mockReturnValue({});
jest.mock("../../public/lib/urlOperations", () => ({
  findOptionByNameDeep: ({ filterChoices, propertyToFilterBy, valueToFilterBy }: any) => {
    return filterChoices?.reduce((result: any, fc: any) => {
      if (fc[propertyToFilterBy] === valueToFilterBy) return fc;
      const sub = fc?.subcategories?.find((s: any) => s[propertyToFilterBy] === valueToFilterBy);
      if (sub) return sub;
      return result;
    }, null);
  },
  getSearchParams: (s: string) => mockGetSearchParams(s),
}));

jest.mock("../../public/data/possibleFilters", () => ({
  __esModule: true,
  default: ({ key }: any) => {
    const allFilters: Record<string, any[]> = {
      projects: [
        { key: "search", type: "search" },
        { key: "location", type: "location" },
        {
          key: "sectors",
          type: "multiselect",
          options: [
            { name: "Energy", original_name: "Energy" },
            { name: "Transport", original_name: "Transport" },
          ],
        },
      ],
      organizations: [
        { key: "search", type: "search" },
        { key: "location", type: "location" },
        {
          key: "organization_type",
          type: "multiselect",
          options: [{ name: "NGO", original_name: "NGO" }],
        },
      ],
      members: [
        { key: "search", type: "search" },
        { key: "location", type: "location" },
        {
          key: "skills",
          type: "openMultiSelectDialogButton",
          options: [{ name: "Python", original_name: "Python" }],
        },
      ],
      all: [
        { key: "search", type: "search" },
        { key: "location", type: "location" },
        {
          key: "sectors",
          type: "multiselect",
          options: [
            { name: "Energy", original_name: "Energy" },
            { name: "Transport", original_name: "Transport" },
          ],
        },
        {
          key: "organization_type",
          type: "multiselect",
          options: [{ name: "NGO", original_name: "NGO" }],
        },
        {
          key: "skills",
          type: "openMultiSelectDialogButton",
          options: [{ name: "Python", original_name: "Python" }],
        },
      ],
    };
    return allFilters[key] || [];
  },
}));

describe("useBrowseUrlSync", () => {
  const filterChoices = {
    sectors: [
      { name: "Energy", original_name: "Energy" },
      { name: "Transport", original_name: "Transport" },
    ],
    organization_types: [{ name: "NGO", original_name: "NGO" }],
    skills: [{ name: "Python", original_name: "Python" }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSearchParams.mockReturnValue({});
  });

  it("returns null on second call (initialized guard)", () => {
    const { result } = renderHook(() => useBrowseUrlSync(filterChoices, "en"));
    const first = result.current.initializeFromUrl("projects");
    expect(first).not.toBeNull();
    const second = result.current.initializeFromUrl("projects");
    expect(second).toBeNull();
  });

  it("returns empty filters when no URL params", () => {
    const { result } = renderHook(() => useBrowseUrlSync(filterChoices, "en"));
    const init = result.current.initializeFromUrl("projects");
    expect(init).not.toBeNull();
    expect(init!.newFilters).toBeDefined();
    expect(init!.nonFilterParams).toBeDefined();
  });

  it("parses search param from URL", () => {
    mockGetSearchParams.mockReturnValue({ search: "solar" });
    const { result } = renderHook(() => useBrowseUrlSync(filterChoices, "en"));
    const init = result.current.initializeFromUrl("projects");
    expect(init).not.toBeNull();
    expect(init!.newFilters.search).toBe("solar");
  });

  it("sets initialLocationFilter when provided", () => {
    const locationFilter = { place_id: "123", osm_id: "456", osm_type: "N", osm_class: "place" };
    const { result } = renderHook(() => useBrowseUrlSync(filterChoices, "en"));
    const init = result.current.initializeFromUrl("projects", locationFilter);
    expect(init).not.toBeNull();
    expect(init!.newFilters.location).toEqual(locationFilter);
  });

  it("reset allows re-initialization", () => {
    const { result } = renderHook(() => useBrowseUrlSync(filterChoices, "en"));
    result.current.initializeFromUrl("projects");
    expect(result.current.initializeFromUrl("projects")).toBeNull();
    result.current.reset();
    expect(result.current.initializeFromUrl("projects")).not.toBeNull();
  });

  it("splits comma-separated multiselect values", () => {
    mockGetSearchParams.mockReturnValue({ sectors: "Energy,Transport" });
    const { result } = renderHook(() => useBrowseUrlSync(filterChoices, "en"));
    const init = result.current.initializeFromUrl("projects");
    expect(init).not.toBeNull();
    expect(init!.newFilters.sectors).toEqual(["Energy", "Transport"]);
  });

  it("calls showFeedbackMessage when message param present", () => {
    mockGetSearchParams.mockReturnValue({ message: "hello" });
    const showFeedback = jest.fn();
    const { result } = renderHook(() => useBrowseUrlSync(filterChoices, "en"));
    result.current.initializeFromUrl("projects", undefined, showFeedback);
    expect(showFeedback).toHaveBeenCalledWith({ message: "hello" });
  });
});

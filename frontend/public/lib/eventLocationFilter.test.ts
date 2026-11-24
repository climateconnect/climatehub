/**
 * Helpers for the event calendar location filter.
 * Spec: doc/spec/20261116_1005_event_calendar_location_filter.md
 */
const mockApiRequest = jest.fn();
jest.mock("./apiOperations", () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

import {
  getInitialEventLocationFilter,
  isSelectedFilterLocation,
  locationToQueryParams,
  shouldShowEventLocationFilter,
} from "./locationOperations";

const ERLANGEN = { osm_id: 1001, osm_type: "relation", osm_class: "boundary", name: "Erlangen" };

describe("isSelectedFilterLocation", () => {
  it("accepts location objects with an OSM id/type or place_id", () => {
    expect(isSelectedFilterLocation(ERLANGEN)).toBe(true);
    expect(isSelectedFilterLocation({ place_id: 5 })).toBe(true);
  });

  it("rejects typed text and empty values", () => {
    expect(isSelectedFilterLocation("Erl")).toBe(false);
    expect(isSelectedFilterLocation("")).toBe(false);
    expect(isSelectedFilterLocation(null)).toBe(false);
    expect(isSelectedFilterLocation({ name: "x" })).toBe(false);
  });
});

describe("locationToQueryParams", () => {
  it("builds browse-compatible params and strips km from the radius", () => {
    expect(locationToQueryParams(ERLANGEN, "25km")).toEqual({
      osm_id: "1001",
      osm_type: "relation",
      osm_class: "boundary",
      radius: "25",
    });
  });

  it("omits an empty radius", () => {
    expect(locationToQueryParams(ERLANGEN, "")).not.toHaveProperty("radius");
  });

  it("returns nothing for a radius without a location", () => {
    expect(locationToQueryParams(null, "25km")).toEqual({});
    expect(locationToQueryParams("Erl", "25km")).toEqual({});
  });
});

describe("getInitialEventLocationFilter", () => {
  beforeEach(() => mockApiRequest.mockReset());

  it("returns no filter when the query has no location", async () => {
    const result = await getInitialEventLocationFilter({ search: "x" }, "en");
    expect(result).toEqual({ initialLocation: null, initialRadius: "", locationParams: {} });
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("resolves the location and radius", async () => {
    mockApiRequest.mockResolvedValue({ data: ERLANGEN });
    const result = await getInitialEventLocationFilter(
      { osm_id: "1001", osm_type: "relation", osm_class: "boundary", radius: "25" },
      "en"
    );
    expect(result.initialLocation).toMatchObject({ name: "Erlangen" });
    expect(result.initialRadius).toBe("25km");
    expect(result.locationParams).toMatchObject({ osm_id: "1001", radius: "25" });
  });

  it("ignores an invalid radius", async () => {
    mockApiRequest.mockResolvedValue({ data: ERLANGEN });
    const result = await getInitialEventLocationFilter(
      { osm_id: "1001", osm_type: "relation", osm_class: "boundary", radius: "abc" },
      "en"
    );
    expect(result.initialRadius).toBe("");
    expect(result.locationParams).not.toHaveProperty("radius");
  });

  it("falls back to no filter when the lookup fails", async () => {
    mockApiRequest.mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "log").mockImplementation(() => {});
    const result = await getInitialEventLocationFilter(
      { osm_id: "999", osm_type: "relation", osm_class: "x" },
      "en"
    );
    expect(result).toEqual({ initialLocation: null, initialRadius: "", locationParams: {} });
  });
});

describe("shouldShowEventLocationFilter", () => {
  it("hides on location hubs", () => {
    expect(shouldShowEventLocationFilter({ hub_type: "location hub" })).toBe(false);
  });

  it("hides on sub-hubs of location hubs", () => {
    expect(
      shouldShowEventLocationFilter({
        hub_type: "custom hub",
        parent_hub: { hub_type: "location hub" },
      })
    ).toBe(false);
    expect(
      shouldShowEventLocationFilter({ hub_type: "sector hub" }, { hub_type: "location hub" })
    ).toBe(false);
  });

  it("shows on custom and sector hubs", () => {
    expect(shouldShowEventLocationFilter({ hub_type: "custom hub" })).toBe(true);
    expect(shouldShowEventLocationFilter({ hub_type: "sector hub" })).toBe(true);
    expect(
      shouldShowEventLocationFilter({
        hub_type: "custom hub",
        parent_hub: { hub_type: "custom hub" },
      })
    ).toBe(true);
  });
});

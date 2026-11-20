/**
 * Location filter behaviour of the event calendar.
 * Spec: doc/spec/20261116_1005_event_calendar_location_filter.md
 */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import EventCalendarContent from "./EventCalendarContent";

const ERLANGEN = {
  name: "Erlangen",
  simple_name: "Erlangen",
  osm_id: 1001,
  osm_type: "relation",
  osm_class: "boundary",
  place_id: 555,
};

let mockIsNarrowScreen = false;
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  useMediaQuery: () => mockIsNarrowScreen,
}));

jest.mock("universal-cookie", () => {
  return jest.fn(() => ({ get: jest.fn(() => "test-token") }));
});

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

jest.mock("../featureToggle/FeatureToggleProvider", () => ({
  useFeatureToggles: () => ({ isEnabled: () => true, isLoading: false }),
}));

// Stub the autocomplete: a text input + a button that "selects" Erlangen.
jest.mock("../search/LocationSearchBar", () => ({
  __esModule: true,
  // `label` is an icon + text element on browse/calendar, so use a fixed name.
  default: ({ value, onChange, onSelect, endAdornment }: any) => (
    <div>
      <input
        aria-label="Location"
        value={typeof value === "object" && value ? value.simple_name : value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => onSelect(ERLANGEN)}>
        select-erlangen
      </button>
      {endAdornment}
    </div>
  ),
}));

// Capture the location params handed to the event list / subscribe button.
const mockListProps = jest.fn();
jest.mock("./EventCalendarEventList", () => ({
  __esModule: true,
  default: (props: any) => {
    mockListProps(props);
    return <div data-testid="event-list">{JSON.stringify(props.locationParams || {})}</div>;
  },
}));

jest.mock("./SubscribeToCalendarButton", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="subscribe">{JSON.stringify(props.locationParams || {})}</div>
  ),
}));

const BASE_CONTEXT = {
  user: null,
  locale: "en" as const,
  locales: ["en" as const],
  pathName: "/events",
  donationGoals: [],
  hubUrl: "",
  CUSTOM_HUB_URLS: [],
};

function renderContent(props: Record<string, any> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={BASE_CONTEXT as any}>
        <EventCalendarContent filterChoices={{ sectors: [] }} {...props} />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

function countsRequestUrls(): string[] {
  return mockApiRequest.mock.calls
    .map((c) => c[0].url as string)
    .filter((url) => url.startsWith("/api/events/calendar/"));
}

// The radius select (browse LocationFilter) has an icon label only.
function radiusSelect() {
  const filter = screen.getByTestId("event-calendar-location-filter");
  return filter.querySelector("select") as HTMLSelectElement;
}

function lastListLocationParams() {
  const calls = mockListProps.mock.calls;
  return calls[calls.length - 1][0].locationParams;
}

describe("EventCalendarContent location filter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNarrowScreen = false;
    mockApiRequest.mockResolvedValue({ data: [] });
    window.history.replaceState({}, "", "/events");
  });

  describe("visibility", () => {
    it("is shown when showLocationFilter is set", () => {
      renderContent({ showLocationFilter: true });
      expect(screen.getByTestId("event-calendar-location-filter")).toBeInTheDocument();
    });

    it("is hidden by default (e.g. location hubs)", () => {
      renderContent();
      expect(screen.queryByTestId("event-calendar-location-filter")).not.toBeInTheDocument();
    });

    it("ignores an initial location when the filter is hidden", () => {
      renderContent({ initialLocation: ERLANGEN, initialRadius: "25km" });
      expect(lastListLocationParams()).toEqual({});
    });

    it("is placed between the date calendar and the topics filter", () => {
      renderContent({ showLocationFilter: true });
      const filter = screen.getByTestId("event-calendar-location-filter");
      const topics = screen.getByText("Topics");
      const calendar = document.querySelector(".MuiDateCalendar-root") as Element;
      expect(
        calendar.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        filter.compareDocumentPosition(topics) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
  });

  describe("desktop", () => {
    it("selecting a place filters list, counts and URL", async () => {
      renderContent({ showLocationFilter: true });
      fireEvent.click(screen.getByText("select-erlangen"));

      const expected = {
        osm_id: "1001",
        osm_type: "relation",
        osm_class: "boundary",
        place_id: "555",
      };
      expect(lastListLocationParams()).toEqual(expected);
      await waitFor(() =>
        expect(countsRequestUrls().some((u) => u.includes("osm_id=1001"))).toBe(true)
      );
      await waitFor(() => expect(window.location.search).toContain("osm_id=1001"));
      expect(screen.getByTestId("subscribe")).toHaveTextContent('"osm_id":"1001"');
    });

    it("sends radius (without km) once a place is selected", async () => {
      renderContent({ showLocationFilter: true });
      fireEvent.click(screen.getByText("select-erlangen"));
      fireEvent.change(radiusSelect(), { target: { value: "25km" } });

      expect(lastListLocationParams()).toMatchObject({ osm_id: "1001", radius: "25" });
      await waitFor(() => expect(window.location.search).toContain("radius=25"));
    });

    it("changing the radius without a place doesn't refetch", async () => {
      renderContent({ showLocationFilter: true });
      await waitFor(() => expect(countsRequestUrls()).toHaveLength(1));
      const listParamsBefore = lastListLocationParams();

      fireEvent.change(radiusSelect(), { target: { value: "25km" } });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });

      expect(countsRequestUrls()).toHaveLength(1);
      // Same object identity -> the list's fetch effect doesn't re-run.
      expect(lastListLocationParams()).toBe(listParamsBefore);
    });

    it("typing without selecting doesn't filter", () => {
      renderContent({ showLocationFilter: true });
      fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Erl" } });
      expect(lastListLocationParams()).toEqual({});
    });

    it("the remove button clears place and radius", async () => {
      renderContent({ showLocationFilter: true });
      expect(screen.queryByLabelText("Remove location")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("select-erlangen"));
      fireEvent.change(radiusSelect(), { target: { value: "25km" } });
      fireEvent.click(screen.getByLabelText("Remove location"));

      expect(lastListLocationParams()).toEqual({});
      expect(screen.getByLabelText("Location")).toHaveValue("");
      expect(radiusSelect()).toHaveValue("");
      await waitFor(() => expect(window.location.search).not.toContain("osm_id"));
    });

    it("reset clears the place", () => {
      renderContent({ showLocationFilter: true });
      fireEvent.click(screen.getByText("select-erlangen"));
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(lastListLocationParams()).toEqual({});
      expect(screen.getByLabelText("Location")).toHaveValue("");
    });

    it("pre-fills the input from the SSR location", () => {
      renderContent({
        showLocationFilter: true,
        initialLocation: ERLANGEN,
        initialRadius: "25km",
      });
      expect(screen.getByLabelText("Location")).toHaveValue("Erlangen");
      expect(radiusSelect()).toHaveValue("25km");
      expect(lastListLocationParams()).toMatchObject({ osm_id: "1001", radius: "25" });
    });
  });

  describe("mobile", () => {
    beforeEach(() => {
      mockIsNarrowScreen = true;
    });

    it("counts location as one active filter", () => {
      renderContent({
        showLocationFilter: true,
        initialLocation: ERLANGEN,
        initialRadius: "25km",
      });
      expect(screen.getByLabelText("1 active filters")).toBeInTheDocument();
    });

    it("applies the draft location only on 'Apply filters'", () => {
      renderContent({ showLocationFilter: true });
      fireEvent.click(screen.getByRole("button", { name: "Filters" }));
      const dialog = screen.getByRole("dialog");

      fireEvent.click(within(dialog).getByText("select-erlangen"));
      expect(lastListLocationParams()).toEqual({});
      // The subscribe button in the dialog already uses the draft location.
      expect(within(dialog).getByTestId("subscribe")).toHaveTextContent('"osm_id":"1001"');

      fireEvent.click(within(dialog).getByRole("button", { name: "Apply filters" }));
      expect(lastListLocationParams()).toMatchObject({ osm_id: "1001" });
    });

    it("'Clear all' clears only the draft location until applied", () => {
      renderContent({ showLocationFilter: true, initialLocation: ERLANGEN });
      fireEvent.click(screen.getByRole("button", { name: "Filters" }));
      const dialog = screen.getByRole("dialog");

      fireEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
      expect(within(dialog).getByLabelText("Location")).toHaveValue("");
      expect(lastListLocationParams()).toMatchObject({ osm_id: "1001" });

      fireEvent.click(within(dialog).getByRole("button", { name: "Apply filters" }));
      expect(lastListLocationParams()).toEqual({});
    });
  });
});

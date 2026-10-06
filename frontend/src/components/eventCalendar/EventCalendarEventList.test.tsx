import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// jsdom does not implement IntersectionObserver — provide a stub.
beforeAll(() => {
  class IntersectionObserverStub {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  }
  (global as any).IntersectionObserver = IntersectionObserverStub;
});
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";
import EventCalendarEventList from "./EventCalendarEventList";
import dayjs from "dayjs";

jest.mock("universal-cookie", () => {
  return jest.fn(() => ({ get: jest.fn(() => "test-token") }));
});

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

jest.mock("./EventCardWide", () => ({
  __esModule: true,
  default: ({ project }: any) => <div data-testid="event-card">{project.name}</div>,
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

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    url_slug: "test-event",
    name: "Test Event",
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString(),
    ...overrides,
  };
}

function paginatedResponse(results: any[], hasNext = false) {
  return {
    data: {
      count: results.length,
      results,
      next: hasNext ? "http://localhost/api/events/?page=2" : null,
      previous: null,
    },
  };
}

function renderList(props: Partial<React.ComponentProps<typeof EventCalendarEventList>> = {}) {
  const defaultProps = {
    initialEvents: [],
    initialHasMore: false,
    search: "",
    sectors: [] as string[],
    selectedDay: dayjs(),
    hubUrl: "",
    ...props,
  };
  return render(
    <ThemeProvider theme={theme}>
      <HubContext.Provider value={{ hubUrl: "", hubData: null, hubTheme: null, hubs: [] }}>
        <UserContext.Provider value={BASE_CONTEXT as any}>
          <EventCalendarEventList {...defaultProps} />
        </UserContext.Provider>
      </HubContext.Provider>
    </ThemeProvider>
  );
}

describe("EventCalendarEventList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiRequest.mockResolvedValue(paginatedResponse([]));
  });

  describe("rendering", () => {
    it("renders initial events without fetching page 1 again", () => {
      const now = new Date();
      const event = makeEvent({ name: "Pre-loaded Event", start_date: now.toISOString() });
      renderList({ initialEvents: [event], initialHasMore: false });

      expect(screen.getByText("Pre-loaded Event")).toBeInTheDocument();
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("fetches page 1 when initialEvents is empty", async () => {
      const event = makeEvent({ name: "Fetched Event" });
      mockApiRequest.mockResolvedValueOnce(paginatedResponse([event]));

      renderList();

      await waitFor(() => {
        expect(screen.getByText("Fetched Event")).toBeInTheDocument();
      });
      expect(mockApiRequest).toHaveBeenCalledTimes(1);
    });

    it("groups events by day and shows day headers", () => {
      const day1 = new Date(2026, 2, 12, 10, 0);
      const day2 = new Date(2026, 2, 13, 10, 0);
      renderList({
        initialEvents: [
          makeEvent({ name: "Event A", start_date: day1.toISOString() }),
          makeEvent({ name: "Event B", start_date: day2.toISOString() }),
        ],
      });

      expect(screen.getByText("Event A")).toBeInTheDocument();
      expect(screen.getByText("Event B")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("13")).toBeInTheDocument();
    });

    it("shows empty state when no events", async () => {
      mockApiRequest.mockResolvedValueOnce(paginatedResponse([]));
      renderList();

      await waitFor(() => {
        expect(screen.getByText(/could not find any events/i)).toBeInTheDocument();
      });
    });

    it("shows error state on API failure", async () => {
      mockApiRequest.mockRejectedValueOnce(new Error("Network error"));
      renderList();

      await waitFor(() => {
        expect(screen.getByText(/failed to load events/i)).toBeInTheDocument();
      });
    });
  });

  describe("filtering", () => {
    it("sends search param to API", async () => {
      mockApiRequest.mockResolvedValueOnce(paginatedResponse([]));
      renderList({ search: "solar" });

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
      });
      const callUrl = mockApiRequest.mock.calls[0][0].url;
      expect(callUrl).toContain("search=solar");
    });

    it("sends sectors param to API", async () => {
      mockApiRequest.mockResolvedValueOnce(paginatedResponse([]));
      renderList({ sectors: ["Energy", "Mobility"] });

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
      });
      const callUrl = mockApiRequest.mock.calls[0][0].url;
      expect(callUrl).toContain("sectors=Energy%2CMobility");
    });

    it("sends start_date based on selectedDay", async () => {
      mockApiRequest.mockResolvedValueOnce(paginatedResponse([]));
      const day = dayjs("2026-03-12");
      renderList({ selectedDay: day });

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
      });
      const callUrl = mockApiRequest.mock.calls[0][0].url;
      expect(callUrl).toContain("start_date=");
      expect(callUrl).toContain("2026-03-12");
    });

    it("re-fetches from page 1 when search changes", async () => {
      mockApiRequest.mockResolvedValue(paginatedResponse([]));
      const { rerender } = renderList({ search: "" });

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
      });

      rerender(
        <ThemeProvider theme={theme}>
          <HubContext.Provider value={{ hubUrl: "", hubData: null, hubTheme: null, hubs: [] }}>
            <UserContext.Provider value={BASE_CONTEXT as any}>
              <EventCalendarEventList
                initialEvents={[]}
                initialHasMore={false}
                search="wind"
                sectors={[]}
                selectedDay={dayjs()}
                hubUrl=""
              />
            </UserContext.Provider>
          </HubContext.Provider>
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(2);
      });
      const secondCallUrl = mockApiRequest.mock.calls[1][0].url;
      expect(secondCallUrl).toContain("search=wind");
      expect(secondCallUrl).toContain("page=1");
    });
  });

  describe("pagination", () => {
    it("sends page and page_size params to API", async () => {
      mockApiRequest.mockResolvedValueOnce(paginatedResponse([]));
      renderList();

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
      });
      const callUrl = mockApiRequest.mock.calls[0][0].url;
      expect(callUrl).toContain("page=1");
      expect(callUrl).toContain("page_size=12");
    });

    it("renders page 1 events with hasMore=true without fetching again", () => {
      const event = makeEvent({ name: "Page 1 Event", url_slug: "p1" });
      renderList({ initialEvents: [event], initialHasMore: true });

      expect(screen.getByText("Page 1 Event")).toBeInTheDocument();
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });
});

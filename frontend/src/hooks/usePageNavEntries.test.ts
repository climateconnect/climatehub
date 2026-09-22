import { renderHook } from "@testing-library/react";

const mockRouter = { pathname: "/browse", asPath: "/browse" };

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

import { useIsEventsPage, usePageNavEntries } from "./usePageNavEntries";

function setPathname(pathname: string) {
  mockRouter.pathname = pathname;
  mockRouter.asPath = pathname;
}

describe("usePageNavEntries.getHref", () => {
  beforeEach(() => {
    setPathname("/browse");
  });

  describe("global (no hub, no sub-hub)", () => {
    it("returns /browse for projects", () => {
      setPathname("/browse");
      const { result } = renderHook(() => usePageNavEntries({}));
      expect(result.current.getHref("projects")).toBe("/browse");
    });

    it("returns /organizations for organizations", () => {
      setPathname("/organizations");
      const { result } = renderHook(() => usePageNavEntries({}));
      expect(result.current.getHref("organizations")).toBe("/organizations");
    });

    it("returns /members for members", () => {
      setPathname("/members");
      const { result } = renderHook(() => usePageNavEntries({}));
      expect(result.current.getHref("members")).toBe("/members");
    });

    it("returns /events for events", () => {
      setPathname("/events");
      const { result } = renderHook(() => usePageNavEntries({}));
      expect(result.current.getHref("events")).toBe("/events");
    });
  });

  describe("hub page (parent hub only)", () => {
    it("returns /hubs/<hub>/browse for projects", () => {
      const { result } = renderHook(() => usePageNavEntries({ hubUrl: "kassel" }));
      expect(result.current.getHref("projects")).toBe("/hubs/kassel/browse");
    });

    it("returns /hubs/<hub>/organizations for organizations", () => {
      const { result } = renderHook(() => usePageNavEntries({ hubUrl: "kassel" }));
      expect(result.current.getHref("organizations")).toBe("/hubs/kassel/organizations");
    });

    it("returns /hubs/<hub>/members for members", () => {
      const { result } = renderHook(() => usePageNavEntries({ hubUrl: "kassel" }));
      expect(result.current.getHref("members")).toBe("/hubs/kassel/members");
    });

    it("returns /hubs/<hub>/events for events", () => {
      const { result } = renderHook(() => usePageNavEntries({ hubUrl: "kassel" }));
      expect(result.current.getHref("events")).toBe("/hubs/kassel/events");
    });
  });

  describe("sub-hub page (parent + sub)", () => {
    it("returns /hubs/<hub>/<sub>/browse for projects", () => {
      const { result } = renderHook(() =>
        usePageNavEntries({ hubUrl: "erlangen", subHubSegment: "zerowaste" })
      );
      expect(result.current.getHref("projects")).toBe("/hubs/erlangen/zerowaste/browse");
    });

    it("returns /hubs/<hub>/<sub>/organizations for organizations", () => {
      const { result } = renderHook(() =>
        usePageNavEntries({ hubUrl: "erlangen", subHubSegment: "zerowaste" })
      );
      expect(result.current.getHref("organizations")).toBe(
        "/hubs/erlangen/zerowaste/organizations"
      );
    });

    it("returns /hubs/<hub>/<sub>/members for members", () => {
      const { result } = renderHook(() =>
        usePageNavEntries({ hubUrl: "erlangen", subHubSegment: "zerowaste" })
      );
      expect(result.current.getHref("members")).toBe("/hubs/erlangen/zerowaste/members");
    });

    it("returns /hubs/<hub>/<sub>/events for events", () => {
      const { result } = renderHook(() =>
        usePageNavEntries({ hubUrl: "erlangen", subHubSegment: "zerowaste" })
      );
      expect(result.current.getHref("events")).toBe("/hubs/erlangen/zerowaste/events");
    });
  });
});

describe("usePageNavEntries.isActive", () => {
  beforeEach(() => {
    setPathname("/browse");
  });

  it("highlights projects on /browse", () => {
    setPathname("/browse");
    const { result } = renderHook(() => usePageNavEntries({}));
    expect(result.current.isActive("projects", "projects")).toBe(true);
    expect(result.current.isActive("organizations", "projects")).toBe(false);
    expect(result.current.isActive("members", "projects")).toBe(false);
    expect(result.current.isActive("events", "projects")).toBe(false);
  });

  it("highlights organizations on /organizations", () => {
    setPathname("/organizations");
    const { result } = renderHook(() => usePageNavEntries({}));
    expect(result.current.isActive("projects", "organizations")).toBe(false);
    expect(result.current.isActive("organizations", "organizations")).toBe(true);
    expect(result.current.isActive("members", "organizations")).toBe(false);
    expect(result.current.isActive("events", "organizations")).toBe(false);
  });

  it("highlights events on /events", () => {
    setPathname("/events");
    const { result } = renderHook(() => usePageNavEntries({}));
    expect(result.current.isActive("events", null)).toBe(true);
    expect(result.current.isActive("projects", null)).toBe(false);
  });

  it("highlights events on hub events pages via pathname check", () => {
    setPathname("/hubs/kassel/events");
    const { result } = renderHook(() => usePageNavEntries({ hubUrl: "kassel" }));
    expect(result.current.isActive("events", null)).toBe(true);
  });

  it("highlights events on sub-hub events pages via pathname check", () => {
    setPathname("/hubs/erlangen/zerowaste/events");
    const { result } = renderHook(() =>
      usePageNavEntries({ hubUrl: "erlangen", subHubSegment: "zerowaste" })
    );
    expect(result.current.isActive("events", null)).toBe(true);
  });

  it("returns false for everything when activeEntry is null and pathname is not events", () => {
    setPathname("/hubs/kassel/browse");
    const { result } = renderHook(() => usePageNavEntries({ hubUrl: "kassel" }));
    expect(result.current.isActive("projects", null)).toBe(false);
    expect(result.current.isActive("organizations", null)).toBe(false);
    expect(result.current.isActive("members", null)).toBe(false);
    expect(result.current.isActive("events", null)).toBe(false);
  });

  it("exposes isEventsPage derived from the URL", () => {
    setPathname("/events");
    const { result, rerender } = renderHook(() => usePageNavEntries({}));
    expect(result.current.isEventsPage).toBe(true);
    setPathname("/hubs/kassel/events");
    rerender();
    expect(result.current.isEventsPage).toBe(true);
    setPathname("/browse");
    rerender();
    expect(result.current.isEventsPage).toBe(false);
    setPathname("/hubs/erlangen/zerowaste/organizations");
    rerender();
    expect(result.current.isEventsPage).toBe(false);
  });
});

describe("useIsEventsPage", () => {
  beforeEach(() => {
    setPathname("/browse");
  });

  it("returns true on /events", () => {
    setPathname("/events");
    const { result } = renderHook(() => useIsEventsPage());
    expect(result.current).toBe(true);
  });

  it("returns true on /hubs/<hub>/events", () => {
    setPathname("/hubs/kassel/events");
    const { result } = renderHook(() => useIsEventsPage());
    expect(result.current).toBe(true);
  });

  it("returns true on sub-hub events pages", () => {
    setPathname("/hubs/erlangen/zerowaste/events");
    const { result } = renderHook(() => useIsEventsPage());
    expect(result.current).toBe(true);
  });

  it("returns false on /browse and other entity-browser pages", () => {
    setPathname("/browse");
    const { result, rerender } = renderHook(() => useIsEventsPage());
    expect(result.current).toBe(false);
    setPathname("/hubs/kassel/organizations");
    rerender();
    expect(result.current).toBe(false);
    setPathname("/hubs/erlangen/zerowaste/members");
    rerender();
    expect(result.current).toBe(false);
  });
});

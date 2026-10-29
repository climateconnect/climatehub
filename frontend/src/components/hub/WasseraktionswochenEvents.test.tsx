import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import WasseraktionswochenEvents, { sortProjectsByStartDate } from "./WasseraktionswochenEvents";

const projectPreviewsMock = jest.fn(({ projects }: { projects: any[] }) => (
  <div data-testid="project-previews">
    {projects.map((project) => (
      <span key={project.url_slug} data-testid="project-slug">
        {project.url_slug}
      </span>
    ))}
  </div>
));

jest.mock("../project/ProjectPreviews", () => ({
  __esModule: true,
  default: (props: any) => projectPreviewsMock(props),
}));

// Helper to render components with theme
const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

describe("sortProjectsByStartDate", () => {
  beforeEach(() => {
    jest.setSystemTime(new Date("2024-01-10T08:00:00Z"));
  });

  it("prioritizes upcoming projects and sorts within each group", () => {
    const projects = [
      { url_slug: "past-2", start_date: "2024-01-09T09:00:00Z" },
      { url_slug: "upcoming-1", start_date: "2024-01-10T12:00:00Z" },
      { url_slug: "no-date", start_date: null },
      { url_slug: "upcoming-2", start_date: "2024-01-11T09:00:00Z" },
      { url_slug: "past-1", start_date: "2024-01-08T09:00:00Z" },
    ];

    const sorted = sortProjectsByStartDate(projects);

    expect(sorted.map((p) => p.url_slug)).toEqual([
      "upcoming-1",
      "upcoming-2",
      "no-date",
      "past-1",
      "past-2",
    ]);
  });

  describe("end_date classification", () => {
    beforeEach(() => {
      // Use local time so getStartOfTodayMs() is unambiguous
      jest.setSystemTime(new Date("2024-01-10T12:00:00"));
    });

    it("treats event with past start_date but future end_date as upcoming", () => {
      const projects = [
        {
          url_slug: "ongoing",
          start_date: "2024-01-09T10:00:00",
          end_date: "2024-01-12T10:00:00",
        },
        {
          url_slug: "truly-past",
          start_date: "2024-01-08T10:00:00",
          end_date: "2024-01-09T10:00:00",
        },
        { url_slug: "future", start_date: "2024-01-11T10:00:00" },
      ];

      const sorted = sortProjectsByStartDate(projects);

      // ongoing is bumped to end-of-today (Jan 10 23:59:59) so it groups with
      // today's events and sorts before the future event on Jan 11.
      expect(sorted.map((p) => p.url_slug)).toEqual(["ongoing", "future", "truly-past"]);
    });

    it("treats event with no end_date and past start_date as past", () => {
      const projects = [
        { url_slug: "no-end-date-past", start_date: "2024-01-08T10:00:00" },
        { url_slug: "future", start_date: "2024-01-11T10:00:00" },
      ];

      const sorted = sortProjectsByStartDate(projects);

      expect(sorted.map((p) => p.url_slug)).toEqual(["future", "no-end-date-past"]);
    });
  });

  describe("all-day event sorting (start time 00:00)", () => {
    beforeEach(() => {
      jest.setSystemTime(new Date("2024-01-10T12:00:00"));
    });

    it("sorts all-day events after timed events on the same day", () => {
      const projects = [
        { url_slug: "all-day", start_date: "2024-01-10T00:00:00" },
        { url_slug: "timed-afternoon", start_date: "2024-01-10T14:00:00" },
        { url_slug: "timed-morning", start_date: "2024-01-10T09:00:00" },
      ];

      const sorted = sortProjectsByStartDate(projects);

      expect(sorted.map((p) => p.url_slug)).toEqual([
        "timed-morning",
        "timed-afternoon",
        "all-day",
      ]);
    });

    it("sorts all-day future events after timed events on the same future day", () => {
      const projects = [
        { url_slug: "all-day-future", start_date: "2024-01-11T00:00:00" },
        { url_slug: "timed-future-afternoon", start_date: "2024-01-11T14:00:00" },
        { url_slug: "timed-future-morning", start_date: "2024-01-11T09:00:00" },
      ];

      const sorted = sortProjectsByStartDate(projects);

      expect(sorted.map((p) => p.url_slug)).toEqual([
        "timed-future-morning",
        "timed-future-afternoon",
        "all-day-future",
      ]);
    });
  });

  describe("three-tier sort order within a day", () => {
    beforeEach(() => {
      jest.setSystemTime(new Date("2024-01-10T12:00:00"));
    });

    it("orders: timed today → all-day today → ongoing multi-day → future events", () => {
      const projects = [
        // Tier 3: ongoing (started yesterday, ends in the future)
        {
          url_slug: "ongoing",
          start_date: "2024-01-09T10:00:00",
          end_date: "2024-01-13T00:00:00",
        },
        // Tier 2: all-day today
        { url_slug: "all-day-today", start_date: "2024-01-10T00:00:00" },
        // Tier 1: timed events today
        { url_slug: "timed-today-late", start_date: "2024-01-10T18:00:00" },
        { url_slug: "timed-today-early", start_date: "2024-01-10T09:00:00" },
        // Tier 4: future day
        { url_slug: "future", start_date: "2024-01-11T09:00:00" },
      ];

      const sorted = sortProjectsByStartDate(projects);

      expect(sorted.map((p) => p.url_slug)).toEqual([
        "timed-today-early", // tier 1 — 09:00
        "timed-today-late", //  tier 1 — 18:00
        "all-day-today", //     tier 2 — bumped to 23:00
        "ongoing", //           tier 3 — bumped to 23:59:59
        "future", //            future day
      ]);
    });

    it("sorts multiple ongoing events by their original start_date (secondary sort)", () => {
      const projects = [
        {
          url_slug: "ongoing-earlier",
          start_date: "2024-01-08T10:00:00",
          end_date: "2024-01-12T00:00:00",
        },
        {
          url_slug: "ongoing-later",
          start_date: "2024-01-09T10:00:00",
          end_date: "2024-01-12T00:00:00",
        },
      ];

      const sorted = sortProjectsByStartDate(projects);

      expect(sorted.map((p) => p.url_slug)).toEqual(["ongoing-earlier", "ongoing-later"]);
    });
  });
});

describe("WasseraktionswochenEvents", () => {
  beforeEach(() => {
    projectPreviewsMock.mockClear();
    jest.setSystemTime(new Date("2024-01-10T08:00:00Z"));
  });

  it("renders two separate sections with German headings for upcoming and past events", () => {
    const projects = [
      { url_slug: "past", start_date: "2024-01-08T00:00:00Z" },
      { url_slug: "upcoming", start_date: "2024-01-11T00:00:00Z" },
    ];

    renderWithTheme(<WasseraktionswochenEvents projects={projects} isGerman />);

    // Check for German headings
    expect(screen.getByText("Diese Events erwarten Euch")).toBeInTheDocument();
    expect(screen.getByText("Vergangene Veranstaltungen")).toBeInTheDocument();

    // ProjectPreviews should be called twice (once for upcoming, once for past)
    expect(projectPreviewsMock).toHaveBeenCalledTimes(2);

    // First call should be for upcoming events
    const { projects: upcomingProjects } = projectPreviewsMock.mock.calls[0][0];
    expect(upcomingProjects.map((p: any) => p.url_slug)).toEqual(["upcoming"]);

    // Second call should be for past events
    const { projects: pastProjects } = projectPreviewsMock.mock.calls[1][0];
    expect(pastProjects.map((p: any) => p.url_slug)).toEqual(["past"]);
  });

  it("renders two separate sections with English headings for upcoming and past events", () => {
    const projects = [
      { url_slug: "past", start_date: "2024-01-08T00:00:00Z" },
      { url_slug: "upcoming", start_date: "2024-01-11T00:00:00Z" },
    ];

    renderWithTheme(<WasseraktionswochenEvents projects={projects} isGerman={false} />);

    // Check for English headings
    expect(screen.getByText("Upcoming Events")).toBeInTheDocument();
    expect(screen.getByText("Past Events")).toBeInTheDocument();
  });

  it("only renders upcoming section when there are no past events", () => {
    const projects = [
      { url_slug: "upcoming-1", start_date: "2024-01-11T00:00:00Z" },
      { url_slug: "upcoming-2", start_date: "2024-01-12T00:00:00Z" },
    ];

    renderWithTheme(<WasseraktionswochenEvents projects={projects} isGerman />);

    expect(screen.getByText("Diese Events erwarten Euch")).toBeInTheDocument();
    expect(screen.queryByText("Vergangene Veranstaltungen")).not.toBeInTheDocument();

    // ProjectPreviews should only be called once
    expect(projectPreviewsMock).toHaveBeenCalledTimes(1);
  });

  it("only renders past section when there are no upcoming events", () => {
    const projects = [
      { url_slug: "past-1", start_date: "2024-01-08T00:00:00Z" },
      { url_slug: "past-2", start_date: "2024-01-09T00:00:00Z" },
    ];

    renderWithTheme(<WasseraktionswochenEvents projects={projects} isGerman />);

    expect(screen.queryByText("Diese Events erwarten Euch")).not.toBeInTheDocument();
    expect(screen.getByText("Vergangene Veranstaltungen")).toBeInTheDocument();

    // ProjectPreviews should only be called once
    expect(projectPreviewsMock).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there are no events", () => {
    renderWithTheme(<WasseraktionswochenEvents projects={[]} isGerman />);

    expect(screen.queryByText("Diese Events erwarten Euch")).not.toBeInTheDocument();
    expect(screen.queryByText("Vergangene Veranstaltungen")).not.toBeInTheDocument();

    // ProjectPreviews should not be called
    expect(projectPreviewsMock).not.toHaveBeenCalled();
  });

  it("places event with past start_date but future end_date in the upcoming section", () => {
    jest.setSystemTime(new Date("2024-01-10T12:00:00"));

    const projects = [
      {
        url_slug: "ongoing-event",
        start_date: "2024-01-09T10:00:00",
        end_date: "2024-01-12T10:00:00",
      },
    ];

    renderWithTheme(<WasseraktionswochenEvents projects={projects} isGerman />);

    expect(screen.getByText("Diese Events erwarten Euch")).toBeInTheDocument();
    expect(screen.queryByText("Vergangene Veranstaltungen")).not.toBeInTheDocument();
  });
});

import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import UserContext from "../context/UserContext";
import { LinkedHub } from "../../types";

const testTheme = createTheme({
  spacing: (factor: number) => `${8 * factor}px`,
});

jest.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/",
    events: {
      on: () => undefined,
      off: () => undefined,
    },
  }),
}));

jest.mock("./HubContent", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("./HubHeaderImage", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../staticpages/donate/DonationCampaignInformation", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("./FabShareButton", () => ({
  __esModule: true,
  FabShareButton: () => null,
}));
jest.mock("../pageNav/PageNav", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../pageNav/MobilePageNav", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@mui/material", () => {
  const actual = jest.requireActual("@mui/material");
  return {
    ...actual,
    useMediaQuery: () => false,
  };
});

jest.mock("../../../public/lib/getHubData", () => ({
  getHubAmbassadorData: () => Promise.resolve(null),
  getHubSupportersData: () => Promise.resolve(null),
  getHubData: () => Promise.resolve(null),
  getLinkedHubsData: () => Promise.resolve([]),
}));

import HubPageLayout from "./HubPageLayout";

const userContextValue: any = {
  locale: "en",
  CUSTOM_HUB_URLS: [],
  hubs: [],
  LOCATION_HUBS: [],
  isLoading: false,
  pathName: "/",
  user: null,
  notifications: [],
  donationGoals: [],
  acceptedNecessary: false,
  socketConnectionState: "disconnected",
  refreshUser: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  signIn: () => Promise.resolve(),
  refreshNotifications: () => Promise.resolve(),
  hideNotification: () => undefined,
  setNotificationsRead: () => Promise.resolve(),
  startLoading: () => undefined,
  stopLoading: () => undefined,
  updateCookies: () => undefined,
};

const linkedHubs: LinkedHub[] = [
  { hubName: "Parent Perth", hubUrl: "/hubs/perth/browse", icon: "/icon.png" },
  { hubName: "Sibling Transport", hubUrl: "/hubs/perth/transport/browse", icon: "/icon.png" },
];

function renderLayout(props: any) {
  return render(
    <ThemeProvider theme={testTheme}>
      <UserContext.Provider value={userContextValue}>
        <HubPageLayout
          activeEntry={null}
          hubUrl="perth"
          subHubSegment="transport"
          hubData={{ name: "Perth Transport", image: null }}
          allHubs={[]}
          linkedHubs={linkedHubs}
          isLocationHub
          {...props}
        >
          <div>content</div>
        </HubPageLayout>
      </UserContext.Provider>
    </ThemeProvider>
  );
}

function getLinkedHubsHrefs(): string[] {
  return Array.from(document.querySelectorAll("a"))
    .filter((a) => a.querySelector("h3"))
    .map((a) => a.getAttribute("href") as string);
}

describe("HubPageLayout linked-hub navigation on different page types", () => {
  describe("on the hub events page (activeEntry = null, isEventsPage = true)", () => {
    it("rewrites linked sub-hub URLs to the linked hub's events page", () => {
      renderLayout({ activeEntry: null, isEventsPage: true });
      const hrefs = getLinkedHubsHrefs();
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toMatch(/\/events$/);
        expect(href).not.toMatch(/\/browse$/);
        expect(href).not.toMatch(/\/projects$/);
      }
    });

    it("preserves the sub-hub path when the linked hub is a sub-hub of a different parent", () => {
      const subHubLinked: LinkedHub[] = [
        { hubName: "Other Sub", hubUrl: "/hubs/perth/zerowaste/browse", icon: "/icon.png" },
      ];
      render(
        <ThemeProvider theme={testTheme}>
          <UserContext.Provider value={userContextValue}>
            <HubPageLayout
              activeEntry={null}
              isEventsPage
              hubUrl="perth"
              subHubSegment="transport"
              hubData={{ name: "Perth Transport", image: null }}
              allHubs={[]}
              linkedHubs={subHubLinked}
              isLocationHub
            >
              <div>content</div>
            </HubPageLayout>
          </UserContext.Provider>
        </ThemeProvider>
      );
      const link = document.querySelector("a h3")?.parentElement as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/hubs/perth/zerowaste/events");
    });
  });

  describe("on a non-events page without an active entry (e.g. hub landing page)", () => {
    it("falls back to the linked hub's URL unchanged", () => {
      // Without isEventsPage, HubPageLayout should not pass pageContext="events"
      renderLayout({ activeEntry: null, isEventsPage: false });
      const hrefs = getLinkedHubsHrefs();
      // The links should not be rewritten to /events
      for (const href of hrefs) {
        expect(href).not.toMatch(/\/events$/);
      }
    });
  });

  describe("on the hub projects page (activeEntry = projects)", () => {
    it("rewrites linked sub-hub URLs to the linked hub's browse page (projects)", () => {
      renderLayout({ activeEntry: "projects" });
      const hrefs = getLinkedHubsHrefs();
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toMatch(/\/browse$/);
        expect(href).not.toMatch(/\/events$/);
      }
    });
  });

  describe("on the hub organizations page (activeEntry = organizations)", () => {
    it("rewrites linked sub-hub URLs to the linked hub's organizations page", () => {
      renderLayout({ activeEntry: "organizations" });
      const hrefs = getLinkedHubsHrefs();
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toMatch(/\/organizations$/);
      }
    });
  });

  describe("on the hub members page (activeEntry = members)", () => {
    it("rewrites linked sub-hub URLs to the linked hub's members page", () => {
      renderLayout({ activeEntry: "members" });
      const hrefs = getLinkedHubsHrefs();
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toMatch(/\/members$/);
      }
    });
  });

  describe("sub-hub info text", () => {
    it("does not show the info text when the hub has no parent_hub", () => {
      render(
        <ThemeProvider theme={testTheme}>
          <UserContext.Provider value={userContextValue}>
            <HubPageLayout
              activeEntry="projects"
              hubUrl="kassel"
              hubData={{ name: "Kassel", image: null, parent_hub: null }}
              allHubs={[]}
              linkedHubs={[]}
            >
              <div>content</div>
            </HubPageLayout>
          </UserContext.Provider>
        </ThemeProvider>
      );
      expect(document.body.textContent.includes("you_are_seeing_projects_related_to")).toBe(false);
    });

    it("shows the projects variant on the projects page of a sub-hub", () => {
      render(
        <ThemeProvider theme={testTheme}>
          <UserContext.Provider value={userContextValue}>
            <HubPageLayout
              activeEntry="projects"
              hubUrl="perth"
              subHubSegment="transport"
              hubData={{ name: "Perth Transport", image: null, parent_hub: "perth" }}
              allHubs={[]}
              linkedHubs={[]}
            >
              <div>content</div>
            </HubPageLayout>
          </UserContext.Provider>
        </ThemeProvider>
      );
      // The text comes from a translated string. We just check that some
      // sub-hub info text is rendered, and that it is NOT the
      // "organisations" or "members" variant.
      const infoText = document.querySelector('[class*="subHubInfoText"]');
      expect(infoText).toBeTruthy();
      expect(infoText?.textContent).not.toMatch(/organization/i);
      expect(infoText?.textContent).not.toMatch(/mitglied|member/i);
    });

    it("shows the organisations variant on the organisations page of a sub-hub", () => {
      render(
        <ThemeProvider theme={testTheme}>
          <UserContext.Provider value={userContextValue}>
            <HubPageLayout
              activeEntry="organizations"
              hubUrl="perth"
              subHubSegment="transport"
              hubData={{ name: "Perth Transport", image: null, parent_hub: "perth" }}
              allHubs={[]}
              linkedHubs={[]}
            >
              <div>content</div>
            </HubPageLayout>
          </UserContext.Provider>
        </ThemeProvider>
      );
      const infoText = document.querySelector('[class*="subHubInfoText"]');
      expect(infoText).toBeTruthy();
      expect(infoText?.textContent).toMatch(/organis/i);
      expect(infoText?.textContent).not.toMatch(/people interested/i);
    });

    it("shows the members variant on the members page of a sub-hub", () => {
      render(
        <ThemeProvider theme={testTheme}>
          <UserContext.Provider value={userContextValue}>
            <HubPageLayout
              activeEntry="members"
              hubUrl="perth"
              subHubSegment="transport"
              hubData={{ name: "Perth Transport", image: null, parent_hub: "perth" }}
              allHubs={[]}
              linkedHubs={[]}
            >
              <div>content</div>
            </HubPageLayout>
          </UserContext.Provider>
        </ThemeProvider>
      );
      const infoText = document.querySelector('[class*="subHubInfoText"]');
      expect(infoText).toBeTruthy();
      expect(infoText?.textContent).toMatch(/people interested/i);
      expect(infoText?.textContent).not.toMatch(/organis/i);
    });
  });
});

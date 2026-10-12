import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import HubLinkButton from "./HubLinkButton";
import { LinkedHub } from "../../types";

jest.mock("@mui/material", () => {
  const actual = jest.requireActual("@mui/material");
  return {
    ...actual,
    useMediaQuery: () => false,
  };
});

function makeLinkedHub(overrides: Partial<LinkedHub> = {}): LinkedHub {
  return {
    hubName: "Kassel",
    hubUrl: "/hubs/kassel/browse",
    icon: "/icon.png",
    backgroundColor: "lightblue",
    ...overrides,
  };
}

function renderButton(hub: LinkedHub, props: Record<string, any> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <HubLinkButton hub={hub} {...props} />
    </ThemeProvider>
  );
}

describe("HubLinkButton.getLinkUrl", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  describe("on a parent-hub browse page (activeTab = projects)", () => {
    it("preserves the projects entry when the linked hub is a parent hub", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/browse" });
      renderButton(hub, { activeTab: "projects" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/browse");
    });

    it("preserves the projects entry when the linked hub is a sub-hub of another parent", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/zerowaste/browse" });
      renderButton(hub, { activeTab: "projects" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/zerowaste/browse");
    });
  });

  describe("on a parent-hub organizations page (activeTab = organizations)", () => {
    it("preserves the organizations entry when the linked hub is a parent hub", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/browse" });
      renderButton(hub, { activeTab: "organizations" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/organizations");
    });

    it("preserves the organizations entry when the linked hub is a sub-hub", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/zerowaste/browse" });
      renderButton(hub, { activeTab: "organizations" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/zerowaste/organizations");
    });
  });

  describe("on a parent-hub members page (activeTab = members)", () => {
    it("preserves the members entry when the linked hub is a parent hub", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/browse" });
      renderButton(hub, { activeTab: "members" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/members");
    });

    it("preserves the members entry when the linked hub is a sub-hub", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/zerowaste/browse" });
      renderButton(hub, { activeTab: "members" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/zerowaste/members");
    });
  });

  describe("on a sub-hub organizations page (activeTab = organizations, deep sub-hub linked)", () => {
    it("preserves the organizations entry when the linked hub is a deeper sub-hub of a different parent", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/zerowaste/browse" });
      renderButton(hub, { activeTab: "organizations" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/zerowaste/organizations");
    });
  });

  describe("pageContext = events", () => {
    it("switches a /browse linked hub to /events", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/browse" });
      renderButton(hub, { pageContext: "events" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/events");
    });

    it("switches a /projects (legacy) linked hub to /events", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/projects" });
      renderButton(hub, { pageContext: "events" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/events");
    });

    it("switches a sub-hub /browse linked hub to sub-hub /events", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/zerowaste/browse" });
      renderButton(hub, { pageContext: "events" });
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/zerowaste/events");
    });
  });

  describe("no activeTab (fallback)", () => {
    it("returns the hub URL unchanged when there is no activeTab and no hash", () => {
      const hub = makeLinkedHub({ hubUrl: "/hubs/erlangen/browse" });
      renderButton(hub, {});
      const link = screen.getByRole("link");
      expect(link.getAttribute("href")).toBe("/hubs/erlangen/browse");
    });
  });
});

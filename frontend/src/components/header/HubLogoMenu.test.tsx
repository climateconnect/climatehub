import React from "react";
import { fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";

const testTheme = createTheme({
  spacing: (factor: number) => `${8 * factor}px`,
});

const mockRouter: any = {
  pathname: "/",
  asPath: "/",
  locale: "en",
  locales: ["en", "de"],
  query: {},
  events: { on: () => undefined, off: () => undefined },
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

import HubLogoMenu from "./HubLogoMenu";

const hubs = [
  { url_slug: "erlangen", name: "Erlangen", hub_type: "location hub" },
  { url_slug: "perth", name: "Perth & Kinross", hub_type: "location hub" },
  { url_slug: "prio1", name: "PRIO1 Hub (MRN)", hub_type: "custom hub" },
];

const userContextValue: any = {
  locale: "en",
  user: null,
  startLoading: () => undefined,
  CUSTOM_HUB_URLS: ["perth", "prio1"],
};

function renderMenu({ hubUrl = "" }: { hubUrl?: string }) {
  return render(
    <ThemeProvider theme={testTheme}>
      <StylesThemeProvider theme={testTheme}>
        <UserContext.Provider value={userContextValue}>
          <HubContext.Provider value={{ hubUrl, hubData: null, hubTheme: null, hubs: hubs as any }}>
            <HubLogoMenu />
          </HubContext.Provider>
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

function openMenu() {
  const trigger = document.querySelector("button[aria-haspopup='menu']") as HTMLElement;
  fireEvent.click(trigger);
}

function isRowActive(label: string) {
  const row = Array.from(document.querySelectorAll("a")).find(
    (a) => a.textContent?.trim() === label
  );
  return row?.getAttribute("aria-current") === "page";
}

describe("HubLogoMenu active hub", () => {
  it("marks the active hub from the hub context", () => {
    renderMenu({ hubUrl: "erlangen" });
    openMenu();
    expect(isRowActive("Erlangen")).toBe(true);
    expect(isRowActive("All places")).toBe(false);
  });

  it("marks All places as active when no hub is active", () => {
    renderMenu({ hubUrl: "" });
    openMenu();
    expect(isRowActive("All places")).toBe(true);
    expect(isRowActive("Erlangen")).toBe(false);
  });
});

describe("HubLogoMenu hub grouping", () => {
  it("groups hubs listed in CUSTOM_HUB_URLS as custom hubs even when the API reports them as location hubs", () => {
    renderMenu({ hubUrl: "" });
    openMenu();
    const rows = Array.from(document.querySelectorAll("a")).map((a) => a.textContent?.trim());
    // All places first, then location hubs alphabetically, then custom hubs
    // (perth is a custom hub via CUSTOM_HUB_URLS despite its API hub_type).
    expect(rows).toEqual(["All places", "Erlangen", "Perth & Kinross", "PRIO1 Hub (MRN)"]);
  });
});

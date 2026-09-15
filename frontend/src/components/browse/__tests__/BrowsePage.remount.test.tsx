import { createElement, ReactNode, useRef } from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";

import UserContext from "../../context/UserContext";
import { HubContext } from "../../context/HubContext";
import BrowsePage from "../../../../pages/browse";

const testTheme = createTheme({
  spacing: (factor: number) => `${8 * factor}px`,
});

const mockRouter: { pathname: string; asPath: string; query: Record<string, string> } = {
  pathname: "/browse",
  asPath: "/browse",
  query: {},
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

const userContextValue: any = {
  locale: "en",
  user: null,
  refreshUser: () => Promise.resolve(),
};

jest.mock("../../layouts/WideLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

jest.mock("../../provider/FilterProvider", () => ({
  __esModule: true,
  FilterProvider: ({ children }: { children: ReactNode }) => children,
}));

const mountCounter = { counter: 0 };

jest.mock("../BrowseProjectsContent", () => ({
  __esModule: true,
  default: function BrowseProjectsContentMock() {
    // Capture the current "instance id" — a number set on a ref once at
    // mount time. If the component is re-rendered (same instance), the ref
    // survives. If it's unmounted and remounted, a new ref is created and
    // mountCount is incremented.
    const ref = useRef<{ id: number }>({ id: 0 });
    if (ref.current.id === 0) {
      ref.current.id = ++mountCounter.counter;
    }
    return createElement("div", {
      "data-testid": "browse-projects-content",
      "data-instance-id": ref.current.id,
    });
  },
}));

jest.mock("../../pageNav/PageNav", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../pageNav/MobilePageNav", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../../../../public/lib/locationOperations", () => ({
  getLocationFilteredBy: () => Promise.resolve(null),
}));
jest.mock("../../../../public/lib/profileOperations", () => ({
  nullifyUndefinedValues: (v: any) => v,
}));

function renderPage() {
  return render(
    <ThemeProvider theme={testTheme}>
      <StylesThemeProvider theme={testTheme}>
        <UserContext.Provider value={userContextValue}>
          <HubContext.Provider value={{ hubs: [] }}>
            <BrowsePage filterChoices={{}} initialLocationFilter={null} />
          </HubContext.Provider>
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

function rerenderPage(rerender: (_ui: ReactNode) => void) {
  rerender(
    <ThemeProvider theme={testTheme}>
      <StylesThemeProvider theme={testTheme}>
        <UserContext.Provider value={userContextValue}>
          <HubContext.Provider value={{ hubs: [] }}>
            <BrowsePage filterChoices={{}} initialLocationFilter={null} />
          </HubContext.Provider>
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

describe("/browse page remount behaviour", () => {
  beforeEach(() => {
    mountCounter.counter = 0;
    mockRouter.pathname = "/browse";
    mockRouter.asPath = "/browse";
    mockRouter.query = {};
  });

  it("content component renders with a single instance id on initial mount", () => {
    const { container } = renderPage();
    const instances = container.querySelectorAll("[data-instance-id]");
    const ids = new Set<string>();
    instances.forEach((el) => ids.add(el.getAttribute("data-instance-id") || ""));
    expect(ids.size).toBe(1);
  });

  it("content component is NOT remounted when only the query string changes (filter change)", () => {
    const { container, rerender } = renderPage();
    const initialIds = new Set<string>();
    container.querySelectorAll("[data-instance-id]").forEach((el) => {
      initialIds.add(el.getAttribute("data-instance-id") || "");
    });
    expect(initialIds.size).toBe(1);
    const initialId = [...initialIds][0];

    // Simulate a filter change: asPath changes, pathname stays the same.
    mockRouter.pathname = "/browse";
    mockRouter.asPath = "/browse?search=foo&location=Berlin";
    mockRouter.query = { search: "foo", location: "Berlin" };

    rerenderPage(rerender);

    const afterIds = new Set<string>();
    container.querySelectorAll("[data-instance-id]").forEach((el) => {
      afterIds.add(el.getAttribute("data-instance-id") || "");
    });
    expect(afterIds.size).toBe(1);
    expect([...afterIds][0]).toBe(initialId);
  });

  it("content component is NOT remounted on an unchanged re-render", () => {
    const { container, rerender } = renderPage();
    const initialIds = new Set<string>();
    container.querySelectorAll("[data-instance-id]").forEach((el) => {
      initialIds.add(el.getAttribute("data-instance-id") || "");
    });
    const initialId = [...initialIds][0];

    rerenderPage(rerender);

    const afterIds = new Set<string>();
    container.querySelectorAll("[data-instance-id]").forEach((el) => {
      afterIds.add(el.getAttribute("data-instance-id") || "");
    });
    expect(afterIds.size).toBe(1);
    expect([...afterIds][0]).toBe(initialId);
  });
});

// Note: the legacy hash redirect (`/browse#members` -> `/members`,
// `/hubs/<hub>/browse#members` -> `/hubs/<hub>/members`) is hard to unit-test
// in jsdom because `window.location.hash` and `window.location.replace` are
// non-configurable properties. The redirect is covered by manual browser
// testing — see the "What I did not test" note in the review report.

import { useContext } from "react";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { HubContext, HubProvider } from "./HubContext";
import { HubListItem } from "../../types";

const mockGetAllHubs = jest.fn();
const mockGetHubData = jest.fn();
const mockGetHubTheme = jest.fn();

jest.mock("../../../public/lib/hubOperations", () => ({
  getAllHubs: (...args: any[]) => mockGetAllHubs(...args),
  getHubslugFromUrl: (query: any) => {
    const hubUrl = query.hubUrl || query.hub;
    if (!hubUrl || !query.subHub) return hubUrl;
    const sub = Array.isArray(query.subHub) ? query.subHub[0] : query.subHub;
    return hubUrl + "_" + sub;
  },
}));
jest.mock("../../../public/lib/getHubData", () => ({
  getHubData: (...args: any[]) => mockGetHubData(...args),
}));
jest.mock("../../themes/fetchHubTheme", () => ({
  __esModule: true,
  default: (...args: any[]) => mockGetHubTheme(...args),
}));

const mockUseRouter = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => mockUseRouter(),
}));

const setRouter = (query: Record<string, any>, locale = "en") =>
  mockUseRouter.mockReturnValue({ query, locale });

// Renders the provider and lets the async hub data/theme fetch settle so that
// the resulting state updates happen inside `act()` (no console warnings).
const renderHubContext = (initialHubs?: HubListItem[]) => {
  const hook = renderHook(() => useContext(HubContext), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <HubProvider initialHubs={initialHubs}>{children}</HubProvider>
    ),
  });
  return hook;
};

const settleHubFetch = (result: ReturnType<typeof renderHubContext>["result"]) =>
  waitFor(() => expect(result.current.hubData).not.toBeNull());

describe("HubProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllHubs.mockResolvedValue([{ url_slug: "erlangen", name: "Erlangen" }]);
    mockGetHubData.mockResolvedValue({ url_slug: "erlangen" });
    mockGetHubTheme.mockResolvedValue({ primary: "#fff" });
  });

  it("exposes the active hub slug derived from the URL query", async () => {
    setRouter({ hubUrl: "erlangen" });
    const { result } = renderHubContext([]);
    expect(result.current.hubUrl).toBe("erlangen");
    await settleHubFetch(result);
  });

  it("falls back to ?hub= when no path param is present", async () => {
    setRouter({ hub: "marburg" });
    const { result } = renderHubContext([]);
    expect(result.current.hubUrl).toBe("marburg");
    await settleHubFetch(result);
  });

  it("resolves the composed slug on a sub-hub path", async () => {
    setRouter({ hubUrl: "erlangen", subHub: "zerowaste" });
    const { result } = renderHubContext([]);
    expect(result.current.hubUrl).toBe("erlangen_zerowaste");
    await settleHubFetch(result);
  });

  it("fetches the hubs list exactly once on the client when not provided by the server", async () => {
    setRouter({});
    renderHubContext(undefined);
    await waitFor(() => expect(mockGetAllHubs).toHaveBeenCalledTimes(1));
  });

  it("does NOT refetch the hubs list when the server already provided it", () => {
    setRouter({});
    renderHubContext([{ url_slug: "erlangen", name: "Erlangen" }]);
    expect(mockGetAllHubs).not.toHaveBeenCalled();
  });

  it("exposes the server-provided hubs list", () => {
    const hubs: HubListItem[] = [{ url_slug: "erlangen", name: "Erlangen" }];
    setRouter({});
    const { result } = renderHubContext(hubs);
    expect(result.current.hubs).toBe(hubs);
  });

  it("fetches hub data and theme on slug change, cached by slug", async () => {
    setRouter({ hubUrl: "erlangen" });
    const { result } = renderHubContext([]);
    await waitFor(() => {
      expect(result.current.hubData).toEqual({ url_slug: "erlangen" });
      expect(result.current.hubTheme).toEqual({ primary: "#fff" });
    });
    expect(mockGetHubData).toHaveBeenCalledWith("erlangen", "en");
    expect(mockGetHubTheme).toHaveBeenCalledWith("erlangen");
  });

  it("clears hub data/theme when no hub is active", () => {
    setRouter({});
    const { result } = renderHubContext([]);
    expect(result.current.hubData).toBeNull();
    expect(result.current.hubTheme).toBeNull();
  });
});

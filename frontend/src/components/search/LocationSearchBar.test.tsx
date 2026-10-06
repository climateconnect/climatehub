/**
 * Provider routing for LocationSearchBar.
 *
 * The LOCATIONIQ_AUTOCOMPLETE toggle is a rollback switch: with it off the
 * component must behave exactly as master did (direct browser -> Nominatim),
 * with it on it must go through the backend proxy and never touch
 * nominatim.openstreetmap.org directly. See
 * doc/spec/20260804_1202_locationiq_feature_toggle_and_result_caching.md.
 */

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import "@testing-library/jest-dom";

import theme from "../../themes/theme";

import axios from "axios";
import LocationSearchBar from "./LocationSearchBar";
import { apiRequest } from "../../../public/lib/apiOperations";
import { useFeatureToggles } from "../featureToggle";
import UserContext from "../context/UserContext";

jest.mock("axios");
jest.mock("../../../public/lib/apiOperations");
jest.mock("../featureToggle");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedUseFeatureToggles = useFeatureToggles as jest.MockedFunction<any>;

const NOMINATIM_HOST = "nominatim.openstreetmap.org";

const setToggle = ({ enabled, isLoading = false }: { enabled: boolean; isLoading?: boolean }) => {
  mockedUseFeatureToggles.mockReturnValue({
    toggles: { LOCATIONIQ_AUTOCOMPLETE: enabled },
    isEnabled: (feature: string, fallback = false) =>
      feature === "LOCATIONIQ_AUTOCOMPLETE" ? enabled : fallback,
    isLoading,
    error: null,
    environment: "development",
  });
};

// Must match LocationSearchBar's PROXY_DEBOUNCE_MS / DIRECT_NOMINATIM_DEBOUNCE_MS.
const PROXY_DEBOUNCE_MS = 400;
const DIRECT_NOMINATIM_DEBOUNCE_MS = 1000;

const renderSearchBar = () => {
  const { container } = render(
    <ThemeProvider theme={theme}>
      {/* The component reads locale and hubUrl from UserContext, whose default is null. */}
      <UserContext.Provider value={{ locale: "en", hubUrl: undefined } as any}>
        <LocationSearchBar label="Location" />
      </UserContext.Provider>
    </ThemeProvider>
  );
  return container.querySelector("input") as HTMLInputElement;
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

/**
 * Enter a search term and let the input debounce elapse, which is what actually
 * triggers the request. Defaults to the longer of the two debounces so a test
 * that doesn't care about timing fires on either provider path.
 */
const search = async (query: string, waitMs = DIRECT_NOMINATIM_DEBOUNCE_MS + 100) => {
  const input = renderSearchBar();
  fireEvent.change(input, { target: { value: query } });
  await advance(waitMs);
};

describe("LocationSearchBar provider routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Deliberately NOT `{ advanceTimers: true }`. That option advances the fake
    // clock by 20ms for every 20ms of *real* time, so a timer can fire without
    // anyone calling advanceTimersByTime — which makes "has not fired yet"
    // assertions depend on how fast the machine is. The debounce tests below
    // assert exactly that, so the clock has to move only when we move it.
    // waitFor drives fake timers itself (RTL 16 / dom-testing-library 10), so
    // nothing here needs the real clock.
    jest.useFakeTimers();
    mockedAxios.get.mockResolvedValue({ data: [] });
    mockedApiRequest.mockResolvedValue({ status: 200, data: [] } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls Nominatim directly when the toggle is off", async () => {
    setToggle({ enabled: false });

    await search("Berlin");

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
    expect(mockedAxios.get.mock.calls[0][0]).toContain(NOMINATIM_HOST);
    // The proxy must not be involved at all.
    const proxyCalls = mockedApiRequest.mock.calls.filter((call) =>
      call[0]?.url?.includes("/api/location_autocomplete/")
    );
    expect(proxyCalls).toHaveLength(0);
  });

  it("tracks the request for rate monitoring when the toggle is off", async () => {
    setToggle({ enabled: false });

    await search("Berlin");

    await waitFor(() =>
      expect(
        mockedApiRequest.mock.calls.some(
          (call) => call[0]?.url === "/api/autocomplete_request_count/"
        )
      ).toBe(true)
    );
  });

  it("uses the backend proxy and never calls Nominatim directly when the toggle is on", async () => {
    setToggle({ enabled: true });

    await search("Berlin");

    await waitFor(() =>
      expect(
        mockedApiRequest.mock.calls.some((call) =>
          call[0]?.url?.includes("/api/location_autocomplete/")
        )
      ).toBe(true)
    );
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it("waits a full second before calling Nominatim directly", async () => {
    // Regression guard. The proxy path was sped up to a 400ms debounce, which
    // is safe only because the backend caches, coalesces and rate-limits. Every
    // debounced keystroke on *this* path is a real request to OSM, whose usage
    // policy is 1 req/s, so it must keep master's 1000ms.
    setToggle({ enabled: false });

    const input = renderSearchBar();
    fireEvent.change(input, { target: { value: "Berlin" } });

    await advance(PROXY_DEBOUNCE_MS + 100);
    expect(mockedAxios.get).not.toHaveBeenCalled();

    await advance(DIRECT_NOMINATIM_DEBOUNCE_MS - PROXY_DEBOUNCE_MS);
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(1));
  });

  it("hits the proxy after 400ms, without waiting the full second", async () => {
    setToggle({ enabled: true });

    const input = renderSearchBar();
    fireEvent.change(input, { target: { value: "Berlin" } });

    await advance(PROXY_DEBOUNCE_MS + 100);

    await waitFor(() =>
      expect(
        mockedApiRequest.mock.calls.some((call) =>
          call[0]?.url?.includes("/api/location_autocomplete/")
        )
      ).toBe(true)
    );
  });

  it("fires nothing while the toggles are still loading", async () => {
    // Guards against sending the very first query to the wrong provider.
    setToggle({ enabled: true, isLoading: true });

    await search("Berlin");

    expect(mockedAxios.get).not.toHaveBeenCalled();
    const autocompleteCalls = mockedApiRequest.mock.calls.filter((call) =>
      call[0]?.url?.includes("/api/location_autocomplete/")
    );
    expect(autocompleteCalls).toHaveLength(0);
  });
});

import { replaceUrlKeepingRouterState } from "./replaceUrl";

describe("replaceUrlKeepingRouterState", () => {
  it("keeps the Next.js router state and updates url/as", () => {
    const nextState = {
      url: "/events",
      as: "/events",
      options: { locale: "en" },
      __N: true,
      key: "abc",
    };
    window.history.replaceState(nextState, "", "/events");

    replaceUrlKeepingRouterState(`${window.location.origin}/events?date=2026-11-24`);

    expect(window.location.pathname + window.location.search).toBe("/events?date=2026-11-24");
    expect(window.history.state).toEqual({
      ...nextState,
      url: "/events?date=2026-11-24",
      as: "/events?date=2026-11-24",
    });
  });

  it("leaves non-Next state untouched", () => {
    window.history.replaceState(null, "", "/events");

    replaceUrlKeepingRouterState("/events?search=tree");

    expect(window.location.search).toBe("?search=tree");
    expect(window.history.state).toBeNull();
  });
});

import { getHubslugFromUrl } from "./hubOperations";

describe("getHubslugFromUrl", () => {
  it("resolves the hub slug from the ?hub= query param", () => {
    expect(getHubslugFromUrl({ hub: "erlangen" })).toBe("erlangen");
  });

  it("resolves the hub slug from the /hubs/<slug> path param (preferred)", () => {
    expect(getHubslugFromUrl({ hubUrl: "erlangen" })).toBe("erlangen");
  });

  it("prefers the path param over ?hub= when both are present", () => {
    expect(getHubslugFromUrl({ hubUrl: "erlangen", hub: "marburg" })).toBe("erlangen");
  });

  it("composes the sub-hub slug from a sub-hub path (/hubs/<slug>/<subHub>/browse)", () => {
    expect(getHubslugFromUrl({ hubUrl: "erlangen", subHub: "zerowaste" })).toBe(
      "erlangen_zerowaste"
    );
  });

  it("returns undefined when no hub is present", () => {
    expect(getHubslugFromUrl({})).toBeUndefined();
  });
});

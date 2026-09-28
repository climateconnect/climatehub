import { GetServerSidePropsContext } from "next";
import { getHubBrowseTypeServerSideProps } from "./getHubBrowseTypeServerSideProps";
import { getHubDataResult } from "./getHubData";

jest.mock("./getHubData", () => ({
  getHubDataResult: jest.fn(),
  getLinkedHubsData: jest.fn().mockResolvedValue([]),
}));
jest.mock("./getOptions", () => ({
  getOrganizationTagsOptions: jest.fn().mockResolvedValue([]),
  getSkillsOptions: jest.fn().mockResolvedValue([]),
  getSectorOptions: jest.fn().mockResolvedValue([]),
}));
jest.mock("./locationOperations", () => ({
  getLocationFilteredBy: jest.fn().mockResolvedValue(null),
}));
jest.mock("./hubOperations", () => ({
  ...jest.requireActual("./hubOperations"),
  getAllHubs: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../src/themes/fetchHubTheme", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(null),
}));

const mockedGetHubData = getHubDataResult as jest.MockedFunction<typeof getHubDataResult>;

const HUB = { url_slug: "erlangen", name: "Erlangen" } as any;

const makeCtx = (query: Record<string, string>, locale = "en") =>
  (({ query, locale } as unknown) as GetServerSidePropsContext);

// Known slugs resolve to a hub, failing slugs behave like a 5xx/timeout,
// every other slug behaves like an API 404.
const knownHubs = (slugs: string[] = [], failing: string[] = []) =>
  mockedGetHubData.mockImplementation(async (slug) => {
    if (slugs.includes(slug)) return { hubData: { ...HUB, url_slug: slug }, notFound: false };
    if (failing.includes(slug)) return { hubData: null, notFound: false };
    return { hubData: null, notFound: true };
  });

describe("getHubBrowseTypeServerSideProps", () => {
  beforeEach(() => {
    mockedGetHubData.mockReset();
  });

  it("returns props when the hub exists", async () => {
    knownHubs(["erlangen"]);

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "erlangen" }),
      "projects"
    );

    expect(result.redirect).toBeUndefined();
    expect(result.props.hubData.url_slug).toBe("erlangen");
    expect(mockedGetHubData).toHaveBeenCalledTimes(1);
  });

  it("looks up a sub-hub as parent_sub and does not look up the parent when it exists", async () => {
    knownHubs(["erlangen_zerowaste"]);

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "erlangen", subHub: "zerowaste" }),
      "projects"
    );

    expect(result.props.browseHubSlug).toBe("erlangen_zerowaste");
    expect(mockedGetHubData).toHaveBeenCalledTimes(1);
    expect(mockedGetHubData).toHaveBeenCalledWith("erlangen_zerowaste", "en");
  });

  it.each([
    ["projects", "/browse"],
    ["members", "/members"],
    ["organizations", "/organizations"],
  ])("redirects an unknown hub on the %s page to %s", async (type, destination) => {
    knownHubs();

    const result: any = await getHubBrowseTypeServerSideProps(makeCtx({ hubUrl: "x" }), type);

    expect(result).toEqual({ redirect: { destination, permanent: false } });
    // no sub-hub segment, so no parent lookup
    expect(mockedGetHubData).toHaveBeenCalledTimes(1);
  });

  it("keeps the locale prefix and never appends ?hub=", async () => {
    knownHubs();

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "x" }, "de"),
      "projects"
    );

    expect(result.redirect.destination).toBe("/de/browse");
  });

  it.each([
    ["projects", "/hubs/erlangen/browse"],
    ["members", "/hubs/erlangen/members"],
    ["organizations", "/hubs/erlangen/organizations"],
  ])(
    "redirects an unknown sub-hub under an existing parent on the %s page to %s",
    async (type, destination) => {
      knownHubs(["erlangen"]);

      const result: any = await getHubBrowseTypeServerSideProps(
        makeCtx({ hubUrl: "erlangen", subHub: "nope" }),
        type
      );

      expect(result).toEqual({ redirect: { destination, permanent: false } });
      expect(mockedGetHubData).toHaveBeenCalledWith("erlangen", "en");
    }
  );

  it("keeps the locale prefix when redirecting to the parent hub", async () => {
    knownHubs(["erlangen"]);

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "erlangen", subHub: "nope" }, "de"),
      "projects"
    );

    expect(result.redirect.destination).toBe("/de/hubs/erlangen/browse");
  });

  it("redirects to the global page when neither the sub-hub nor the parent exists", async () => {
    knownHubs();

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "x", subHub: "y" }),
      "projects"
    );

    expect(result).toEqual({ redirect: { destination: "/browse", permanent: false } });
  });

  it("renders the page instead of redirecting when the hub request fails with a non-404 error", async () => {
    knownHubs([], ["erlangen"]);

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "erlangen" }),
      "projects"
    );

    expect(result.redirect).toBeUndefined();
    expect(result.props.hubData).toBeNull();
  });

  it("renders the sub-hub page when the sub-hub request fails with a non-404 error", async () => {
    knownHubs(["erlangen"], ["erlangen_zerowaste"]);

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "erlangen", subHub: "zerowaste" }),
      "projects"
    );

    expect(result.redirect).toBeUndefined();
    expect(mockedGetHubData).toHaveBeenCalledTimes(1);
  });

  it("stays in the parent hub when the sub-hub is unknown and the parent request fails", async () => {
    knownHubs([], ["erlangen"]);

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "erlangen", subHub: "nope" }),
      "projects"
    );

    expect(result).toEqual({
      redirect: { destination: "/hubs/erlangen/browse", permanent: false },
    });
  });
});

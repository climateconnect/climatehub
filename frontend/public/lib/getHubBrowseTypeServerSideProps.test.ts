import { GetServerSidePropsContext } from "next";
import { getHubBrowseTypeServerSideProps } from "./getHubBrowseTypeServerSideProps";
import { getHubData } from "./getHubData";

jest.mock("./getHubData", () => ({
  getHubData: jest.fn(),
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

const mockedGetHubData = getHubData as jest.MockedFunction<typeof getHubData>;

const HUB = { url_slug: "erlangen", name: "Erlangen" } as any;

const makeCtx = (query: Record<string, string>, locale = "en") =>
  (({ query, locale } as unknown) as GetServerSidePropsContext);

// Resolve getHubData only for the given slugs, null for everything else.
const knownHubs = (...slugs: string[]) =>
  mockedGetHubData.mockImplementation(async (slug) =>
    slugs.includes(slug) ? { ...HUB, url_slug: slug } : null
  );

describe("getHubBrowseTypeServerSideProps", () => {
  beforeEach(() => {
    mockedGetHubData.mockReset();
  });

  it("returns props when the hub exists", async () => {
    knownHubs("erlangen");

    const result: any = await getHubBrowseTypeServerSideProps(
      makeCtx({ hubUrl: "erlangen" }),
      "projects"
    );

    expect(result.redirect).toBeUndefined();
    expect(result.props.hubData.url_slug).toBe("erlangen");
    expect(mockedGetHubData).toHaveBeenCalledTimes(1);
  });

  it("looks up a sub-hub as parent_sub and does not look up the parent when it exists", async () => {
    knownHubs("erlangen_zerowaste");

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
      knownHubs("erlangen");

      const result: any = await getHubBrowseTypeServerSideProps(
        makeCtx({ hubUrl: "erlangen", subHub: "nope" }),
        type
      );

      expect(result).toEqual({ redirect: { destination, permanent: false } });
      expect(mockedGetHubData).toHaveBeenCalledWith("erlangen", "en");
    }
  );

  it("keeps the locale prefix when redirecting to the parent hub", async () => {
    knownHubs("erlangen");

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
});

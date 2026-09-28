import { getHubData, getHubDataResult } from "./getHubData";
import { apiRequest } from "./apiOperations";

jest.mock("./apiOperations", () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

const httpError = (status: number) =>
  Object.assign(new Error(`status ${status}`), {
    response: { status, data: { detail: "error" } },
  });

describe("getHubDataResult", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the hub data when the hub exists", async () => {
    mockedApiRequest.mockResolvedValue({ data: { url_slug: "erlangen" } } as any);

    await expect(getHubDataResult("erlangen", "en")).resolves.toEqual({
      hubData: { url_slug: "erlangen" },
      notFound: false,
    });
  });

  it("flags notFound when the API answers 404", async () => {
    mockedApiRequest.mockRejectedValue(httpError(404));

    await expect(getHubDataResult("x", "en")).resolves.toEqual({
      hubData: null,
      notFound: true,
    });
  });

  it("does not flag notFound on a 5xx error", async () => {
    mockedApiRequest.mockRejectedValue(httpError(500));

    await expect(getHubDataResult("erlangen", "en")).resolves.toEqual({
      hubData: null,
      notFound: false,
    });
  });

  it("does not flag notFound on a network error without a response", async () => {
    mockedApiRequest.mockRejectedValue(new Error("timeout"));

    await expect(getHubDataResult("erlangen", "en")).resolves.toEqual({
      hubData: null,
      notFound: false,
    });
  });
});

describe("getHubData", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("still returns null for an unknown hub", async () => {
    mockedApiRequest.mockRejectedValue(httpError(404));

    await expect(getHubData("x", "en")).resolves.toBeNull();
  });
});

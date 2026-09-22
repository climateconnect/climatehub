import { getIsUserFollowing, getUserOrganizations } from "./organizationOperations";
import { apiRequest } from "./apiOperations";

jest.mock("./apiOperations", () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

describe("getUserOrganizations", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("returns [] without calling the API when there is no auth token", async () => {
    await expect(getUserOrganizations(undefined, "en")).resolves.toEqual([]);
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it("returns [] (not null) when the user has no organizations", async () => {
    mockedApiRequest.mockResolvedValue({ data: [] } as any);

    await expect(getUserOrganizations("token", "en")).resolves.toEqual([]);
  });

  it("returns [] (not null) when the request fails", async () => {
    mockedApiRequest.mockRejectedValue(new Error("network error"));

    await expect(getUserOrganizations("token", "en")).resolves.toEqual([]);
  });

  it("returns the mapped organizations when the user has memberships", async () => {
    mockedApiRequest.mockResolvedValue({
      data: [{ organization: { url_slug: "org-a" } }, { organization: { url_slug: "org-b" } }],
    } as any);

    await expect(getUserOrganizations("token", "en")).resolves.toEqual([
      { url_slug: "org-a" },
      { url_slug: "org-b" },
    ]);
  });
});
describe("getIsUserFollowing", () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it("skips the follow-status request for guest users", async () => {
    await expect(getIsUserFollowing("my-org", undefined, "en")).resolves.toBeNull();
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it("requests the follow-status endpoint for authenticated users", async () => {
    mockedApiRequest.mockResolvedValue({ data: { is_following: true } } as any);

    await expect(getIsUserFollowing("my-org", "token", "en")).resolves.toBe(true);
    expect(mockedApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        url: "/api/organizations/my-org/am_i_following/",
        token: "token",
        locale: "en",
      })
    );
  });
});

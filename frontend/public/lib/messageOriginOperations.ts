import { apiRequest } from "./apiOperations";

export type OrganizationOriginContext = {
  organization_name: string;
  organization_url_slug: string;
};

const organizationOriginCache = new Map<number, OrganizationOriginContext | null>();
const pendingOrganizationOrigins = new Map<number, Promise<OrganizationOriginContext | null>>();

// Resolves to null (no chip / no note) if the organization is gone or not accessible.
export const fetchOrganizationOriginContext = async (
  organizationId: number,
  token?: string,
  locale?: string
): Promise<OrganizationOriginContext | null> => {
  if (!organizationId || organizationId <= 0) return null;
  if (organizationOriginCache.has(organizationId)) {
    return organizationOriginCache.get(organizationId) ?? null;
  }
  const pending = pendingOrganizationOrigins.get(organizationId);
  if (pending) return pending;

  const request = apiRequest({
    method: "get",
    url: `/api/organization-origin/${organizationId}/`,
    token,
    locale,
  })
    .then((response) => {
      const data = response.data as OrganizationOriginContext;
      organizationOriginCache.set(organizationId, data);
      return data;
    })
    .catch((error) => {
      console.warn("Failed to resolve organization origin context", error);
      organizationOriginCache.set(organizationId, null);
      return null;
    })
    .finally(() => {
      pendingOrganizationOrigins.delete(organizationId);
    });

  pendingOrganizationOrigins.set(organizationId, request);
  return request;
};

// Public organization lookup. The origin resolver is not usable here: before the first
// tagged message the sender is neither a chat participant of an origin chat nor an admin.
export const getOrganizationOriginBySlug = async (
  organizationUrlSlug: string,
  token?: string,
  locale?: string
): Promise<{ id: number; name: string } | null> => {
  try {
    const response = await apiRequest({
      method: "get",
      url: `/api/organizations/${organizationUrlSlug}/`,
      token,
      locale,
    });
    if (!response.data?.id) return null;
    return { id: response.data.id, name: response.data.name };
  } catch (error) {
    console.warn("Failed to resolve organization by slug", error);
    return null;
  }
};

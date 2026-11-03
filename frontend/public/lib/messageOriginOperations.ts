import { apiRequest } from "./apiOperations";

export type EventRegistrationOriginContext = {
  type: "event_registration";
  event_name: string;
  event_url_slug: string;
};

export type ProjectOriginContext = {
  type: "project";
  project_name: string;
  project_url_slug: string;
  // Short project type id as stored on the backend: PR (project), ID (idea), EV (event)
  project_type: string;
};

export type OrganizationOriginContext = {
  type: "organization";
  organization_name: string;
  organization_url_slug: string;
};

export type OriginContext =
  | EventRegistrationOriginContext
  | ProjectOriginContext
  | OrganizationOriginContext;
export type OriginType = OriginContext["type"];

// eslint-disable-next-line no-unused-vars
const ORIGIN_URLS: Record<OriginType, (id: number) => string> = {
  event_registration: (id) => `/api/event-registration-origin/${id}/`,
  project: (id) => `/api/project-origin/${id}/`,
  organization: (id) => `/api/organization-origin/${id}/`,
};

export const isSupportedOriginType = (originType?: string): originType is OriginType =>
  !!originType && originType in ORIGIN_URLS;

const originContextCache = new Map<string, OriginContext | null>();
const pendingOriginContextRequests = new Map<string, Promise<OriginContext | null>>();

export const fetchOriginContext = async (
  originType: OriginType,
  originId: number,
  token?: string,
  locale?: string
): Promise<OriginContext | null> => {
  if (!originId || originId <= 0) return null;
  const key = `${originType}:${originId}`;
  if (originContextCache.has(key)) return originContextCache.get(key) ?? null;
  const pending = pendingOriginContextRequests.get(key);
  if (pending) return pending;

  const request = apiRequest({
    method: "get",
    url: ORIGIN_URLS[originType](originId),
    token,
    locale,
  })
    .then((response) => {
      const data = { ...response.data, type: originType } as OriginContext;
      originContextCache.set(key, data);
      return data;
    })
    .catch((error) => {
      console.warn(`Failed to resolve ${originType} origin context`, error);
      originContextCache.set(key, null);
      return null;
    })
    .finally(() => {
      pendingOriginContextRequests.delete(key);
    });

  pendingOriginContextRequests.set(key, request);
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

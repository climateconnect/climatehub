import { apiRequest } from "./apiOperations";

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export type JoinRequestUserStub = {
  url_slug: string;
  first_name: string;
  last_name: string;
  image?: string;
  location?: string;
};

export type JoinRequestDetail = {
  id: number;
  user_profile: JoinRequestUserStub;
  message: string;
  requested_at: string;
  request_status: JoinRequestStatus;
  decided_at: string | null;
  // only present for project admins
  decided_by?: JoinRequestUserStub | null;
};

export async function getJoinRequest(
  urlSlug: string,
  requestId: number | string,
  locale: string,
  token?: string
): Promise<JoinRequestDetail> {
  const resp = await apiRequest<JoinRequestDetail>({
    method: "get",
    url: `/api/projects/${urlSlug}/join_requests/${requestId}/`,
    locale: locale as any,
    token,
  });
  return resp.data;
}

export async function decideJoinRequest(
  urlSlug: string,
  requestId: number | string,
  action: "approve" | "reject",
  locale: string,
  token?: string
) {
  return apiRequest({
    method: "post",
    url: `/api/projects/${urlSlug}/request_membership/${action}/${requestId}/`,
    locale: locale as any,
    token,
    payload: {},
  });
}

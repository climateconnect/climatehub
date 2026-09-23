import { apiRequest } from "./apiOperations";

export async function getMessageFromServer(message_id, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/message/" + message_id + "/",
      token: token,
      locale: locale,
    });
    return resp.data;
  } catch (error) {
    console.error(error);
  }
}

export async function startPrivateChat(profile, token, locale) {
  try {
    const resp = await apiRequest({
      method: "post",
      url: "/api/start_private_chat/",
      payload: { profile_url_slug: profile.url_slug },
      token: token,
      locale: locale,
    });
    return resp.data;
  } catch (e) {
    console.error(e);
  }
}

export async function joinIdeaGroupChat({ idea, token, locale }) {
  try {
    const resp = await apiRequest({
      method: "post",
      url: `/api/ideas/${idea.url_slug}/join_chat/`,
      payload: {},
      token: token,
      locale: locale,
    });
    return resp.data;
  } catch (error) {
    console.error(error);
  }
}

export const parseParticipants = (participants, user) => {
  return participants.map((p) => ({
    ...p.user_profile,
    role: p.role,
    created_at: p.created_at,
    is_self: user.id === p.user_profile.id,
    participant_id: p.participant_id,
  }));
};

export const parseParticipantsWithRole = (participants, rolesOptions) => {
  return participants.map((p) => ({
    ...p,
    role: rolesOptions.find((o) => o.role_type === p.role.role_type),
  }));
};

export async function getChat(chat_uuid, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/chat/" + chat_uuid + "/",
      token: token,
      locale: locale,
    });
    return {
      participants: parseParticipants(resp.data.participants, resp.data.user),
      title: resp.data.name,
      id: resp.data.id,
      idea: resp.data.related_idea,
    };
  } catch (e: any) {
    console.log(e?.response);
  }
}

export async function getChatMessagesByUUID(chat_uuid, token, page, link, locale) {
  try {
    const url = link
      ? link
      : process.env.API_URL + "/api/messages/?chat_uuid=" + chat_uuid + "&page=" + page;
    const resp = await apiRequest({
      method: "get",
      url: url.replace(process.env.API_URL, ""),
      token: token,
      locale: locale,
    });
    return {
      messages: resp.data.results,
      hasMore: !!resp.data.next && resp.data.next !== link,
      nextLink: resp.data.next,
    };
  } catch (err) {
    console.log("error!");
    console.log(err);
    return null;
  }
}

export async function getRolesOptions(locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/roles/",
      locale: locale,
    });
    if (resp.data.results.length === 0) return null;
    else {
      return resp.data.results;
    }
  } catch (err: any) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

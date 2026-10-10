import { HubData, LinkedHub, LocaleType } from "../../src/types";
import { apiRequest } from "./apiOperations";

type HubDataResult = {
  hubData: HubData | null;
  // true only when the API answered 404, i.e. the hub really does not exist.
  // Other failures (5xx, timeout, network) leave this false.
  notFound: boolean;
};

const getHubDataResult = async (url_slug: string, locale: LocaleType): Promise<HubDataResult> => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/hubs/${url_slug}/`,
      locale: locale,
    });
    return { hubData: resp.data, notFound: false };
  } catch (err: any) {
    if (err?.response?.status === 404) {
      return { hubData: null, notFound: true };
    }
    if (err.response && err.response.data) {
      console.log(err.response.data);
      console.error("Error in getHubData!: " + err.response?.data?.detail || err.message || err);
    }
    return { hubData: null, notFound: false };
  }
};

const getHubData = async (url_slug: string, locale: LocaleType): Promise<HubData | null> =>
  (await getHubDataResult(url_slug, locale)).hubData;

const getHubAmbassadorData = async (url_slug, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/hubs/${url_slug}/ambassador/`,
      locale: locale,
    });
    return resp.data;
  } catch (err: any) {
    if (err.response && err.response.data)
      console.log("Error in getHubAmbassadorData: " + err.response.data.detail);
    console.log(err);
    return null;
  }
};
const getHubSupportersData = async (url_slug, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/hubs/${url_slug}/supporters/`,
      locale: locale,
    });
    return resp.data;
  } catch (err: any) {
    //Don't log an error if there simply are no supporters for this hub
    if (err?.response?.status === 404) {
      return null;
    }
    if (err.response && err.response.data)
      console.log("Error in getHubSupportersData: " + err.response.data.detail);
    console.log(err);
    return null;
  }
};

function parseLinkedHubData(data: any): LinkedHub | null {
  if (!data || !data.name || !data.url_slug || !data.icon) {
    console.error("Invalid linked hub data:", data);
    return null;
  }
  const url_segments = data.url_slug.split("_");
  let hubUrl;
  if (url_segments.length == 1) {
    hubUrl = `/hubs/${url_segments[0]}/browse`;
  } else {
    hubUrl = `/hubs/${url_segments[0]}/${url_segments[1]}/browse`;
  }

  return {
    hubName: data.name,
    hubUrl: hubUrl,
    icon: data.icon,
    backgroundColor: data.icon_background_color,
  };
}

const getLinkedHubsData = async (url_slug: string) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/hubs/${url_slug}/linkedhubs/`,
    });
    if (!resp.data) {
      console.error("No data received from getLinkedHubsData");
      return null;
    }

    const arr: (LinkedHub | null)[] = [];

    // Parse the parent hub first, if it exists
    if (resp.data?.parent) {
      arr.push(parseLinkedHubData(resp.data.parent) || null);
    }

    // Parse the siblings then, if it exists
    if (resp.data?.siblings) {
      resp.data.siblings.forEach((hub: any) => {
        arr.push(parseLinkedHubData(hub) || null);
      });
    }

    // Parse the children last, if it exists
    if (resp.data?.children) {
      resp.data.children.forEach((hub: any) => {
        arr.push(parseLinkedHubData(hub) || null);
      });
    }

    // filter out the null values
    const ret: LinkedHub[] = arr.filter((hub): hub is LinkedHub => hub !== null);
    return ret;
  } catch (err: any) {
    if (err.response && err.response.data) {
      console.log(err.response.data);
      console.error("Error in getLinkedHubsData!: " + err.response.data.detail);
    }
    return null;
  }
};

export {
  getHubData,
  getHubDataResult,
  getHubAmbassadorData,
  getHubSupportersData,
  getLinkedHubsData,
};

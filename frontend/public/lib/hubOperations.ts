import { apiRequest, getLocalePrefix } from "./apiOperations";
import { GetServerSidePropsContext } from "next";
import { getHubData } from "./getHubData";
import { LocaleType } from "../../src/types";

/**
 * Factory that creates a `getServerSideProps` function for a static hub landing page.
 * If the hub data cannot be fetched the user is redirected to the hub's browse page.
 */
export function createHubLandingPageServerSideProps(hubUrl: string) {
  return async (ctx: GetServerSidePropsContext) => {
    const locale = ctx.locale;
    const hubData = await getHubData(hubUrl, locale as LocaleType);

    if (!hubData) {
      const localePrefix = getLocalePrefix(locale ?? "en");
      return {
        redirect: {
          destination: `${localePrefix}/hubs/${hubUrl}/browse`,
          permanent: false,
        },
      };
    }

    return { props: { hubData } };
  };
}

export function extractHubUrlsFromContext(ctx: GetServerSidePropsContext) {
  const hubUrl = ctx.query.hubUrl;
  const subHub = ctx.query.subHub;

  if (!subHub) {
    return { hubUrl, subHub: undefined };
  }

  return { hubUrl, subHub: hubUrl + "_" + subHub };
}

export function getHubslugFromUrl(query) {
  const hubUrl = query.hubUrl || query.hub;
  if (!hubUrl || !query.subHub) return hubUrl;
  const sub = Array.isArray(query.subHub) ? query.subHub[0] : query.subHub;
  return hubUrl + "_" + sub;
}

export async function getAllHubs(locale: any, just_sector_hubs?: boolean) {
  const url = just_sector_hubs ? `/api/sector_hubs/` : `/api/hubs/`;
  try {
    const resp = await apiRequest({
      method: "get",
      url: url,
      locale: locale,
    });

    return resp.data.results;
  } catch (err: any) {
    if (err.response && err.response.data)
      console.log("Error in getHubData: " + err.response.data.detail);
    console.log(err);
    return null;
  }
}

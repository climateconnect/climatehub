import { GetServerSidePropsContext } from "next";
import { getOrganizationTagsOptions, getSkillsOptions, getSectorOptions } from "./getOptions";
import { getLocationFilteredBy } from "./locationOperations";
import { extractHubUrlsFromContext, getAllHubs } from "./hubOperations";
import { getHubData, getLinkedHubsData } from "./getHubData";
import getHubTheme from "../../src/themes/fetchHubTheme";
import isLocationHubLikeHub from "./isLocationHubLikeHub";
import { LocaleType } from "../../src/types";

export async function getHubBrowseTypeServerSideProps(
  ctx: GetServerSidePropsContext,
  internalType: string
) {
  const locale = ctx.locale as LocaleType;
  let hubUrl = Array.isArray(ctx.query.hubUrl) ? ctx.query.hubUrl[0] : ctx.query.hubUrl ?? "";
  const subHubSegment = Array.isArray(ctx.query.subHub)
    ? ctx.query.subHub[0]
    : ctx.query.subHub ?? null;
  const parentHubUrl = hubUrl;
  const { subHub } = extractHubUrlsFromContext(ctx);
  if (subHub) hubUrl = subHub;

  const [
    hubData,
    organization_types,
    skills,
    location_filtered_by,
    allHubs,
    hubThemeData,
    linkedHubs,
    sectorOptions,
  ] = await Promise.all([
    getHubData(hubUrl, locale),
    getOrganizationTagsOptions(locale),
    getSkillsOptions(locale),
    getLocationFilteredBy(ctx.query, locale),
    getAllHubs(locale, false),
    getHubTheme(parentHubUrl),
    getLinkedHubsData(hubUrl),
    getSectorOptions(locale, hubUrl),
  ]);

  const filterChoices: any = {};
  if (internalType === "projects" || internalType === "organizations") {
    filterChoices.organization_types = organization_types;
    filterChoices.sectors = sectorOptions;
    filterChoices.skills = skills;
  } else if (internalType === "members") {
    filterChoices.sectors = sectorOptions;
    filterChoices.skills = skills;
  }

  return {
    props: {
      hubUrl: ctx.query.hubUrl,
      browseHubSlug: hubUrl,
      subHubSegment: subHubSegment || null,
      isLocationHub: isLocationHubLikeHub(hubData?.hub_type, hubData?.parent_hub),
      hubData,
      filterChoices,
      initialLocationFilter: location_filtered_by,
      allHubs,
      hubThemeData,
      linkedHubs: linkedHubs || [],
    },
  };
}

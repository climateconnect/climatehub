import NextCookies from "next-cookies";
import React, { useContext } from "react";
import Cookies from "universal-cookie";
import { apiRequest } from "../../public/lib/apiOperations";
import getTexts from "../../public/texts/texts";
import PageNotFound from "../../src/components/general/PageNotFound";
import WideLayout from "../../src/components/layouts/WideLayout";
import ProfileRoot from "../../src/components/profile/ProfileRoot";
import getProfileInfoMetadata from "./../../public/data/profile_info_metadata";
import { nullifyUndefinedValues, parseProfile } from "./../../public/lib/profileOperations";
import UserContext from "./../../src/components/context/UserContext";
import getHubTheme from "../../src/themes/fetchHubTheme";
import { transformThemeData } from "../../src/themes/transformThemeData";
import theme from "../../src/themes/theme";
import { parseOrganizationStubs, parseProjectStubs } from "../../public/lib/parsingOperations";
import HubsSubHeader from "../../src/components/indexPage/hubsSubHeader/HubsSubHeader";
import { getAllHubs } from "../../public/lib/hubOperations";

export async function getServerSideProps(ctx) {
  const { auth_token } = NextCookies(ctx);
  const profileUrl = encodeURI(ctx.query.profileUrl);
  // Prevent API calls with undefined or literal route-pattern slugs
  // see https://github.com/climateconnect/climateconnect/issues/1796
  if (profileUrl === "undefined" || profileUrl === "[profileUrl]") {
    return {
      props: nullifyUndefinedValues({
        profile: null,
        organizations: null,
        organizationsHasMore: false,
        projects: null,
        projectsHasMore: false,
        hubUrl: ctx.query.hub,
        hubThemeData: null,
      }),
    };
  }
  const hubUrl = ctx.query.hub;
  const [profile, organizationsData, projectsData, hubThemeData, hubs] = await Promise.all([
    getProfileByUrlIfExists(profileUrl, auth_token, ctx.locale),
    getOrganizationsByUser(profileUrl, auth_token, ctx.locale),
    getProjectsByUser(profileUrl, auth_token, ctx.locale),
    getHubTheme(hubUrl),
    getAllHubs(ctx.locale),
  ]);
  return {
    props: nullifyUndefinedValues({
      profile: profile,
      organizations: organizationsData?.organizations ?? null,
      organizationsHasMore: organizationsData?.hasMore ?? false,
      projects: projectsData?.projects ?? null,
      projectsHasMore: projectsData?.hasMore ?? false,
      hubUrl: hubUrl,
      hubThemeData: hubThemeData,
      hubs: hubs,
    }),
  };
}

export default function ProfilePage({
  profile,
  projects,
  projectsHasMore,
  organizations,
  organizationsHasMore,
  hubUrl,
  hubThemeData,
  hubs,
}) {
  const token = new Cookies().get("auth_token");
  const { user, locale, CUSTOM_HUB_URLS } = useContext(UserContext);
  const infoMetadata = getProfileInfoMetadata(locale);
  const texts = getTexts({ page: "profile", locale: locale, profile: profile });

  const isOwnProfile = !!(user && profile && user.url_slug === profile.url_slug);
  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);
  const defaultBackUrl = hubUrl ? "/" + locale + "/hubs/" + hubUrl : "/" + locale;

  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;
  return (
    <WideLayout
      title={profile ? texts.persons_profile : texts.not_found}
      description={
        profile
          ? profile.name +
            " | " +
            profile.info.location +
            (profile.info.bio ? " | " + profile.info.bio : "")
          : texts.not_found
      }
      hubUrl={hubUrl}
      showDonationGoal={true}
      customTheme={customTheme}
      headerBackground={
        customTheme ? customTheme.palette.header.background : theme.palette.background.default
      }
      subHeader={
        profile && !isOwnProfile ? (
          <HubsSubHeader
            hubs={hubs}
            onlyShowDropDown={true}
            isCustomHub={isCustomHub}
            hubSlug={hubUrl}
            defaultBackUrl={defaultBackUrl}
          />
        ) : (
          <></>
        )
      }
    >
      {profile ? (
        <ProfileRoot
          profile={profile}
          projects={projects}
          projectsHasMore={projectsHasMore}
          organizations={organizations}
          organizationsHasMore={organizationsHasMore}
          infoMetadata={infoMetadata}
          user={user}
          token={token}
          texts={texts}
          locale={locale}
          hubUrl={hubUrl}
        />
      ) : (
        <PageNotFound itemName="Profile" />
      )}
    </WideLayout>
  );
}

async function getProfileByUrlIfExists(profileUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/member/" + profileUrl + "/",
      token: token,
      locale: locale,
    });

    return parseProfile(resp.data, false);
  } catch (err) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    console.log("error!");
    console.log(err);
    return null;
  }
}

async function getProjectsByUser(profileUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/member/" + profileUrl + "/projects/",
      token: token,
      locale: locale,
    });
    if (!resp.data) return null;
    else {
      return {
        projects: parseProjectStubs(resp.data.results),
        hasMore: !!resp.data.next,
      };
    }
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getOrganizationsByUser(profileUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/member/" + profileUrl + "/organizations/",
      token: token,
      locale: locale,
    });
    if (!resp.data) return null;
    else {
      return {
        organizations: parseOrganizationStubs(resp.data.results),
        hasMore: !!resp.data.next,
      };
    }
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

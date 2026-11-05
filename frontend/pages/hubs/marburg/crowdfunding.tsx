import React from "react";
import { GetServerSidePropsContext } from "next";
import { SpendenMarburg } from "../../../devlink/SpendenMarburg";
import DevlinkPage from "../../../src/components/devlink/DevlinkPage";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { getHubData } from "../../../public/lib/getHubData";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import { HubData, LocaleType } from "../../../src/types";

const HUB_URL = "marburg";

// This page only exists in German. Other locales (e.g. after switching the
// language) are redirected to the hub's browse page.
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const locale = ctx.locale ?? "en";
  if (locale !== "de") {
    return {
      redirect: {
        destination: `${getLocalePrefix(locale)}/hubs/${HUB_URL}/browse`,
        permanent: false,
      },
    };
  }

  const hubData = await getHubData(HUB_URL, locale as LocaleType);
  return { props: { hubData: hubData ?? null } };
}

export default function MarburgCrowdfundingPage({ hubData }: { hubData: HubData | null }) {
  return (
    <DevlinkPage
      title={`Crowdfunding | ClimateHub ${hubData?.name ?? "Marburg"}`}
      isHubPage={true}
      hubUrl={HUB_URL}
      isLandingPage={true}
      isLocationHub={hubData ? isLocationHubLikeHub(hubData.hub_type) : true}
    >
      <SpendenMarburg />
    </DevlinkPage>
  );
}

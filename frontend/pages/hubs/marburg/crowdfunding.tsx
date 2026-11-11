import React, { useContext } from "react";
import { Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import { GetServerSidePropsContext } from "next";
import { SpendenMarburg } from "../../../devlink/SpendenMarburg";
import UserContext from "../../../src/components/context/UserContext";
import DevlinkPage from "../../../src/components/devlink/DevlinkPage";
import StaticDevlinkComponent from "../../../src/components/devlink/StaticDevlinkComponent";
import DonationGoal from "../../../src/components/staticpages/donate/DonationGoal";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { getHubData } from "../../../public/lib/getHubData";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import { HubData, LocaleType } from "../../../src/types";

const HUB_URL = "marburg";

const DonationGoalContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(1),
}));

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
  const { donationGoals } = useContext(UserContext);
  // Only show the hub's own goal: the backend only returns goals that are currently running
  const donationGoal = donationGoals?.find((goal) => goal.hub === HUB_URL);

  return (
    <DevlinkPage
      title={`Crowdfunding | ClimateHub ${hubData?.name ?? "Marburg"}`}
      isHubPage={true}
      hubUrl={HUB_URL}
      isLandingPage={true}
      isLocationHub={hubData ? isLocationHubLikeHub(hubData.hub_type) : true}
    >
      {!!donationGoal?.goal_amount && (
        <DonationGoalContainer maxWidth="md">
          <DonationGoal
            current={donationGoal.current_amount ?? 0}
            goal={donationGoal.goal_amount}
            embedded
          />
        </DonationGoalContainer>
      )}
      <StaticDevlinkComponent component={SpendenMarburg} />
    </DevlinkPage>
  );
}

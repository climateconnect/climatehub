import React, { useContext } from "react";
import { Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import { GetServerSidePropsContext } from "next";
import UserContext from "../../../src/components/context/UserContext";
import DevlinkPage from "../../../src/components/devlink/DevlinkPage";
import StaticDevlinkComponent from "../../../src/components/devlink/StaticDevlinkComponent";
import DonationGoal from "../../../src/components/staticpages/donate/DonationGoal";
import { getHubData } from "../../../public/lib/getHubData";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import { CcLocale, HubData, LocaleType } from "../../../src/types";
import { SpendenPotsdam } from "../../../devlink/SpendenPotsdam";

const HUB_URL = "potsdam";

const DonationGoalContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(1),
}));

// The Webflow component to show per locale. There is only a German version so
// far, so English shows it too; swap in an English component once one exists.
const CONTENT_BY_LOCALE: Record<CcLocale, React.ComponentType> = {
  de: SpendenPotsdam,
  en: SpendenPotsdam,
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const hubData = await getHubData(HUB_URL, ctx.locale as LocaleType);
  return { props: { hubData: hubData ?? null } };
}

export default function PotsdamCrowdfundingPage({ hubData }: { hubData: HubData | null }) {
  const { donationGoals, locale } = useContext(UserContext);
  const content = CONTENT_BY_LOCALE[locale];
  // Only show the hub's own goal: the backend only returns goals that are currently running
  const donationGoal = donationGoals?.find((goal) => goal.hub === HUB_URL);

  return (
    <DevlinkPage
      title={`Crowdfunding | ClimateHub ${hubData?.name ?? "Potsdam"}`}
      isHubPage={true}
      hubUrl={HUB_URL}
      isLandingPage={true}
      hideFooter={true}
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
      <StaticDevlinkComponent component={content} />
    </DevlinkPage>
  );
}

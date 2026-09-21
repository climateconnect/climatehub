import * as React from "react";
import { ComponentType, FC, useContext } from "react";
import UserContext from "../context/UserContext";
import DevlinkPage from "../devlink/DevlinkPage";
import WideLayout from "../layouts/WideLayout";
import PageNotFound from "../general/PageNotFound";
import getTexts from "../../../public/texts/texts";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import theme from "../../themes/theme";
import { HubData } from "../../types";

interface TextsType {
  [key: string]: string;
}

interface HubLandingPageProps {
  hubData: HubData | null;
  hubUrl: string;
  EnComponent: ComponentType;
  DeComponent: ComponentType;
}

const HubLandingPage: FC<HubLandingPageProps> = ({ hubData, hubUrl, EnComponent, DeComponent }) => {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "landing_page", locale: locale }) as TextsType;

  if (!hubData) {
    return (
      <WideLayout>
        <PageNotFound itemName="landing page" />
      </WideLayout>
    );
  }

  const title = `${texts.climateHub} ${hubData.name} | ${texts.citizen_climate_action} ${hubData.name}`;
  const description = `${texts.find_fellow_campaigners_for_climate_protection_idea}`;

  return (
    <DevlinkPage
      title={title}
      description={description}
      isHubPage={true}
      hubUrl={hubUrl}
      isLocationHub={isLocationHubLikeHub(hubData.hub_type)}
      isLandingPage={true}
      headerBackground={theme.palette.primary.main}
      showDonationGoal={true}
    >
      {locale === "en" ? <EnComponent /> : <DeComponent />}
    </DevlinkPage>
  );
};

export default HubLandingPage;

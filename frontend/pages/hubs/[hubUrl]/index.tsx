import React, { FC, useContext } from "react";
import UserContext from "../../../src/components/context/UserContext";
import DevlinkPage from "../../../src/components/devlink/DevlinkPage";
import WideLayout from "../../../src/components/layouts/WideLayout";
import PageNotFound from "../../../src/components/general/PageNotFound";
import getTexts from "../../../public/texts/texts";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import theme from "../../../src/themes/theme";
import { HubData } from "../../../src/types";
import { getHubData } from "../../../public/lib/getHubData";
import { appHref } from "../../../public/lib/appLink";

interface TextsType {
  [key: string]: string;
}

interface NotFoundPageProps {
  link: string;
  showHeader?: boolean;
}

interface LandingPageProps {
  hubData: HubData | null;
  hubUrl?: string;
}

const NotFoundPage: FC<NotFoundPageProps> = ({ link, showHeader }) => {
  return (
    <>
      {showHeader ? (
        <WideLayout>
          <PageNotFound itemName="landing page" returnLink={link} />
        </WideLayout>
      ) : (
        <PageNotFound itemName="landing page" returnLink={link} />
      )}
    </>
  );
};

export async function getServerSideProps(ctx: any) {
  const hubUrl = ctx?.params?.hubUrl as string | undefined;
  const locale = ctx?.locale;

  if (!hubUrl) {
    return {
      props: {
        hubData: null,
        hubUrl: null,
      },
    };
  }

  const hubData = await getHubData(hubUrl, locale);
  if (!hubData?.landing_page_component) {
    return {
      redirect: {
        destination: appHref(`/hubs/${hubUrl}/browse`, { locale }),
        // redirect is based on current hub data, and that might change in the future so permanent: false,
        permanent: false,
      },
    };
  }
  return {
    props: {
      hubData,
      hubUrl,
    },
  };
}

const LandingPage: FC<LandingPageProps> = ({ hubData, hubUrl }) => {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "landing_page", locale: locale }) as TextsType;
  // Handle missing data
  if (!hubUrl || !hubData) {
    return <NotFoundPage link={"/browse"} showHeader />;
  }

  const title = `${texts.climateHub} ${hubData?.name} | ${texts.citizen_climate_action} ${hubData?.name}`;
  const description = `${texts.find_fellow_campaigners_for_climate_protection_idea}`;

  return (
    <DevlinkPage
      title={title}
      description={description}
      isHubPage={true}
      hubUrl={hubUrl}
      isLocationHub={isLocationHubLikeHub(hubData?.hub_type)}
      isLandingPage={true}
      headerBackground={theme.palette.primary.main}
      showDonationGoal={true}
    >
      <NotFoundPage link={`/hubs/${hubUrl}/browse`} />
    </DevlinkPage>
  );
};

export default LandingPage;

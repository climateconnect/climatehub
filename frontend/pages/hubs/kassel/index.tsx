import React from "react";
import { EnChKasselLandingpage } from "../../../devlink/landingPages/EnChKasselLandingpage";
import { DeChKasselLandingpage } from "../../../devlink/landingPages/DeChKasselLandingpage";
import HubLandingPage from "../../../src/components/hub/HubLandingPage";
import { createHubLandingPageServerSideProps } from "../../../public/lib/hubOperations";
import { HubData } from "../../../src/types";

const HUB_URL = "kassel";

export const getServerSideProps = createHubLandingPageServerSideProps(HUB_URL);

export default function KasselLandingPage({ hubData }: { hubData: HubData | null }) {
  return (
    <HubLandingPage
      hubData={hubData}
      hubUrl={HUB_URL}
      EnComponent={EnChKasselLandingpage}
      DeComponent={DeChKasselLandingpage}
    />
  );
}

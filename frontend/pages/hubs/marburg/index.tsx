import React from "react";
import { EnChMarburgLandingpage } from "../../../devlink/pageComponent/EnChMarburgLandingpage";
import { DeChMarburgLandingpage } from "../../../devlink/pageComponent/DeChMarburgLandingpage";
import HubLandingPage from "../../../src/components/hub/HubLandingPage";
import { createHubLandingPageServerSideProps } from "../../../public/lib/hubOperations";
import { HubData } from "../../../src/types";

const HUB_URL = "marburg";

export const getServerSideProps = createHubLandingPageServerSideProps(HUB_URL);

export default function MarburgLandingPage({ hubData }: { hubData: HubData | null }) {
  return (
    <HubLandingPage
      hubData={hubData}
      hubUrl={HUB_URL}
      EnComponent={EnChMarburgLandingpage}
      DeComponent={DeChMarburgLandingpage}
    />
  );
}

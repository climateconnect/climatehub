import React from "react";
import { EnChErlangenLandingpage } from "../../../devlink/pageComponent/EnChErlangenLandingpage";
import { DeChErlangenLandingpage } from "../../../devlink/pageComponent/DeChErlangenLandingpage";
import HubLandingPage from "../../../src/components/hub/HubLandingPage";
import { createHubLandingPageServerSideProps } from "../../../public/lib/hubOperations";
import { HubData } from "../../../src/types";

const HUB_URL = "erlangen";

export const getServerSideProps = createHubLandingPageServerSideProps(HUB_URL);

export default function ErlangenLandingPage({ hubData }: { hubData: HubData | null }) {
  return (
    <HubLandingPage
      hubData={hubData}
      hubUrl={HUB_URL}
      EnComponent={EnChErlangenLandingpage}
      DeComponent={DeChErlangenLandingpage}
    />
  );
}

import React from "react";
import { EnChPotsdamLandingpage } from "../../../devlink/pageComponent/EnChPotsdamLandingpage";
import { DeChPotsdamLandingpage } from "../../../devlink/pageComponent/DeChPotsdamLandingpage";
import HubLandingPage from "../../../src/components/hub/HubLandingPage";
import { createHubLandingPageServerSideProps } from "../../../public/lib/hubOperations";
import { HubData } from "../../../src/types";

const HUB_URL = "potsdam";

export const getServerSideProps = createHubLandingPageServerSideProps(HUB_URL);

export default function PotsdamLandingPage({ hubData }: { hubData: HubData | null }) {
  return (
    <HubLandingPage
      hubData={hubData}
      hubUrl={HUB_URL}
      EnComponent={EnChPotsdamLandingpage}
      DeComponent={DeChPotsdamLandingpage}
    />
  );
}

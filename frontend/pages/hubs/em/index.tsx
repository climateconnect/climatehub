import React from "react";
import { EnChEmmendingenLandingpage } from "../../../devlink/pageComponent/EnChEmmendingenLandingpage";
import { DeChEmmendingenLandingpage } from "../../../devlink/pageComponent/DeChEmmendingenLandingpage";
import HubLandingPage from "../../../src/components/hub/HubLandingPage";
import { createHubLandingPageServerSideProps } from "../../../public/lib/hubOperations";
import { HubData } from "../../../src/types";

const HUB_URL = "em";

export const getServerSideProps = createHubLandingPageServerSideProps(HUB_URL);

export default function EmmendingenLandingPage({ hubData }: { hubData: HubData | null }) {
  return (
    <HubLandingPage
      hubData={hubData}
      hubUrl={HUB_URL}
      EnComponent={EnChEmmendingenLandingpage}
      DeComponent={DeChEmmendingenLandingpage}
    />
  );
}

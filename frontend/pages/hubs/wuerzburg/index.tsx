import React from "react";
import { EnChWuerzburgLandingpage } from "../../../devlink/pageComponent/EnChWuerzburgLandingpage";
import { ChWuerzburgDeLandingpage } from "../../../devlink/pageComponent/ChWuerzburgDeLandingpage";
import HubLandingPage from "../../../src/components/hub/HubLandingPage";
import { createHubLandingPageServerSideProps } from "../../../public/lib/hubOperations";
import { HubData } from "../../../src/types";

const HUB_URL = "wuerzburg";

export const getServerSideProps = createHubLandingPageServerSideProps(HUB_URL);

export default function WuerzburgLandingPage({ hubData }: { hubData: HubData | null }) {
  return (
    <HubLandingPage
      hubData={hubData}
      hubUrl={HUB_URL}
      EnComponent={EnChWuerzburgLandingpage}
      DeComponent={ChWuerzburgDeLandingpage}
    />
  );
}

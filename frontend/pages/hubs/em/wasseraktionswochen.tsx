import { Box, Container, Theme, Typography, useMediaQuery } from "@mui/material";
import { GetServerSideProps } from "next";
import WideLayout from "../../../src/components/layouts/WideLayout";
import { apiRequest } from "../../../public/lib/apiOperations";
import WasseraktionswochenEvents from "../../../src/components/hub/WasseraktionswochenEvents";
import theme from "../../../src/themes/theme";
import { Wasseraktionswochen as WasseraktionswochenHero } from "../../../devlink/Wasseraktionswochen";
import makeStyles from "@mui/styles/makeStyles";
import LocalAmbassadorInfoBox from "../../../src/components/hub/LocalAmbassadorInfoBox";
import {
  getHubAmbassadorData,
  getHubData,
  getHubSupportersData,
} from "../../../public/lib/getHubData";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { WASSERAKTIONSWOCHEN_PARENT_SLUG } from "../../../public/data/wasseraktionswochen_config.js";
import HubSupporters from "../../../src/components/hub/HubSupporters";
import ContactAmbassadorButton from "../../../src/components/hub/ContactAmbassadorButton";
import React from "react";

interface WasseraktionswochenPageProps {
  locale: string;
  projects: any[];
  hubAmbassador: any;
  hubData: any;
  parentProject: any;
  hubSupporters: any;
}

const HUB_URL = "em";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const locale = context.locale || "en";

  let projects: any[] = [];
  let hubAmbassador = null;
  let hubData = null;
  let parentProject = null;
  let hubSupporters: any = null;

  try {
    // Fetch child projects and parent project in parallel
    const [childResp, parentResp] = await Promise.all([
      apiRequest({
        method: "get",
        url: `/api/projects/?parent_project_slug=${WASSERAKTIONSWOCHEN_PARENT_SLUG}&page_size=100`,
        locale,
      }),
      apiRequest({
        method: "get",
        url: `/api/projects/${WASSERAKTIONSWOCHEN_PARENT_SLUG}/`,
        locale,
      }),
    ]);

    // Process child projects
    const results = childResp?.data?.results || [];
    projects = results.map((project) => ({
      ...project,
      sectors: (project.sectors || [])
        .sort((a: any, b: any) => (a?.order || 0) - (b?.order || 0))
        .map((s: any) => s.sector),
    }));

    // Store parent project
    parentProject = parentResp?.data || null;
  } catch (err) {
    console.log("Failed to load project data", err?.response?.data || err);
  }

  // Fetch hub data and ambassador
  try {
    hubData = await getHubData(HUB_URL, locale);
    hubAmbassador = await getHubAmbassadorData(HUB_URL, locale);
    hubSupporters = await getHubSupportersData(HUB_URL, locale);
  } catch (err) {
    console.log("Failed to load hub data", err);
  }

  return {
    props: {
      locale,
      projects,
      hubAmbassador,
      hubData,
      parentProject,
      hubSupporters,
    },
  };
};

const useStyles = makeStyles(() => ({
  content: {
    position: "relative",
  },
  ambassadorBox: {
    position: "fixed",
    bottom: 16,
    right: 16,
    zIndex: 1000,
  },
  supporters: {
    marginLeft: "8px",
    marginTop: "60px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  bottomMenu: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    background: "#f0f2f5",
  },
}));

const HubSupportersSection = ({ isNarrowScreen, classes, supporters, hubName, hubUrl }) => {
  if (!supporters || supporters.length === 0) {
    return null;
  }

  const supportersComponent = (
    <HubSupporters supportersList={supporters} hubName={hubName} hubUrl={hubUrl} />
  );

  if (isNarrowScreen) {
    return <Box sx={{ padding: "8px", paddingBottom: "50px" }}>{supportersComponent}</Box>;
  }

  return (
    <div className={classes.supporters}>
      <Box sx={{ alignSelf: "center" }}>{supportersComponent}</Box>
    </div>
  );
};

const HubAmbassadorSection = ({ isNarrowScreen, classes, hubAmbassador, hubData, hubUrl }) => {
  if (!hubAmbassador || !hubData) {
    return null;
  }

  if (isNarrowScreen) {
    return (
      <div className={classes.bottomMenu}>
        <ContactAmbassadorButton mobile hubAmbassador={hubAmbassador} hubUrl={hubUrl} />
      </div>
    );
  }

  return (
    <div className={classes.ambassadorBox}>
      <LocalAmbassadorInfoBox
        hubAmbassador={hubAmbassador}
        hubData={hubData}
        hubSupportersExists={false}
      />
    </div>
  );
};

export default function WasseraktionswochenPage({
  locale,
  projects,
  hubAmbassador,
  hubSupporters,
  hubData,
  parentProject,
}: WasseraktionswochenPageProps) {
  const hubUrl = "em";
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const isGerman = locale === "de";
  const classes = useStyles();

  // Get SEO metadata from parent project
  const pageTitle =
    parentProject?.name || (isGerman ? "Wasseraktionswochen" : "Water Action Weeks");
  const pageDescription =
    parentProject?.short_description ||
    (isGerman
      ? "Entdecke alle Veranstaltungen der Wasseraktionswochen im Landkreis Emmendingen"
      : "Discover all events of the Water Action Weeks in the Emmendingen District");
  const pageImage = parentProject?.image ? getImageUrl(parentProject.image) : undefined;

  return (
    <WideLayout
      title={pageTitle}
      description={pageDescription}
      image={pageImage}
      hideAlert
      isHubPage
      hasHubLandingPage={true}
      hubUrl={hubUrl}
      hideFooter={isNarrowScreen}
      noSpaceBottom={isNarrowScreen}
      headerBackground={theme.palette.background.default}
    >
      <div className={classes.content}>
        <WasseraktionswochenHero />
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
          <Typography variant="body1" paragraph>
            Das Klimanetzwerk Riegel und ClimateConnect e.V. haben im September 2025 zum ersten
            überregionalen Wassertreffen eingeladen.
          </Typography>
          <Typography variant="body1" paragraph>
            Bei diesem Treffen haben sich zahlreiche ehrenamtliche Initiativen, Verbände,
            Verwaltungsmitarbeiter*innen und interessierte Bürger*innen zusammengefunden, um sich
            rund um das Thema Wasser zu vernetzen und auszutauschen. Um sichtbarer zu werden und die
            Verbundenheit miteinander zu zeigen hat sich aus diesem losen Zusammenschluß das
            Wasserbündnis gegründet.
          </Typography>
          <Typography variant="body1" paragraph>
            Unser erstes gemeinsames Ziel war es, im Rahmen des Weltwassertags am 22. März 2026 ein
            vielfältiges und informatives Programm für alle Altersgruppen zusammenzustellen.
          </Typography>
          <Typography variant="body1" paragraph>
            Dies ist uns mit mehr als 40 Veranstaltungen im gesamten Landkreis und darüber hinaus
            eindrücklich geglückt.
          </Typography>
          <Typography variant="body1" paragraph>
            Aber auch nach den Weltwasserwochen ist das Thema sehr präsent und nach wie vor setzen
            sich Initiativen und Verbände lokal vor Ort für das Thema Wasser in all seinen Facetten
            ein, aber auch als Bündnis bleiben wir gemeinsam aktiv.
          </Typography>
          <Typography variant="body1">
            Ab dem Herbst 26 werden wir in die Planung für die Wasserwochen 2027 gehen.
          </Typography>
        </Container>
        <Container>
          <WasseraktionswochenEvents projects={projects} isGerman={isGerman} />
          <HubSupportersSection
            isNarrowScreen={isNarrowScreen}
            classes={classes}
            supporters={hubSupporters}
            hubName={hubData?.name}
            hubUrl={hubUrl}
          />
        </Container>
        <HubAmbassadorSection
          isNarrowScreen={isNarrowScreen}
          classes={classes}
          hubAmbassador={hubAmbassador}
          hubData={hubData}
          hubUrl={hubUrl}
        />
      </div>
    </WideLayout>
  );
}

import React, { useContext, useEffect, useRef, useState } from "react";
import { Container, Theme, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import WideLayout from "../layouts/WideLayout";
import HubHeaderImage from "./HubHeaderImage";
import HubContent from "./HubContent";
import PageNav from "../pageNav/PageNav";
import HubSupporters from "./HubSupporters";
import HubLinkButton from "./HubLinkButton";
import DonationCampaignInformation from "../staticpages/donate/DonationCampaignInformation";
import { FabShareButton } from "./FabShareButton";
import MobilePageNav from "../pageNav/MobilePageNav";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { getHubAmbassadorData, getHubSupportersData } from "../../../public/lib/getHubData";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import { transformThemeData } from "../../themes/transformThemeData";
import hubTheme from "../../themes/hubTheme";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { BrowseEntity } from "../../types";

const useStyles = makeStyles((theme) => ({
  // The outer Container uses `disableGutters` (no horizontal padding) so the
  // inner `BrowseContentBase` Container provides the 24px padding. These
  // elements live outside the inner Container, so they need their own
  // padding to align with the content area.
  linkedHubsContainer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    paddingLeft: 24,
    paddingRight: 24,
    marginTop: theme.spacing(2),
    gap: theme.spacing(1),
  },
  linkedHubsContainerMobile: {
    display: "flex",
    flexDirection: "row",
    overflowX: "auto",
    gap: theme.spacing(2),
    padding: theme.spacing(2, 0, 0),
  },
  subHubInfoText: {
    fontStyle: "italic",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    paddingLeft: 24,
    paddingRight: 24,
    textAlign: "left" as const,
  },
}));

type HubPageLayoutProps = {
  children: React.ReactNode;
  /**
   * The page-nav entry that is currently active on this page. `null` means
   * no entry in the main page nav is active (e.g. the hub landing page or
   * the events page). The page that renders the layout is the source of
   * truth — `HubPageLayout` is not responsible for figuring out which page
   * it's on.
   */
  activeEntry: BrowseEntity | null;
  /**
   * Whether the page being rendered is the events calendar. The events page
   * has no `BrowseEntity` entry to highlight, so we need a separate signal
   * to know how to rewrite the linked-hub URLs: when the user is on the
   * events page and clicks a linked hub, they should land on that linked
   * hub's events page (not its browse page).
   */
  isEventsPage?: boolean;
  hubUrl: string;
  subHubSegment?: string;
  linkedHubs?: any[];
  hubAmbassador?: any;
  hubSupporters?: any;
  hubData?: any;
  hubThemeData?: any;
  allHubs?: any[];
  isLocationHub?: boolean;
};

export default function HubPageLayout({
  children,
  activeEntry,
  isEventsPage = false,
  hubUrl,
  subHubSegment,
  linkedHubs,
  hubAmbassador: initialAmbassador,
  hubSupporters: initialSupporters,
  hubData,
  hubThemeData,
  allHubs,
  isLocationHub: isLocationHubProp,
}: HubPageLayoutProps) {
  const { locale, CUSTOM_HUB_URLS } = useContext(UserContext);
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const classes = useStyles();
  const texts = getTexts({ page: "hub", locale: locale, hubName: hubData?.name });
  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;
  const contentRef = useRef<HTMLDivElement>(null);

  const isLocationHub =
    isLocationHubProp ?? isLocationHubLikeHub(hubData?.hub_type, hubData?.parent_hub);
  const isCustomHub = CUSTOM_HUB_URLS?.includes(hubUrl);
  const [hubAmbassador, setHubAmbassador] = useState(initialAmbassador || null);
  const [hubSupporters, setHubSupporters] = useState(initialSupporters || null);

  // The linked-hub button receives the active browse type as a string (or
  // undefined) so it can build URLs that preserve the current entry when the
  // user navigates to a linked hub. On the events page (`isEventsPage`),
  // pass `pageContext="events"` so the linked-hub URLs are rewritten to
  // `/events` instead of the default `/browse`.
  const activeTabType = activeEntry ?? undefined;
  const linkedHubPageContext = isEventsPage ? "events" : "browse";

  useEffect(() => {
    if (initialAmbassador !== undefined) return;
    (async () => {
      const ambassador = await getHubAmbassadorData(hubUrl, locale);
      setHubAmbassador(ambassador);
      if (isLocationHub) {
        const supporters = await getHubSupportersData(hubUrl, locale);
        setHubSupporters(supporters);
      }
    })();
  }, [hubUrl, locale]);

  const type_names: Record<string, string> = {
    projects: texts.projects,
    organizations: isNarrowScreen ? texts.orgs : texts.organizations,
    members: texts.members,
  };

  const scrollToContent = () => {
    contentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <WideLayout
      title={hubData?.headline ?? undefined}
      hideAlert
      headerBackground={
        customTheme ? customTheme.palette.header.background : hubTheme.palette.background.default
      }
      image={hubData?.image ? getImageUrl(hubData.image) : undefined}
      isHubPage
      hubUrl={hubUrl}
      customFooterImage={
        hubData?.custom_footer_image ? getImageUrl(hubData.custom_footer_image) : undefined
      }
      customTheme={customTheme}
      hasHubLandingPage={hubData?.landing_page_component ? true : false}
    >
      <DonationCampaignInformation hubUrl={hubUrl} />
      {!isLocationHub && (
        <HubHeaderImage
          image={hubData?.image ? getImageUrl(hubData.image) : undefined}
          source={hubData?.image_attribution}
          isLocationHub={isLocationHub}
        />
      )}
      <HubContent
        headline={hubData?.headline}
        hubAmbassador={hubAmbassador}
        hubSupporters={hubSupporters}
        quickInfo={hubData?.quick_info}
        statBoxTitle={hubData?.stat_box_title}
        stats={hubData?.stats}
        scrollToSolutions={scrollToContent}
        subHeadline={hubData?.sub_headline}
        welcomeMessageLoggedIn={hubData?.welcome_message_logged_in}
        welcomeMessageLoggedOut={hubData?.welcome_message_logged_out}
        isLocationHub={isLocationHub}
        hubData={hubData}
        hubUrl={hubUrl}
        image={hubData?.image ? getImageUrl(hubData.image) : undefined}
      />
      <PageNav
        activeEntry={activeEntry}
        type_names={type_names}
        hubUrl={hubUrl}
        className=""
        allHubs={allHubs}
        fromPage="hub"
        subHubSegment={subHubSegment}
      />
      <div ref={contentRef}>
        <Container maxWidth="lg" disableGutters>
          {isNarrowScreen && hubSupporters && (
            <HubSupporters supportersList={hubSupporters} hubName={hubData?.name} hubUrl={hubUrl} />
          )}
          {isNarrowScreen && linkedHubs && linkedHubs.length > 0 && (
            <div className={classes.linkedHubsContainerMobile}>
              {linkedHubs.map((linkedHub: any) => (
                <HubLinkButton
                  key={linkedHub.hubUrl}
                  hub={linkedHub}
                  activeTab={activeTabType}
                  pageContext={linkedHubPageContext}
                />
              ))}
            </div>
          )}
          {!isNarrowScreen && linkedHubs && linkedHubs.length > 0 && (
            <div className={classes.linkedHubsContainer}>
              {linkedHubs.map((linkedHub: any) => (
                <HubLinkButton
                  key={linkedHub.hubUrl}
                  hub={linkedHub}
                  activeTab={activeTabType}
                  pageContext={linkedHubPageContext}
                />
              ))}
            </div>
          )}
          {hubData?.parent_hub && (
            <div className={classes.subHubInfoText}>
              {isEventsPage
                ? texts.you_are_seeing_events_related_to
                : activeEntry === "organizations"
                ? texts.you_are_seeing_organizations_related_to
                : activeEntry === "members"
                ? texts.you_are_seeing_members_related_to
                : texts.you_are_seeing_projects_related_to}
            </div>
          )}
          {children}
        </Container>
      </div>
      {isNarrowScreen && (
        <MobilePageNav
          activeEntry={activeEntry}
          hubUrl={hubUrl}
          subHubSegment={subHubSegment}
          hubAmbassador={hubAmbassador}
        />
      )}
      {isNarrowScreen && (
        <FabShareButton locale={locale} hubAmbassador={hubAmbassador} isCustomHub={isCustomHub} />
      )}
    </WideLayout>
  );
}

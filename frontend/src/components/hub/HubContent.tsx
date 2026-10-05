import { Button, Collapse, Container, Theme, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import React, { useContext, useState } from "react";
import getTexts from "../../../public/texts/texts";
import MessageContent from "../communication/MessageContent";
import UserContext from "../context/UserContext";
import ElementOnScreen from "../hooks/ElementOnScreen";
import LoggedOutLocationHubBox from "./LoggedOutLocationHubBox";
import StatBox from "./StatBox";
import ContactAmbassadorButton from "./ContactAmbassadorButton";
import Dashboard from "../dashboard/Dashboard";
import LocalAmbassadorInfoBox from "./LocalAmbassadorInfoBox";
import HubHeadlineContainer from "./HubHeadlineContainer";
import HubSupporters from "./HubSupporters";
import theme from "../../themes/theme";
import { PrioOneBackgroundBrowse, PrioOneBackgroundBrowseIcon } from "./CustomBackground";
import { getCustomHubData } from "../../../public/data/customHubData";

const ShowSolutionsButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "$fixed",
})<{ $fixed?: boolean }>(({ theme, $fixed }) => ({
  width: "100%",
  marginBottom: theme.spacing(0.25),
  height: 40,
  ...($fixed && {
    width: 250,
    position: "fixed",
    bottom: theme.spacing(2),
    left: "50%",
    marginLeft: -125,
    zIndex: 1,
    border: "1px solid white",
  }),
}));

const AmbassadorAndSupporters = styled("div")({
  display: "flex",
  flexDirection: "column",
  gap: "14px",
});

const ButtonContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$isLocationHub",
})<{ $isLocationHub?: boolean }>(({ theme, $isLocationHub }) => ({
  display: $isLocationHub ? "none" : "flex",
  justifyContent: "center",
  maxWidth: 800,
  height: 40,
  marginTop: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    marginTop: theme.spacing(1),
  },
}));

const QuickInfo = styled("div")(({ theme }) => ({
  fontSize: 17,
  maxWidth: 800,
  marginTop: theme.spacing(4),
}));

const DashboardAndStatboxWrapper = styled("div")({
  display: "flex",
  justifyContent: "space-between",
  margin: "16px auto",
  gap: "1rem",
  alignItems: "end",
});

const InfoBoxContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(0),
  marginLeft: theme.spacing(2),
  float: "right",
}));

const TopSectionWrapper = styled("div", {
  shouldForwardProp: (prop) => prop !== "$loggedOut",
})<{ $loggedOut: boolean }>(({ theme, $loggedOut }) => ({
  position: "relative",
  backgroundSize: "cover",
  backgroundPosition: "bottom center",
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    paddingTop: $loggedOut ? theme.spacing(1) : theme.spacing(2),
    marginBottom: $loggedOut ? theme.spacing(4) : 0,
  },
}));

// This element is only rendered for non-location hubs, where the old background was always "none".
const BackgroundImageContainer = styled("div")({
  //TODO dead code?
  display: "none",
  background: "none",
  backgroundSize: "cover",
  backgroundPosition: "bottom center",
  height: 180,
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: -1,
});

export default function HubContent({
  headline,
  quickInfo,
  detailledInfo,
  stats,
  statBoxTitle,
  scrollToSolutions,
  subHeadline,
  welcomeMessageLoggedIn,
  welcomeMessageLoggedOut,
  isLocationHub,
  hubAmbassador,
  hubSupporters,
  hubData,
  hubUrl,
  image,
}) {
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const [expanded, setExpanded] = useState(false);

  const handleClickExpand = () => {
    if (expanded === false) {
      setFixed(true);
    }
    setExpanded(!expanded);
  };
  const [fixed, setFixed] = useState(false);
  const [showMoreEl, setShowMoreEl] = useState(null);
  const showMoreVisible = ElementOnScreen({ el: showMoreEl, triggerIfUnderScreen: true });
  if (!fixed && !showMoreVisible) {
    setFixed(true);
  }
  if (fixed && showMoreVisible) {
    setFixed(false);
  }
  const WelcomeComponent = getCustomHubData({ hubUrl: hubUrl })?.welcome?.[locale];
  return (
    <div>
      <div>
        {!isNarrowScreen && !isLocationHub && !user && (
          <InfoBoxContainer>
            <StatBox title={statBoxTitle} stats={stats} />
          </InfoBoxContainer>
        )}
        {isLocationHub ? (
          <TopSectionWrapper
            $loggedOut={!user}
            // TODO: decide if "image" should be checked as well
            // > pro: it prevents requests to "/undefined"
            // > con: it might be a bug that should be fixed in the parent component
            // > con: it will not "report" the bug
            style={{ backgroundImage: image ? `url('${image}')` : "none" }}
          >
            {hubUrl === "prio1" && <PrioOneBackgroundBrowse isLoggedInUser={user ? true : false} />}

            <Container>
              <DashboardAndStatboxWrapper>
                {user ? (
                  <>
                    {!isNarrowScreen && (
                      <Dashboard
                        hubUrl={hubUrl}
                        hubName={hubData?.name}
                        welcomeMessageLoggedIn={welcomeMessageLoggedIn}
                        welcomeMessageLoggedOut={welcomeMessageLoggedOut}
                      />
                    )}
                  </>
                ) : WelcomeComponent ? (
                  <WelcomeComponent />
                ) : (
                  <LoggedOutLocationHubBox
                    headline={headline}
                    isLocationHub={isLocationHub}
                    location={hubData.name}
                  />
                )}
                {!isNarrowScreen &&
                  (!user ? (
                    <>
                      {hubAmbassador && (
                        <AmbassadorAndSupporters>
                          <LocalAmbassadorInfoBox
                            hubAmbassador={hubAmbassador}
                            hubData={hubData}
                            hubSupportersExists={hubSupporters ? true : false}
                          />
                          {hubSupporters?.length > 0 && (
                            <HubSupporters
                              supportersList={hubSupporters}
                              hubName={hubData?.name}
                              hubUrl={hubUrl}
                            />
                          )}
                        </AmbassadorAndSupporters>
                      )}
                    </>
                  ) : (
                    <>
                      {hubAmbassador && (
                        <ContactAmbassadorButton hubAmbassador={hubAmbassador} mobile={false} />
                      )}
                      {hubSupporters?.length > 0 && (
                        <HubSupporters
                          supportersList={hubSupporters}
                          hubName={hubData?.name}
                          hubUrl={hubUrl}
                        />
                      )}
                      {!(hubSupporters?.length > 0) && hubUrl === "prio1" && (
                        <PrioOneBackgroundBrowseIcon />
                      )}
                    </>
                  ))}
              </DashboardAndStatboxWrapper>
            </Container>
          </TopSectionWrapper>
        ) : (
          <Container>
            <BackgroundImageContainer />
            <HubHeadlineContainer
              subHeadline={subHeadline}
              headline={headline}
              isLocationHub={isLocationHub}
            />
            <BottomContent
              detailledInfo={detailledInfo}
              quickInfo={quickInfo}
              expanded={expanded}
              handleClickExpand={handleClickExpand}
              isLocationHub={isLocationHub}
              hubAmbassador={hubAmbassador}
              isNarrowScreen={isNarrowScreen}
            />
          </Container>
        )}
      </div>
      <Container>
        <ButtonContainer
          $isLocationHub={isLocationHub}
          ref={(node) => {
            if (node) {
              setShowMoreEl(node);
            }
          }}
        >
          <ShowSolutionsButton
            $fixed={fixed}
            variant="contained"
            color="primary"
            onClick={scrollToSolutions}
          >
            <ExpandMoreIcon /> {texts.show_projects}
          </ShowSolutionsButton>
        </ButtonContainer>
      </Container>
    </div>
  );
}

const BottomContent = ({
  detailledInfo,
  quickInfo,
  expanded,
  handleClickExpand,
  hubAmbassador,
  isLocationHub,
  isNarrowScreen,
}) => {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  return (
    <>
      <div>
        {!isLocationHub && (
          <QuickInfo>
            <MessageContent content={quickInfo} />
          </QuickInfo>
        )}
        <Collapse in={expanded}>
          {isLocationHub && (
            <QuickInfo>
              <MessageContent content={quickInfo} />
            </QuickInfo>
          )}
          {detailledInfo}
        </Collapse>
      </div>
      {!isLocationHub && (
        <ButtonContainer>
          <Button sx={{ width: "100%" }} onClick={handleClickExpand}>
            {expanded ? (
              <>
                <ExpandLessIcon />
                {texts.less_info}{" "}
              </>
            ) : (
              <>
                <ExpandMoreIcon />
                {texts.more_info}
              </>
            )}
          </Button>
        </ButtonContainer>
      )}
      {!isNarrowScreen && <ContactAmbassadorButton hubAmbassador={hubAmbassador} mobile={false} />}
    </>
  );
};

import { Button, Collapse, Container, Theme, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
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

type MakeStylesProps = {
  isLocationHub: boolean;
  loggedOut: boolean;
  image: string;
};

const useStyles = makeStyles((theme) => ({
  expandMoreButton: {
    width: "100%",
  },
  h2: {
    color: theme.palette.secondary.main,
    fontWeight: 600,
    fontSize: 21,
    marginBottom: theme.spacing(1),
  },
  textHeadline: {
    color: theme.palette.primary.main,
    fontWeight: 600,
    fontSize: 22,
    marginBottom: theme.spacing(0.5),
    [theme.breakpoints.down("sm")]: {
      fontSize: 18,
    },
  },
  infoBoxContainerMobile: {
    margin: "0 auto",
    display: "flex",
    justifyContent: "center",
    marginBottom: theme.spacing(2),
  },
  showSolutionsButton: {
    width: "100%",
    marginBottom: theme.spacing(0.25),
    height: 40,
  },
  showMoreFixed: {
    width: 250,
    position: "fixed",
    bottom: theme.spacing(2),
    left: "50%",
    marginLeft: -125,
    zIndex: 1,
    border: "1px solid white",
  },
  ambassadorAndSupporters: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  buttonContainer: (props: MakeStylesProps) => ({
    display: props.isLocationHub ? "none" : "flex",
    justifyContent: "center",
    maxWidth: 800,
    height: 40,
    marginTop: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
      marginTop: theme.spacing(1),
    },
  }),
  quickInfo: {
    fontSize: 17,
    maxWidth: 800,
  },
  marginTop: {
    marginTop: theme.spacing(4),
  },
  dashboardAndStatboxWrapper: {
    display: "flex",
    justifyContent: "space-between",
    margin: "16px auto",
    gap: "1rem",
    alignItems: "end",
  },
  infoBoxContainer: {
    marginTop: theme.spacing(0),
    marginLeft: theme.spacing(2),
    float: "right",
  },
  topSectionWrapper: (props: MakeStylesProps) => ({
    // TODO: decide if "props.image" should be checked as well
    // > pro: it prevents requests to "/undefined"
    // > con: it might be a bug that should be fixed in the parent component
    // > con: it will not "report" the bug
    background: props.isLocationHub && props.image ? `url('${props.image}')` : "none",

    position: "relative",
    backgroundSize: "cover",
    backgroundPosition: "bottom center",
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
      paddingTop: props.loggedOut ? theme.spacing(1) : theme.spacing(2),
      marginBottom: props.loggedOut ? theme.spacing(4) : 0,
    },
  }),
  backgroundImageContainer: (props: MakeStylesProps) => ({
    //TODO dead code?
    display: "none",
    background: props.isLocationHub ? `url('${props.image}')` : "none",
    backgroundSize: "cover",
    backgroundPosition: "bottom center",
    height: 180,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  }),
}));

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
  const classes = useStyles({ isLocationHub: isLocationHub, loggedOut: !user, image: image });
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
          <div className={classes.infoBoxContainer}>
            <StatBox title={statBoxTitle} stats={stats} />
          </div>
        )}
        {isLocationHub ? (
          <div className={classes.topSectionWrapper}>
            {hubUrl === "prio1" && <PrioOneBackgroundBrowse isLoggedInUser={user ? true : false} />}

            <Container>
              <div className={classes.dashboardAndStatboxWrapper}>
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
                        <div className={classes.ambassadorAndSupporters}>
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
                        </div>
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
              </div>
            </Container>
          </div>
        ) : (
          <Container>
            <div className={classes.backgroundImageContainer} />
            <HubHeadlineContainer
              subHeadline={subHeadline}
              headline={headline}
              headlineClassName={classes.h1}
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
        <div
          className={classes.buttonContainer}
          ref={(node) => {
            if (node) {
              setShowMoreEl(node);
            }
          }}
        >
          <Button
            className={`${classes.showSolutionsButton} ${fixed && classes.showMoreFixed}`}
            variant="contained"
            color="primary"
            onClick={scrollToSolutions}
          >
            <ExpandMoreIcon /> {texts.show_projects}
          </Button>
        </div>
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
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  return (
    <>
      <div>
        {!isLocationHub && (
          <div className={`${classes.quickInfo} ${classes.marginTop}`}>
            <MessageContent content={quickInfo} />
          </div>
        )}
        <Collapse in={expanded}>
          {isLocationHub && (
            <div className={`${classes.quickInfo} ${classes.marginTop}`}>
              <MessageContent content={quickInfo} />
            </div>
          )}
          {detailledInfo}
        </Collapse>
      </div>
      {!isLocationHub && (
        <div className={classes.buttonContainer}>
          <Button className={classes.expandMoreButton} onClick={handleClickExpand}>
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
        </div>
      )}
      {!isNarrowScreen && <ContactAmbassadorButton hubAmbassador={hubAmbassador} mobile={false} />}
    </>
  );
};

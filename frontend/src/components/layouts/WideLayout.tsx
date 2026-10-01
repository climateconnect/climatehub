import { Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import Alert from "@mui/material/Alert";
import React, { ReactElement, ReactNode, useEffect, useState } from "react";
import { getParams } from "../../../public/lib/generalOperations";
import { getMessageFromUrl } from "../../../public/lib/parsingOperations";
import theme from "../../themes/theme";
import Footer from "../footer/Footer";
import LoadingContainer from "../general/LoadingContainer";
import Header from "../header/Header";
import ElementSpaceToTop from "../hooks/ElementSpaceToTop";
import DonationCampaignInformation from "../staticpages/donate/DonationCampaignInformation";
import LayoutWrapper from "./LayoutWrapper";
import { CustomBackground } from "../hub/CustomBackground";

const Main = styled(Container, {
  shouldForwardProp: (prop) => prop !== "$noSpaceBottom" && prop !== "$isStaticPage",
})<{ $noSpaceBottom?: boolean; $isStaticPage?: boolean; component?: React.ElementType }>(
  ({ theme, $noSpaceBottom, $isStaticPage }) => ({
    padding: 0,
    marginTop: $isStaticPage ? 0 : -16,
    marginBottom: $noSpaceBottom ? 0 : theme.spacing(6),
  })
);

const StyledAlert = styled(Alert, {
  shouldForwardProp: (prop) => prop !== "$fixed",
})<{ $fixed?: boolean }>(({ theme, $fixed }) => ({
  textAlign: "center",
  margin: "0 auto",
  zIndex: 100,
  maxWidth: 1280,
  ...($fixed && {
    top: 0,
    position: "fixed",
    width: "100%",
    [theme.breakpoints.up("lg")]: {
      left: "50%",
      marginLeft: -640,
    },
  }),
}));

type Props = {
  children?: ReactNode | undefined;
  title?: string;
  message?: string;
  messageType?: string;
  isLoading?: boolean;
  fixedHeader?: boolean;
  transparentHeader?: boolean;
  isStaticPage?: boolean;
  noFeedbackButton?: boolean;
  noSpaceBottom?: boolean;
  showOnScrollUp?: boolean;
  largeFooter?: boolean;
  description?: string;
  headerBackground?: string;
  subHeader?: ReactElement;
  image?: string;
  useFloodStdFont?: boolean;
  rootClassName?: string;
  hideFooter?: boolean;
  resetAlertMessage?: () => void;
  isHubPage?: boolean;
  hubUrl?: string;
  customFooterImage?: string;
  noHeader?: boolean;
  footerTextColor?: string;
  customTheme?: any;
  hideAlert?: boolean;
  transparentBackgroundColor?: string;
  hasHubLandingPage?: boolean;
  isLandingPage?: boolean;
  showDonationGoal?: boolean;
};
//Wrapper layout component for pages where the content takes the whole width of the screen
export default function WideLayout({
  children,
  title,
  message,
  messageType,
  isLoading,
  fixedHeader,
  transparentHeader,
  isStaticPage,
  noFeedbackButton, //don't display the fixed feedback button on the right border of the screen. Can be useful on mobile
  noSpaceBottom, //display the footer directly under the content without any margin
  showOnScrollUp, //display the footer when scrolling up, used for "inifinite scroll" pages
  largeFooter,
  description,
  headerBackground,
  subHeader,
  image,
  useFloodStdFont,
  rootClassName,
  hideFooter,
  resetAlertMessage,
  isHubPage,
  hubUrl,
  customFooterImage,
  noHeader,
  footerTextColor,
  customTheme,
  hideAlert,
  isLandingPage,
  hasHubLandingPage,
  showDonationGoal,
}: Props) {
  const [alertOpen, setAlertOpen] = useState(hideAlert ? false : true);
  const [initialMessageType, setInitialMessageType] = useState(null as any);
  const [initialMessage, setInitialMessage] = useState("");
  const [alertEl, setAlertEl] = useState(null);
  const spaceToTop = ElementSpaceToTop({ el: alertEl });

  useEffect(() => {
    const params = getParams(window.location.href);
    if (params.message) setInitialMessage(decodeURI(params.message));
    if (params.errorMessage) {
      setInitialMessage(decodeURI(params.errorMessage));
      setInitialMessageType("error");
    }
  }, []);
  useEffect(() => {
    !hideAlert && setAlertOpen(true);
  }, [message]);

  return (
    <LayoutWrapper
      title={title}
      noFeedbackButton={noFeedbackButton}
      noSpaceForFooter={noSpaceBottom}
      description={description}
      useFloodStdFont={useFloodStdFont}
      theme={customTheme ?? theme}
      image={image}
    >
      <CustomBackground hubUrl={hubUrl} />

      {!noHeader && (
        <Header
          isStaticPage={isStaticPage}
          fixedHeader={fixedHeader}
          transparentHeader={transparentHeader}
          noSpacingBottom={isStaticPage}
          background={headerBackground}
          isHubPage={isHubPage}
          hubUrl={hubUrl}
          hasHubLandingPage={hasHubLandingPage}
          isLandingPage={isLandingPage}
        />
      )}
      {isLoading ? (
        <LoadingContainer headerHeight={113} footerHeight={80} />
      ) : (
        <Main
          maxWidth={false}
          component="main"
          className={rootClassName}
          $noSpaceBottom={noSpaceBottom}
          $isStaticPage={isStaticPage}
        >
          {(message || initialMessage) && alertOpen && (
            <StyledAlert
              $fixed={spaceToTop.screen! <= 0 && spaceToTop.page! >= 98}
              severity={
                (messageType
                  ? messageType
                  : initialMessageType
                  ? initialMessageType
                  : "success") as any
              }
              ref={(node: any) => {
                if (node) {
                  setAlertEl(node);
                }
              }}
              onClose={() => {
                resetAlertMessage && resetAlertMessage();
                setAlertOpen(false);
              }}
            >
              {getMessageFromUrl(message ? message : initialMessage)}
            </StyledAlert>
          )}
          {subHeader && subHeader}
          {!fixedHeader && showDonationGoal && <DonationCampaignInformation hubUrl={hubUrl} />}
          {children}
        </Main>
      )}
      {!hideFooter && (
        <Footer
          noSpacingTop={noSpaceBottom}
          noAbsolutePosition={noSpaceBottom}
          showOnScrollUp={showOnScrollUp}
          large={isStaticPage || largeFooter}
          customFooterImage={customFooterImage}
          textColor={footerTextColor}
        />
      )}
    </LayoutWrapper>
  );
}

import { Container, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Alert from "@mui/material/Alert";
import React, { useEffect, useState } from "react";
import { getParams } from "../../../public/lib/generalOperations";
import { getMessageFromUrl } from "../../../public/lib/parsingOperations";
import theme from "../../themes/theme";
import Footer from "../footer/Footer";
import LoadingContainer from "../general/LoadingContainer";
import Header from "../header/Header";
import LayoutWrapper from "./LayoutWrapper";
//We are ignoring the "missing" devlink import because it will be there at runtime
//You will need to run 'npx webflow devlink sync' to generate this file.
//If you do not have access to an API key you can line out.
// @ts-ignore
import { DevLinkProvider } from "../../../devlink/DevLinkProvider";

const StyledAlert = styled(Alert)({
  width: "100%",
  zIndex: 100,
});

const MainHeading = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$contrastTextColor",
})<{ $contrastTextColor?: string; component?: React.ElementType }>(
  ({ theme, $contrastTextColor }) => ({
    textAlign: "center",
    margin: `${theme.spacing(4)} 0`,
    color: $contrastTextColor ? $contrastTextColor : theme.palette.background.default_contrastText,
  })
);

export default function Layout({
  title,
  hideHeadline,
  children,
  message,
  messageType,
  isLoading,
  isStaticPage,
  headerBackground,
  customTheme,
  hubUrl,
}: any) {
  const [hideAlertMessage, setHideAlertMessage] = useState(false);
  const [initialMessageType, setInitialMessageType] = useState(null as string | null);
  const [initialMessage, setInitialMessage] = useState("");

  useEffect(() => {
    const params = getParams(window.location.href);
    if (params.message) setInitialMessage(decodeURI(params.message));
    if (params.errorMessage) {
      setInitialMessage(decodeURI(params.errorMessage));
      setInitialMessageType("error");
    }
  }, []);
  return (
    <DevLinkProvider>
      <LayoutWrapper theme={customTheme ?? theme} title={title}>
        <Header
          noSpacingBottom
          isStaticPage={isStaticPage}
          background={headerBackground}
          hubUrl={hubUrl}
        />
        {isLoading ? (
          <LoadingContainer headerHeight={113} footerHeight={80} />
        ) : (
          <>
            {(message || initialMessage) && !(hideAlertMessage === message) && (
              <StyledAlert
                severity={
                  messageType ? messageType : initialMessageType ? initialMessageType : "success"
                }
                onClose={() => {
                  setHideAlertMessage(message);
                }}
              >
                {getMessageFromUrl(message ? message : initialMessage)}
              </StyledAlert>
            )}
            <Container maxWidth="lg" component="main">
              <Container maxWidth="sm">
                {!hideHeadline && (
                  <MainHeading
                    component="h1"
                    variant="h5"
                    $contrastTextColor={customTheme?.palette?.background?.default_contrastText}
                  >
                    {title}
                  </MainHeading>
                )}
              </Container>
              {children}
            </Container>
          </>
        )}
        <Footer />
      </LayoutWrapper>
    </DevLinkProvider>
  );
}

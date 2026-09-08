import { Snackbar, SnackbarContent, Theme, useMediaQuery } from "@mui/material";

import makeStyles from "@mui/styles/makeStyles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import { ThemeProvider } from "@mui/material/styles";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useContext, useEffect, useState } from "react";
import getTexts from "../../../public/texts/texts";
import FeedbackContext from "../context/FeedbackContext";
import UserContext from "../context/UserContext";
import FeedbackButton from "../feedback/FeedbackButton";
import CookieBanner from "../general/CookieBanner";
import LoadingContainer from "../general/LoadingContainer";
import CloseSnackbarAction from "../snackbarActions/CloseSnackbarAction";
import LogInAction from "../snackbarActions/LogInAction";
import { DevLinkProvider } from "../../../devlink/DevLinkProvider";

declare module "@mui/styles/defaultTheme" {
  // eslint-disable-next-line no-unused-vars
  interface DefaultTheme extends Theme {}
}

const useStyles = makeStyles<Theme>((theme) => ({
  pageWrapper: {
    // Always establish a positioned containing block that is at least the
    // viewport height so absolutely-positioned page backgrounds (e.g. the
    // hub `CustomBackground`) cover the whole visible area — even on
    // scrollable tablet layouts where the content grows past 100vh.
    position: "relative",
    minHeight: "100vh",
  },
  leaveSpaceForFooter: {
    //height of footer + spacing(1)
    paddingBottom: theme.spacing(12),
  },
  spinnerContainer: {
    display: "flex",
    position: "relative",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    flexDirection: "column",
  },
  spinner: {
    width: 100,
  },
  snackBar: {
    background: `${theme.palette.primary.main}`,
  },
  errorSnackBar: {
    background: theme.palette.error.main,
  },
  successSnackBar: {
    background: theme.palette.success.main,
  },
  snackBarMessage: {
    maxWidth: 300,
    fontSize: 16,
  },
}));

export default function LayoutWrapper({
  title,
  children,
  theme,
  fixedHeight,
  noFeedbackButton,
  noSpaceForFooter,
  description,
  image,
}: any) {
  const [snackbarProps, setSnackbarProps] = useState({
    open: false,
    message: "",
    action: <></>,
    hash: "",
    error: undefined as any,
    success: undefined as any,
  });
  const classes = useStyles();
  const [initialized, setInitialized] = useState(false);
  const isSmallerThanMediumScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("lg"));
  const [loading, setLoading] = useState(true);
  const [bannerOpen, setBannerOpen] = useState(true);
  const { acceptedNecessary, locale, isLoading } = useContext(UserContext);
  const router = useRouter();
  const texts = getTexts({ page: "general", locale: locale });
  const handleUpdateHash = (newHash) => {
    setSnackbarProps({ ...snackbarProps, hash: newHash });
  };

  const handleSnackbarClose = (e, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSnackbarProps({ ...snackbarProps, open: false });
  };

  const closeBanner = () => setBannerOpen(false);

  useEffect(() => {
    const handleRouteChangeStart = () => setLoading(true);
    const handleRouteChangeComplete = () => setLoading(false);
    const handleRouteChangeError = () => setLoading(false);

    router.events.on("routeChangeStart", handleRouteChangeStart);
    router.events.on("routeChangeComplete", handleRouteChangeComplete);
    router.events.on("routeChangeError", handleRouteChangeError);

    // Clean up the listeners when component unmounts
    return () => {
      router.events.off("routeChangeStart", handleRouteChangeStart);
      router.events.off("routeChangeComplete", handleRouteChangeComplete);
      router.events.off("routeChangeError", handleRouteChangeError);
    };
  }, [router.events]);

  useEffect(function () {
    if (!initialized) setInitialized(true);
    if (loading) {
      setLoading(false);
    }
  }, []);
  const defaultDescription = texts.defaultDescription;

  //if promptLogIn is true, the user will be shown a button to log in.
  //Otherwise the caller of the function can also set a custom action that should be shown to the user
  const showFeedbackMessage = ({ message, promptLogIn, action, newHash, error, success }) => {
    const newStateValue = {
      ...snackbarProps,
      open: true,
      message: message,
      error: error,
      success: success,
      action: promptLogIn ? (
        <LogInAction onClose={handleSnackbarClose} />
      ) : action ? (
        action
      ) : (
        <CloseSnackbarAction onClose={handleSnackbarClose} />
      ),
    };
    if (newHash) newStateValue.hash = newHash;
    setSnackbarProps(newStateValue);
  };

  const contextValues = {
    showFeedbackMessage: showFeedbackMessage,
    handleUpdateHash: handleUpdateHash,
  };

  const shouldShowCookieBanner = () => {
    if (acceptedNecessary || !bannerOpen || !initialized) {
      return false;
    }

    const excludedPaths = ["/privacy", "/terms", "/imprint"];
    return !excludedPaths.some((path) => router.pathname.includes(path));
  };

  return (
    <>
      <Head>
        <title>
          {title
            ? title + ` | ClimateHub ${locale === "de" ? "Netzwerk" : "Network"}`
            : `ClimateHub ${locale === "de" ? "Netzwerk" : "Network"}`}
        </title>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link href="/fonts/openSans.css" rel="stylesheet" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no"
        />
        <meta
          property="og:image"
          content={image ? image : "https://climatehub.org/images/landing_image_small.jpg"}
        />
        <meta property="og:title" content={title ? title : texts.default_title} />
        <meta property="og:type" content="website" />

        <meta name="description" content={description ? description : defaultDescription} />
      </Head>
      {/* If theme is falsy, slience the MUI console.warning for having an undefined theme */}
      <ThemeProvider theme={theme}>
        {/*
         * `@mui/styles` bundles its own `@mui/private-theming` instance, separate from the one
         * used by `@mui/material` v7, so it can't see the theme from the `ThemeProvider` above
         * via React context. Nesting `@mui/styles`' own `ThemeProvider` keeps `makeStyles`
         * consumers (including this component's own `useStyles`) in sync with custom hub themes.
         */}
        <StylesThemeProvider theme={theme}>
          <DevLinkProvider>
            {loading || isLoading ? (
              <div className={classes.spinnerContainer}>
                <LoadingContainer headerHeight={0} footerHeight={0} />
              </div>
            ) : (
              <FeedbackContext.Provider value={contextValues}>
                <div
                  className={`${classes.pageWrapper} ${
                    !fixedHeight && !noSpaceForFooter ? classes.leaveSpaceForFooter : ""
                  }`}
                >
                  {children}
                  {shouldShowCookieBanner() && <CookieBanner closeBanner={closeBanner} />}
                  {!noFeedbackButton && !isSmallerThanMediumScreen && <FeedbackButton />}
                  <Snackbar
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "left",
                    }}
                    color="primary"
                    open={snackbarProps.open}
                    autoHideDuration={10000}
                    onClose={handleSnackbarClose}
                  >
                    <SnackbarContent
                      message={snackbarProps.message}
                      action={snackbarProps.action}
                      classes={{
                        root: `${classes.snackBar} ${
                          snackbarProps.error && classes.errorSnackBar
                        } ${snackbarProps.success && classes.successSnackBar}`,
                        message: classes.snackBarMessage,
                      }}
                    />
                  </Snackbar>
                </div>
              </FeedbackContext.Provider>
            )}
          </DevLinkProvider>
        </StylesThemeProvider>
      </ThemeProvider>
    </>
  );
}

import { ThemeProvider } from "@emotion/react";
import { Card, CardContent, Container, Theme, useMediaQuery } from "@mui/material";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import React, { useContext, useEffect, useRef, useState } from "react";
import UserContext from "../src/components/context/UserContext";
import { trackAuthEvent } from "../src/utils/analytics";
import ContentImageSplitView from "../src/components/layouts/ContentImageSplitLayout";
import CustomAuthImage from "../src/components/hub/CustomAuthImage";
import WideLayout from "../src/components/layouts/WideLayout";
import { themeSignUp } from "../src/themes/signupTheme";
import getHubTheme from "../src/themes/fetchHubTheme";
import { transformThemeData } from "../src/themes/transformThemeData";
import getTexts from "../public/texts/texts";
import { getLocalePrefix } from "../public/lib/apiOperations";
import AuthEmailStep from "../src/components/auth/AuthEmailStep";
import AuthSignupStep from "../src/components/auth/AuthSignupStep";
import AuthPasswordLogin from "../src/components/auth/AuthPasswordLogin";
import AuthForgotPassword from "../src/components/auth/AuthForgotPassword";
import AuthOtp from "../src/components/auth/AuthOtp";

type AuthStep =
  | "email_entry"
  | "signup_step1"
  | "password_login"
  | "forgot_password"
  | "otp_entry"
  | "success";

interface LoginProps {
  hubThemeData: any;
  hubSlug: string | null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const hubSlug = ctx.query.hub as string | undefined;
  if (!hubSlug) {
    return { props: { hubThemeData: null, hubSlug: null } };
  }
  const hubThemeData = await getHubTheme(hubSlug);
  if (!hubThemeData) {
    return { props: { hubThemeData: null, hubSlug: hubSlug || null } };
  }
  return {
    props: {
      hubThemeData: hubThemeData || null,
      hubSlug: hubSlug || null,
    },
  };
};

export default function Login({ hubThemeData, hubSlug }: LoginProps) {
  const { user, locale, ReactGA } = useContext(UserContext);
  const router = useRouter();
  const hugeScreen = useMediaQuery((theme: Theme) => theme.breakpoints.up("xl"));
  const isSmallScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  // Determine redirect URL from query params
  const redirectUrl = (() => {
    if (router.query.redirect) {
      const decodedRedirect = decodeURIComponent(router.query.redirect as string);
      const prefix = getLocalePrefix(locale || "en");
      return decodedRedirect.startsWith("/") ? prefix + decodedRedirect : decodedRedirect;
    }
    if (hubSlug) {
      return getLocalePrefix(locale || "en") + "/hubs/" + hubSlug + "/browse";
    }
    return undefined;
  })();

  const texts = getTexts({
    page: "profile",
    locale: locale || "en",
    hubName: hubSlug || undefined,
  });

  // Step state machine — no URL change on transition
  const [currentStep, setCurrentStep] = useState<AuthStep>("email_entry");
  const [email, setEmail] = useState("");
  const isNewUserForOtp = useRef(false);

  // Track step views for funnel analysis
  useEffect(() => {
    if (currentStep === "success") return;

    const stepMapping: Record<Exclude<AuthStep, "success">, string> = {
      email_entry: "email_entry",
      signup_step1: "signup_personal_info",
      password_login: "password_login",
      forgot_password: "forgot_password",
      otp_entry: "otp_entry",
    };

    trackAuthEvent(
      "auth_step_viewed",
      {
        locale: locale || "en",
        hub_slug: hubSlug || undefined,
        step: stepMapping[currentStep as Exclude<AuthStep, "success">],
        user_status: currentStep === "signup_step1" ? "new" : undefined,
      },
      ReactGA
    );

    if (currentStep === "signup_step1") {
      trackAuthEvent(
        "auth_signup_started",
        { locale: locale || "en", hub_slug: hubSlug || undefined },
        ReactGA
      );
    }
  }, [currentStep, hubSlug, locale, ReactGA]);

  // Clear old redirect from sessionStorage if no redirect/hub in current URL
  useEffect(() => {
    if (!router.query.redirect && !hubSlug) {
      window.sessionStorage.removeItem("auth_redirect_url");
    }
  }, [router.query.redirect, hubSlug]);

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      const destination = redirectUrl || getLocalePrefix(locale || "en") + "/";
      router.push(destination);
    }
  }, [user, redirectUrl, locale, router]);

  const handleUserStatusDetermined = (
    status: "new" | "returning_password" | "returning_otp",
    determinedEmail: string
  ) => {
    // Persist redirect URL in sessionStorage so subsequent steps can use it
    if (redirectUrl) {
      window.sessionStorage.setItem("auth_redirect_url", redirectUrl);
    }
    setEmail(determinedEmail);
    switch (status) {
      case "new":
        isNewUserForOtp.current = true;
        setCurrentStep("signup_step1");
        break;
      case "returning_password":
        setCurrentStep("password_login");
        break;
      case "returning_otp":
        isNewUserForOtp.current = false;
        setCurrentStep("otp_entry");
        break;
    }
  };

  const handleBack = () => {
    setCurrentStep("email_entry");
  };

  const handleAuthSuccess = () => {
    setCurrentStep("success");
    const storedRedirect = window.sessionStorage.getItem("auth_redirect_url");
    window.sessionStorage.removeItem("auth_redirect_url"); // Clear after using
    router.push(storedRedirect || getLocalePrefix(locale || "en") + "/");
  };

  const handleSwitchToOtp = () => {
    isNewUserForOtp.current = false;
    setCurrentStep("otp_entry");
  };

  const handleForgotPassword = () => {
    setCurrentStep("forgot_password");
  };

  const handleBackToPasswordLogin = () => {
    setCurrentStep("password_login");
  };

  const handleSignupComplete = () => {
    setCurrentStep("otp_entry");
  };

  const commonProps = {
    email,
    onBack: handleBack,
    onSuccess: handleAuthSuccess,
    hubUrl: hubSlug || undefined,
  };

  const getStepContent = () => {
    switch (currentStep) {
      case "email_entry":
        return (
          <AuthEmailStep
            onUserStatusDetermined={handleUserStatusDetermined}
            hubUrl={hubSlug || undefined}
          />
        );
      case "signup_step1":
        return <AuthSignupStep {...commonProps} onSignupComplete={handleSignupComplete} />;
      case "password_login":
        return (
          <AuthPasswordLogin
            {...commonProps}
            onSwitchToOtp={handleSwitchToOtp}
            onForgotPassword={handleForgotPassword}
          />
        );
      case "forgot_password":
        return (
          <AuthForgotPassword
            email={email}
            onBack={handleBackToPasswordLogin}
            hubUrl={hubSlug || undefined}
          />
        );
      case "otp_entry":
        return (
          <AuthOtp {...commonProps} userType={isNewUserForOtp.current ? "new" : "returning"} />
        );
      case "success":
        return null;
    }
  };

  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;
  const customThemeSignUp = hubThemeData
    ? transformThemeData(hubThemeData, themeSignUp)
    : themeSignUp;

  return (
    <WideLayout
      hideAlert
      noSpaceBottom
      isHubPage={hubSlug !== null}
      customTheme={customTheme}
      hubUrl={hubSlug || undefined}
      headerBackground={
        customTheme && isSmallScreen ? customTheme.palette.header.background : "transparent"
      }
      footerTextColor={hubSlug && !isSmallScreen ? "white" : undefined}
    >
      <ThemeProvider theme={customThemeSignUp}>
        <Container
          maxWidth={hugeScreen ? "xl" : "lg"}
          style={{ paddingTop: 32, paddingBottom: 32 }}
        >
          {isSmallScreen ? (
            <Card variant="outlined">
              <CardContent>{getStepContent()}</CardContent>
            </Card>
          ) : (
            <ContentImageSplitView
              minHeight="75vh"
              content={
                <Card variant="outlined">
                  <CardContent>{getStepContent()}</CardContent>
                </Card>
              }
              image={<CustomAuthImage hubUrl={hubSlug || undefined} texts={texts} />}
            />
          )}
        </Container>
      </ThemeProvider>
    </WideLayout>
  );
}

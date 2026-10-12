import React, { useContext, useState } from "react";
import { redirect, resendEmail } from "../public/lib/apiOperations";
import getTexts from "../public/texts/texts";
import UserContext from "../src/components/context/UserContext";
import Form from "../src/components/general/Form";
import WideLayout from "../src/components/layouts/WideLayout";
import { Container, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import getHubTheme from "../src/themes/fetchHubTheme";
import { transformThemeData } from "../src/themes/transformThemeData";
import theme from "../src/themes/theme";

const Headline = styled(Typography, {
  shouldForwardProp: (prop) =>
    prop !== "$marginTop" && prop !== "$marginBottom" && prop !== "$color",
})<{ $marginTop: string; $marginBottom: string; $color: string }>(
  ({ $marginTop, $marginBottom, $color }) => ({
    marginTop: $marginTop,
    marginBottom: $marginBottom,
    textAlign: "center",
    color: $color,
  })
);

export async function getServerSideProps(ctx) {
  const hubUrl = ctx.query.hub;

  const hubThemeData = await getHubTheme(hubUrl);

  return {
    props: {
      hubUrl: hubUrl || null, // undefined is not allowed in JSON, so we use null
      hubThemeData: hubThemeData || null, // undefined is not allowed in JSON, so we use null
    },
  };
}

export default function ResendVerificationEmail({ hubUrl, hubThemeData }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { locale } = useContext(UserContext);
  // The old makeStyles hook ran above WideLayout's (hub) ThemeProvider, so keep the outer theme
  const outerTheme = useTheme();
  const texts = getTexts({ page: "settings", locale: locale });
  const fields = [
    {
      required: true,
      label: texts.enter_your_login_email,
      key: "email",
      type: "email",
    },
  ];
  const messages = {
    submitMessage: texts.send_verification_email_again,
  };

  const handleSubmit = async (event, values) => {
    event.preventDefault();
    resendEmail(values.email, onSuccess, onError);
  };

  const onSuccess = (resp) => {
    if (hubUrl) {
      redirect(`/hubs/${hubUrl}/browse`, {
        message: resp.data.message,
      });
    } else {
      redirect("/browse", {
        message: resp.data.message,
      });
    }
  };

  const onError = (error) => {
    if (error.response && error.response.data) setErrorMessage(error.response.data.message);
  };

  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;

  return (
    <WideLayout
      title={texts.resend_verification_email}
      isHubPage={hubUrl !== ""}
      customTheme={customTheme}
      hubUrl={hubUrl}
      headerBackground={
        customTheme ? customTheme.palette.header.background : theme.palette.background.default
      }
    >
      <Container>
        <Headline
          variant="h3"
          $marginTop={outerTheme.spacing(8)}
          $marginBottom={outerTheme.spacing(4)}
          $color={outerTheme.palette.text.primary}
        >
          {texts.resend_verification_email}
        </Headline>
        <Form
          fields={fields}
          messages={messages}
          onSubmit={handleSubmit}
          errorMessage={errorMessage}
        />
      </Container>
    </WideLayout>
  );
}

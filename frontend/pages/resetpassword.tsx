import React, { useContext, useState } from "react";
import { styled, useTheme } from "@mui/material/styles";
import { apiRequest, redirect } from "../public/lib/apiOperations";
import getTexts from "../public/texts/texts";
import UserContext from "../src/components/context/UserContext";
import Form from "../src/components/general/Form";
import getHubTheme from "../src/themes/fetchHubTheme";
import WideLayout from "../src/components/layouts/WideLayout";
import { transformThemeData } from "../src/themes/transformThemeData";
import { Typography } from "@mui/material";
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

export default function ResetPassword({ hubUrl, hubThemeData }) {
  const [errorMessage, setErrorMessage] = useState(null as string | null);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "settings", locale: locale });
  // The old makeStyles hook ran above WideLayout's (hub) ThemeProvider, so keep the outer theme
  const outerTheme = useTheme();

  const messages = {
    submitMessage: texts.send_password_reset_email,
  };

  const fields = [
    {
      required: true,
      label: texts.enter_your_login_email,
      key: "email",
      type: "email",
    },
  ];

  const handleSubmit = async (event, values) => {
    event.preventDefault();
    if (values.email) {
      try {
        const response = await apiRequest({
          method: "post",
          url: "/api/send_reset_password_email/",
          payload: { email: values.email },
          locale: locale,
        });
        if (hubUrl) {
          redirect(`/hubs/${hubUrl}/browse`, {
            message: response.data.message,
          });
        } else {
          redirect("/browse", {
            message: response.data.message,
          });
        }
      } catch (error: any) {
        console.log(error);
        if (error.response && error.response && error.response.data)
          setErrorMessage(error.response.data.message);
      }
    } else setErrorMessage(texts.you_didnt_enter_an_email);
  };

  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;

  return (
    <WideLayout
      title={texts.reset_password}
      isHubPage={hubUrl !== ""}
      customTheme={customTheme}
      hubUrl={hubUrl}
      headerBackground={
        customTheme ? customTheme.palette.header.background : theme.palette.background.default
      }
    >
      <Headline
        variant="h3"
        $marginTop={outerTheme.spacing(8)}
        $marginBottom={outerTheme.spacing(4)}
        $color={outerTheme.palette.text.primary}
      >
        {texts.reset_password}
      </Headline>
      <Form
        fields={fields}
        messages={messages}
        onSubmit={handleSubmit}
        errorMessage={errorMessage}
      />
    </WideLayout>
  );
}

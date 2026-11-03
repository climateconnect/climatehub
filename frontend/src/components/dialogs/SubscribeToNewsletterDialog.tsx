import { Button, TextField, Typography, useMediaQuery, Theme } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useState } from "react";
import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import GenericDialog from "./GenericDialog";

const CallToAction = styled("form")(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  textAlign: "center",
}));

const SubscribeButton = styled(Button)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  [theme.breakpoints.up("md")]: {
    height: 56,
    width: 150,
  },
  [theme.breakpoints.down("sm")]: {
    width: 250,
    marginTop: theme.spacing(1),
    marginLeft: 0,
  },
}));

const EmailTextField = styled(TextField)(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    width: 340,
  },
  [theme.breakpoints.down("sm")]: {
    width: 250,
  },
}));

const TextBlock = styled(Typography)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  [theme.breakpoints.up("md")]: {
    paddingLeft: theme.spacing(4),
    paddingRight: theme.spacing(4),
    marginTop: theme.spacing(-1),
  },
}));

export default function SubscribeToNewsletterDialog({ onClose, open }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "communication", locale: locale });
  const [emailAddress, setEmailAddress] = useState("");
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const isMediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const [loading, setLoading] = useState(false);
  const handleSubscribe = async (e) => {
    e.preventDefault();
    console.log("subscribing!");
    try {
      setLoading(true);
      const resp = await subscribeToNewsletter(emailAddress, locale);
      console.log(resp);
      setLoading(false);
    } catch (e) {
      console.log(e);
    }
  };
  const handleEmailTextChange = (e) => {
    setEmailAddress(e.target.value);
  };
  return (
    <GenericDialog
      maxWidth="sm"
      onClose={onClose}
      open={open}
      title={isMediumScreen ? texts.climate_news : texts.receive_climate_news_every_month}
    >
      <TextBlock>{texts.newsletter_banner_text}</TextBlock>
      <CallToAction onSubmit={handleSubscribe}>
        <EmailTextField
          value={emailAddress}
          variant="outlined"
          size={isMediumScreen ? "small" : "large"}
          label={texts.your_email_address}
          onChange={handleEmailTextChange}
          type="email"
          required
        />
        {isNarrowScreen && <br />}
        <SubscribeButton
          variant="contained"
          color="primary"
          type="submit"
          size={!isMediumScreen ? "large" : "normal"}
          disabled={loading}
        >
          {texts.subscribe}
        </SubscribeButton>
      </CallToAction>
    </GenericDialog>
  );
}

const subscribeToNewsletter = (emailAddress, locale) => {
  const url = process.env.API_URL + "/api/subscribe_to_newsletter/";
  const payload = { email: emailAddress };
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  apiRequest({
    method: "post",
    url: url,
    payload: payload,
    headers: headers,
    locale: locale,
  })
    .then(function (response) {
      return response;
    })
    .catch(function (error) {
      throw error;
    });
};

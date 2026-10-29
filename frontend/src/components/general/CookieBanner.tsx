import {
  Button,
  Checkbox,
  Container,
  Modal,
  Theme,
  Typography,
  useMediaQuery,
  Box,
  FormControlLabel,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useState } from "react";
import Cookies from "universal-cookie";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import LaunchIcon from "@mui/icons-material/Launch";

const CookieModal = styled(Modal)({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const Content = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.secondary.main}`,
  padding: theme.spacing(2, 4, 3),
  borderRadius: theme.shape.borderRadius,
  maxWidth: "600px",
  width: "90%",
  outline: "none",
}));

const Headline = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  marginBottom: theme.spacing(1),
  [theme.breakpoints.down("lg")]: {
    fontSize: 15,
  },
}));

const Buttons = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}));

const LeftButton = styled(Button)(({ theme }) => ({
  flex: 1,
  [theme.breakpoints.up("md")]: {
    marginRight: theme.spacing(1),
  },
  [theme.breakpoints.down("lg")]: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
}));

const RightButton = styled(Button)(({ theme }) => ({
  flex: 1,
  [theme.breakpoints.down("lg")]: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
}));

const PolicyLink = styled("a")({
  display: "inline-flex",
  alignItems: "center",
});

const LinkIcon = styled(LaunchIcon)(({ theme }) => ({
  fontSize: "1rem",
  marginLeft: theme.spacing(0.5),
}));

export default function CookieBanner({ closeBanner }) {
  const { updateCookies, locale } = useContext(UserContext);
  const texts = getTexts({ page: "cookie", locale: locale });
  const [checked, setChecked] = useState({ necessary: true, statistics: false });
  const cookies = new Cookies();
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const onStatisticsChange = () => {
    setChecked({ ...checked, statistics: !checked.statistics });
  };

  const now = new Date();
  const oneYearFromNow = new Date(now.setFullYear(now.getFullYear() + 1));

  const confirmSelection = () => {
    cookies.set("acceptedNecessary", true, { path: "/", sameSite: "lax", expires: oneYearFromNow });
    cookies.set("acceptedStatistics", checked.statistics, {
      path: "/",
      sameSite: "lax",
      expires: oneYearFromNow,
    });
    updateCookies();
    closeBanner();
  };

  const enableAll = () => {
    cookies.set("acceptedNecessary", true, { path: "/", sameSite: "lax", expires: oneYearFromNow });
    cookies.set("acceptedStatistics", true, {
      path: "/",
      sameSite: "lax",
      expires: oneYearFromNow,
    });
    updateCookies();
    closeBanner();
  };

  const handleClose = () => {
    // do nothing
  };

  return (
    <CookieModal open={true} onClose={handleClose}>
      <Content>
        <Container maxWidth="lg">
          <Headline variant="h6" color="secondary">
            {texts.cookie_banner_headline}
          </Headline>
          {!isNarrowScreen && <Typography variant="body2">{texts.cookie_explanation}</Typography>}
          <Typography variant="body2">
            {texts.for_more_information_check_out_our}{" "}
            <PolicyLink
              href={getLocalePrefix(locale) + "/privacy"}
              target="_blank"
              rel="noreferrer"
            >
              {texts.privacy_policy}
              <LinkIcon />
            </PolicyLink>{" "}
            {texts.and}{" "}
            <PolicyLink href={getLocalePrefix(locale) + "/terms"} target="_blank" rel="noreferrer">
              {texts.terms_of_use}
              <LinkIcon />
            </PolicyLink>
            .
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={checked.necessary} disabled />}
            label={texts.cookies_necessary}
          />
          <FormControlLabel
            control={<Checkbox checked={checked.statistics} onChange={onStatisticsChange} />}
            label={texts.cookies_statistics}
          />
          <Buttons>
            <LeftButton variant="outlined" color="secondary" onClick={confirmSelection}>
              {texts.confirm_selection}
            </LeftButton>
            <RightButton color="primary" variant="contained" onClick={enableAll}>
              {texts.enable_all_cookies}
            </RightButton>
          </Buttons>
        </Container>
      </Content>
    </CookieModal>
  );
}

import { Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import LightBigButton from "../staticpages/LightBigButton";

// Static class handed to the text files (`classes.yellow`) so highlighted spans can be styled
const YELLOW_TEXT_CLASS = "donationsBannerYellowText";

const Root = styled("div")(({ theme }) => ({
  background: theme.palette.primary.main,
  paddingTop: theme.spacing(5),
  paddingBottom: theme.spacing(5),
  marginTop: theme.spacing(10),
  [`& .${YELLOW_TEXT_CLASS}`]: {
    color: theme.palette.yellow.main,
  },
}));

const Content = styled("div")(({ theme }) => ({
  width: 848,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  [theme.breakpoints.down("md")]: {
    width: "auto",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
}));

const HeartIconContainer = styled("div")(({ theme }) => ({
  color: theme.palette.yellow.main,
  marginRight: theme.spacing(3),
}));

const HeartIcon = styled(FavoriteBorderIcon)({
  width: 120,
  height: 120,
});

const Headline = styled(Typography)({
  color: "white",
});

const Text = styled(Typography)(({ theme }) => ({
  color: "white",
  fontSize: 18,
  fontWeight: 600,
  [theme.breakpoints.down("md")]: {
    fontSize: 16,
    fontWeight: 500,
    textAlign: "center",
  },
}));

const DonateButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginTop: theme.spacing(3),
}));

export default function DonationsBanner({ h1ClassName }) {
  const isMediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({
    page: "donate",
    locale: locale,
    classes: { yellow: YELLOW_TEXT_CLASS },
  });
  return (
    <Root>
      <Content>
        {!isMediumScreen && (
          <HeartIconContainer>
            <HeartIcon color="inherit" />
          </HeartIconContainer>
        )}
        <div>
          <Headline className={h1ClassName}>
            {texts.we_rely_on_your_donation_to_stay_independent}
          </Headline>
          <Text>{texts.we_are_non_profit_and_running_only_on_donations}</Text>
        </div>
      </Content>
      <DonateButtonContainer>
        <LightBigButton href={getLocalePrefix(locale) + "/donate"}>
          {texts.donate_now}
        </LightBigButton>
      </DonateButtonContainer>
    </Root>
  );
}

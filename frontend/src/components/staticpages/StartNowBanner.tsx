import { Container, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import LightBigButton from "./LightBigButton";

// Static class handed to the text files (`classes.yellow`) so highlighted spans can be styled
const YELLOW_TEXT_CLASS = "startNowBannerYellowText";

const Root = styled("div")(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  background: theme.palette.primary.main,
  [`& .${YELLOW_TEXT_CLASS}`]: {
    color: theme.palette.yellow.main,
  },
}));

const Headline = styled(Typography)({
  color: "white",
  maxWidth: 580,
  textAlign: "center",
  margin: "0 auto",
}) as typeof Typography;

const ButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginTop: theme.spacing(3),
}));

const SignUpButton = styled(LightBigButton)({
  margin: "0 auto",
});

export default function StartNowBanner({ h1ClassName, className }: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({
    page: "landing_page",
    locale: locale,
    classes: { yellow: YELLOW_TEXT_CLASS },
  });
  return (
    <Root className={className}>
      <Container>
        <div>
          <Headline className={h1ClassName} component="h1">
            {texts.start_now_banner_text}
          </Headline>
        </div>
        <ButtonContainer>
          <SignUpButton href={getLocalePrefix(locale) + "/signup"}>{texts.sign_up}</SignUpButton>
        </ButtonContainer>
      </Container>
    </Root>
  );
}

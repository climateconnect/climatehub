import { Container, Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import ExplainerElement from "./ExplainerElement";
import SmallCloud from "./SmallCloud";

const Root = styled(Container)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
});

const ExplainerWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  maxWidth: 1000,
  marginTop: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    height: 580,
  },
}));

const Cloud1 = styled(SmallCloud)({
  position: "absolute",
  left: 50,
  top: -75,
  width: 150,
  height: 60,
});

const Cloud2 = styled(SmallCloud)({
  position: "absolute",
  top: 20,
  left: 150,
});

const Cloud3 = styled(SmallCloud)({
  position: "absolute",
  top: -50,
  left: "30%",
  width: 100,
});

const Cloud4 = styled(SmallCloud)({
  position: "absolute",
  right: 0,
  top: 0,
  width: 150,
  height: 100,
});

const MobileCloud1 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  left: -100,
  top: -30,
  width: 135,
  height: 70,
  [theme.breakpoints.down("sm")]: {
    width: 100,
    height: 50,
    left: -50,
  },
}));

const MobileCloud2 = styled(SmallCloud)({
  position: "absolute",
  right: -50,
});

const MobileCloud3 = styled(SmallCloud)({
  position: "absolute",
  right: -130,
  top: -70,
  width: 135,
});

const MobileCloud4 = styled(SmallCloud)({
  position: "absolute",
  bottom: -40,
  left: -90,
});

const MobileCloud5 = styled(SmallCloud)({
  position: "absolute",
  left: -50,
  top: 20,
  height: 70,
  width: 120,
});

export default function ExplainerBox({ h1ClassName, className, hideHeadline }: any) {
  const isMediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "about", locale: locale });

  return (
    <Root className={className}>
      {!isMediumScreen && (
        <>
          <Cloud1 type={1} />
          <Cloud2 type={2} />
          <Cloud3 type={2} reverse />
          <Cloud4 type={1} />
        </>
      )}
      {!hideHeadline && (
        <Typography color="primary" component="h1" className={h1ClassName}>
          {texts.this_is_climate_connect}
        </Typography>
      )}
      <ExplainerWrapper>
        <ExplainerElement
          text={
            <>
              {texts.a_free_nonprofit_climate_action_network}
              <br />
              {texts.hundred_percent_independent}.
            </>
          }
          icon="/icons/floating_sign_heart.svg"
          alt={texts.heart_icon}
        >
          {isMediumScreen && <MobileCloud1 type={1} />}
        </ExplainerElement>
        <ExplainerElement
          text={<>{texts.for_everyone_who_contributes_or_wants_to_contribute}</>}
          icon="/icons/floating_sign_group.svg"
          alt={texts.group_of_people_icon}
        >
          {isMediumScreen && <MobileCloud2 type={2} />}
          {isMediumScreen && <MobileCloud3 type={2} reverse />}
          {isMediumScreen && <MobileCloud4 type={2} reverse />}
        </ExplainerElement>
        <ExplainerElement
          text={<>{texts.enabling_global_and_locale_collaboration_and_knowledge_sharing}</>}
          icon="/icons/floating_sign_lightbulb.svg"
          alt={texts.idea_lightbulb_icon}
        >
          {isMediumScreen && <MobileCloud5 type={2} />}
        </ExplainerElement>
      </ExplainerWrapper>
    </Root>
  );
}

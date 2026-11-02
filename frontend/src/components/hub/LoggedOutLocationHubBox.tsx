import { Button, Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import theme from "../../themes/theme";
import IconWrapper from "../staticpages/donate/IconWrapper";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { appHref } from "../../../public/lib/appLink";
import { useRouter } from "next/router";
import { HubContext } from "../context/HubContext";

const shouldForwardProp = (prop: PropertyKey) => typeof prop !== "string" || !prop.startsWith("$");

const Root = styled("div", { shouldForwardProp })<{ $isNarrowScreen: boolean }>(
  ({ theme, $isNarrowScreen }) => ({
    display: "flex",
    flexDirection: $isNarrowScreen ? "column" : "row",
    [theme.breakpoints.down("md")]: {
      marginTop: theme.spacing(0),
      marginBottom: theme.spacing(-6),
    },
  })
);

const ContentContainer = styled("div", { shouldForwardProp })<{
  $isLocationHub: boolean;
  $isNarrowScreen: boolean;
}>(({ theme, $isLocationHub, $isNarrowScreen }) => ({
  minWidth: 300,
  background: theme.palette.primary.main,
  display: "flex",
  flexDirection: "column",
  justifyContent: $isNarrowScreen ? "space-around" : "flex-start",
  maxWidth: "800px",
  borderRadius: 5,
  border: `3px solid ${theme.palette.primary.main}`,
  marginTop: $isLocationHub ? 0 : theme.spacing(-11),
  // marginBottom: theme.spacing(2),

  ["@media(max-width:960px)"]: {
    maxWidth: 550,
  },
}));

const HeadlineContainer = styled("div")({
  display: "flex",
  alignItems: "center",
});

const HeadlineText = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  [theme.breakpoints.down("md")]: {
    fontSize: 25,
  },
  [theme.breakpoints.down("sm")]: {
    fontSize: 22,
  },
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(1),
}));

const LowerBoxWrapper = styled("div")(({ theme }) => ({
  background: "white",
  borderTopRightRadius: 10,
  borderTopLeftRadius: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    alignItems: "flex-start",
  },
}));

const AdvantagesBox = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-around",
  paddingBottom: theme.spacing(2),
  textAlign: "center",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    paddingBottom: 0,
  },
}));

const ReasonToJoinWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "30%",
  [theme.breakpoints.down("md")]: {
    flexDirection: "row",
    width: "100%",
    textAlign: "start",
    alignItems: "center",
    marginBottom: theme.spacing(1.5),
  },
}));

const ReasonText = styled(Typography)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    fontSize: 15,
    fontWeight: 500,
    color: theme.palette.secondary.main,
    marginLeft: theme.spacing(2),
  },
}));

const SignUpButton = styled(Button)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    width: "100%",
    textAlign: "center",
  },
}));

const ButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  background: "white",
  paddingBottom: theme.spacing(2),
  borderBottomRightRadius: 10,
  borderBottomLeftRadius: 10,
  [theme.breakpoints.down("md")]: {
    paddingBottom: 0,
    borderBottom: 0,
  },
}));

export default function LoggedOutLocationHubBox({ headline, isLocationHub, location }) {
  const { locale } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);
  const texts = getTexts({
    page: "dashboard",
    locale: locale,
    hubName: location,
  });

  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));

  const REASONS_TO_JOIN = [
    {
      text: texts.find_engagement,
      icon: "/icons/floating_sign_heart.svg",
      iconMobile: FavoriteIcon,
    },
    {
      text: texts.find_collaborators_for_your_idea,
      icon: "/icons/floating_sign_lightbulb.svg",
      iconMobile: LightbulbIcon,
    },
    {
      text: texts.share_your_climate_project,
      icon: "/icons/floating_sign_group.svg",
      iconMobile: GroupAddIcon,
    },
  ];

  function ReasonToJoin({ reason }) {
    return (
      <ReasonToJoinWrapper>
        {isNarrowScreen ? (
          <reason.iconMobile sx={(theme: Theme) => ({ color: theme.palette.primary.light })} />
        ) : (
          <IconWrapper src={reason.icon} noPadding={isNarrowScreen} />
        )}
        <ReasonText>{reason.text}</ReasonText>
      </ReasonToJoinWrapper>
    );
  }

  function Headline() {
    return (
      <HeadlineContainer>
        <HeadlineText variant="h4" component="h1">
          {headline}
        </HeadlineText>
      </HeadlineContainer>
    );
  }
  const router = useRouter();
  const subHub = router.query?.subHub;
  const parentHub = router.query?.hubUrl;

  return (
    <Root $isNarrowScreen={isNarrowScreen}>
      <ContentContainer $isLocationHub={isLocationHub} $isNarrowScreen={isNarrowScreen}>
        <Headline />
        <LowerBoxWrapper>
          <Typography component="p">
            {(texts as any)[(subHub ? (subHub as string) : (parentHub as string)) + "_welcometext"]}
          </Typography>
          {!subHub && (
            <AdvantagesBox>
              {REASONS_TO_JOIN.map((r) => (
                <ReasonToJoin reason={r} key={r.text} />
              ))}
            </AdvantagesBox>
          )}
        </LowerBoxWrapper>
        <ButtonContainer>
          <SignUpButton variant="contained" href={appHref("/signup", { hubUrl, locale })}>
            {isNarrowScreen ? texts.sign_up_now : texts.sign_up_now_to_make_a_difference}
          </SignUpButton>
        </ButtonContainer>
      </ContentContainer>
    </Root>
  );
}

import { Container, Typography, useMediaQuery, Link, Theme } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import InfoLinkBox from "../staticpages/InfoLinkBox";
import SmallCloud from "../staticpages/SmallCloud";
import { getLocalePrefix } from "../../../public/lib/apiOperations";

const Root = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(10),
  marginBottom: theme.spacing(10),
  position: "relative",
  [theme.breakpoints.down("sm")]: {
    marginTop: theme.spacing(5),
    marginBottom: theme.spacing(5),
  },
}));

const Content = styled("div")(({ theme }) => ({
  display: "flex",
  maxWidth: 1280,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    width: "100%",
  },
}));

const InfoLinkBoxes = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-around",
  position: "relative",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(3),
  },
}));

const TeamImage = styled("img")(({ theme }) => ({
  maxWidth: "100%",
  [theme.breakpoints.down("md")]: {
    width: "100%",
    maxWidth: "100%",
  },
}));

const StyledSmallCloud1 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  right: 110,
  top: 160,
  width: 120,
  height: 90,
  [theme.breakpoints.down("lg")]: {
    display: "none",
  },
}));

const StyledSmallCloud2 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  width: 120,
  height: 90,
  top: -60,
  left: 100,
  [theme.breakpoints.down("sm")]: {
    left: 30,
    top: -30,
    width: 80,
  },
}));

export default function OurTeamBox({ h1ClassName }) {
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const { locale } = useContext(UserContext);
  const link_to_team_page = getLocalePrefix(locale) + "/team";
  const link_to_about_page = getLocalePrefix(locale) + "/about";
  const texts = getTexts({
    page: "landing_page",
    locale: locale,
    isNarrowScreen: isNarrowScreen,
  });
  return (
    <Root>
      <StyledSmallCloud2 type={2} reverse />
      <Typography color="primary" component="h1" className={h1ClassName}>
        {texts.our_team}
      </Typography>
      <Content>
        <Link href={link_to_team_page} underline="hover">
          <TeamImage src="/images/team.jpg" alt={texts.our_team_image_text} />
        </Link>
        <InfoLinkBoxes>
          <InfoLinkBox
            iconSrc="/icons/group-icon.svg"
            iconAlt={texts.group_icon_alt}
            link={link_to_team_page}
            headline={texts.who_we_are}
            text={
              texts.find_out_more_about_our_team + !isNarrowScreen
                ? " " + texts.and_why_we_are_doing_what_we_are_doing
                : ""
            }
          >
            <StyledSmallCloud1 type={1} />
          </InfoLinkBox>
          <InfoLinkBox
            iconSrc="/icons/donate-icon.svg"
            iconAlt={texts.open_hand_offering_a_seedling_with_a_heart_instead_of_leaves}
            link={link_to_about_page}
            headline={texts.our_mission}
            text={
              texts.learn_about_our_goals_and_values + !isNarrowScreen
                ? " " + texts.and_what_we_want_to_achieve_with_creating_a_climate_community
                : ""
            }
          />
        </InfoLinkBoxes>
      </Content>
    </Root>
  );
}

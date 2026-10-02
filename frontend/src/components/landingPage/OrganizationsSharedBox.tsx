import { Button, Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import OrganizationPreviewsFixed from "../organization/OrganizationPreviewsFixed";
import SmallCloud from "../staticpages/SmallCloud";

const Root = styled("div")(({ theme }) => ({
  width: "90%",
  maxWidth: 1280,
  margin: "0 auto",
  marginTop: theme.spacing(15),
  position: "relative",
}));

const Headline = styled(Typography)(({ theme }) => ({
  fontSize: 25,
  fontWeight: 700,
  marginBottom: theme.spacing(1),
  [theme.breakpoints.down("md")]: {
    fontSize: 21,
  },
})) as typeof Typography;

const ExplainerText = styled(Typography)(({ theme }) => ({
  maxWidth: 660,
  marginBottom: theme.spacing(3),
}));

const ShowProjectsButtonContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

const ShowProjectsArrow = styled(KeyboardArrowRightIcon)(({ theme }) => ({
  marginLeft: theme.spacing(2),
}));

const ShowProjectsText = styled("span")({
  textDecoration: "underline",
});

const SmallCloud1 = styled(SmallCloud)({
  position: "absolute",
  top: -60,
  right: "50%",
});

const SmallCloud2 = styled(SmallCloud)({
  position: "absolute",
  right: "10%",
  top: -100,
  width: 100,
  height: 80,
});

export default function OrganizationsSharedBox({ organizations, isLoading }) {
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({
    page: "landing_page",
    locale: locale,
    isNarrowScreen: isNarrowScreen,
  });
  return (
    <Root>
      <SmallCloud1 type={2} />
      <SmallCloud2 type={1} reverse />
      <Headline component="h1" color="primary">
        {texts.find_a_climate_action_organization_and_get_involved}
      </Headline>
      <ExplainerText>
        {texts.find_a_climate_action_organization_and_get_involved_text}{" "}
        {!isNarrowScreen && (
          <>{texts.find_a_climate_action_organization_and_get_involved_additional_text}</>
        )}
      </ExplainerText>
      <OrganizationPreviewsFixed organizations={organizations} isLoading={isLoading} />
      <ShowProjectsButtonContainer>
        <Button color="inherit" href={getLocalePrefix(locale) + "/organizations"}>
          <ShowProjectsText>{texts.explore_all_organizations}</ShowProjectsText>
          <ShowProjectsArrow />
        </Button>
      </ShowProjectsButtonContainer>
    </Root>
  );
}

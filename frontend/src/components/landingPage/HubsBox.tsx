import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import FixedPreviewCards from "./FixedPreviewCards";

const Root = styled("div")({
  width: "90%",
  maxWidth: 1280,
  margin: "0 auto",
});

const Headline = styled(Typography)(({ theme }) => ({
  fontSize: 25,
  fontWeight: 700,
  marginBottom: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    fontSize: 21,
    marginBottom: theme.spacing(2),
  },
})) as typeof Typography;

const ExplainerText = styled(Typography)(({ theme }) => ({
  maxWidth: 750,
  marginBottom: theme.spacing(3),
}));

export default function HubsBox({ hubs, isLoading }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  return (
    <Root>
      <Headline color="primary" component="h1">
        {texts.find_climate_projects_in_each_sector_in_our_hubs}
      </Headline>
      <ExplainerText color="secondary">
        {texts.find_climate_projects_in_each_sector_in_our_hubs_text}
      </ExplainerText>
      <FixedPreviewCards isLoading={isLoading} elements={hubs} type="hub" />
    </Root>
  );
}

import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
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
}));

const ExplainerText = styled(Typography)(({ theme }) => ({
  maxWidth: 750,
  marginBottom: theme.spacing(3),
}));

const ShowProjectsButtonContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
  color: theme.palette.primary.main,
}));

const ShowProjectsArrow = styled(KeyboardArrowRightIcon)(({ theme }) => ({
  marginLeft: theme.spacing(2),
}));

const ShowProjectsText = styled("span")({
  textDecoration: "underline",
});

export default function ProjectsSharedBox({ projects, className, isLoading }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  return (
    <Root className={className}>
      <Headline color="primary" component="h1">
        {texts.climate_action_projects_shared_by_climate_connect_users}
      </Headline>
      <ExplainerText color="secondary">
        {texts.climate_action_projects_shared_by_climate_connect_users_text}
      </ExplainerText>
      <FixedPreviewCards isLoading={isLoading} elements={projects} type="project" />
      <ShowProjectsButtonContainer>
        <Button color="inherit" href={getLocalePrefix(locale) + "/browse"}>
          <ShowProjectsText>{texts.show_all_projects}</ShowProjectsText>
          <ShowProjectsArrow />
        </Button>
      </ShowProjectsButtonContainer>
    </Root>
  );
}

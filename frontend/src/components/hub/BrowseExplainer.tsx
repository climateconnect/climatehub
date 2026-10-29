import { Container, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const StyledBrowseExplainer = styled(Typography)(({ theme }) => ({
  fontSize: 18,
  marginBottom: theme.spacing(2),
  textAlign: "center",
  marginTop: theme.spacing(4),
}));

const Headline = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 700,
  fontSize: 22,
  marginBottom: theme.spacing(2),
}));

export default function BrowseExplainer() {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  return (
    <Container>
      <StyledBrowseExplainer component="div">
        <Headline component="h2">{texts.browse_explainer_text}</Headline>
      </StyledBrowseExplainer>
    </Container>
  );
}

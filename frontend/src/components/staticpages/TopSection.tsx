import { Container, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import SmallCloud from "./SmallCloud";

const noTransientProps = (prop: PropertyKey) => !(typeof prop === "string" && prop.startsWith("$"));

const Root = styled("div", { shouldForwardProp: noTransientProps })<{
  $fixedHeight?: boolean;
  $noMarginBottom?: boolean;
}>(({ theme, $fixedHeight, $noMarginBottom }) => ({
  marginBottom: $fixedHeight || $noMarginBottom ? 0 : theme.spacing(2),
}));

const ContentContainer = styled(Container, { shouldForwardProp: noTransientProps })<{
  $fixedHeight?: boolean;
}>(({ theme, $fixedHeight }) => ({
  display: "flex",
  alignItems: "center",
  padding: $fixedHeight ? 0 : theme.spacing(3),
  position: "relative",
  height: $fixedHeight ? 0 : undefined,
  [theme.breakpoints.down("lg")]: {
    padding: 0,
  },
}));

const HeadersContainer = styled("div")(({ theme }) => ({
  position: "absolute",
  width: 500,
  top: -75,
  background: theme.palette.primary.main,
  padding: theme.spacing(2),
  border: `2px solid ${theme.palette.primary.light}`,
  boxShadow: "5px 5px 5px #00000029",
  [theme.breakpoints.down("lg")]: {
    padding: theme.spacing(1),
    left: theme.spacing(1),
  },
  [theme.breakpoints.down("sm")]: {
    width: 350,
    left: theme.spacing(0.5),
  },
}));

const Headline = styled(Typography)(({ theme }) => ({
  color: theme.palette.yellow.main,
  fontSize: 40,
  fontWeight: "bold",
  [theme.breakpoints.down("lg")]: {
    fontSize: 25,
  },
  [theme.breakpoints.down("sm")]: {
    fontSize: 20,
  },
})) as typeof Typography;

const SubHeader = styled(Typography)(({ theme }) => ({
  fontSize: 19,
  fontWeight: 600,
  color: "white",
  [theme.breakpoints.down("lg")]: {
    fontSize: 17,
  },
  [theme.breakpoints.down("md")]: {
    fontSize: 16,
    fontWeight: 500,
  },
})) as typeof Typography;

const ImageContainer = styled("div")(({ theme }) => ({
  backgroundImage: "url('/images/static_page_header.svg')",
  backgroundSize: "cover",
  borderBottom: `1px solid ${theme.palette.primary.light}`,
}));

const HeaderImage = styled("img")(({ theme }) => ({
  width: "100%",
  maxWidth: 1720,
  minHeight: 100,
  visibility: "hidden",
  [theme.breakpoints.up("md")]: {
    minHeight: 125,
  },
}));

export default function TopSection({ headline, subHeader, fixedHeight, noMarginBottom }: any) {
  return (
    <Root $fixedHeight={fixedHeight} $noMarginBottom={noMarginBottom}>
      <ImageContainer>
        <HeaderImage src="/images/static_page_header.svg" alt="static page header" />
      </ImageContainer>
      <ContentContainer disableGutters $fixedHeight={fixedHeight}>
        <HeadersContainer>
          <Headline component="h1">{headline}</Headline>
          <SubHeader component="h2">{subHeader}</SubHeader>
          <SmallCloud type={1} /*TODO(undefined) className={classes.smallCloud1} */ />
        </HeadersContainer>
      </ContentContainer>
    </Root>
  );
}

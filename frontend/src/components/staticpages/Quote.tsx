import React from "react";
import { Typography, Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";

const noTransientProps = (prop: PropertyKey) => !(typeof prop === "string" && prop.startsWith("$"));

const Root = styled(Container)(({ theme }) => ({
  display: "flex",
  position: "relative",
  textAlign: "center",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}));

const OpenQuoteIconContainer = styled("div", { shouldForwardProp: noTransientProps })<{
  $noPadding?: boolean;
}>(({ theme, $noPadding }) => ({
  width: 180,
  display: "flex",
  flexGrow: 1,
  justifyContent: "center",
  alignItems: "flex-start",
  paddingRight: $noPadding ? 0 : theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    display: "flex",
    justifyContent: "flex-start",
  },
}));

const CloseQuoteIconContainer = styled("div", { shouldForwardProp: noTransientProps })<{
  $noPadding?: boolean;
}>(({ theme, $noPadding }) => ({
  width: 180,
  display: "flex",
  flexGrow: 1,
  justifyContent: "center",
  alignItems: "flex-end",
  paddingLeft: $noPadding ? 0 : theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    marginLeft: "auto",
    display: "flex",
    justifyContent: "flex-end",
  },
}));

const OpenQuoteIcon = styled(FormatQuoteIcon)({
  marginTop: -35,
  fontSize: 80,
});

const ClosingQuoteIcon = styled(FormatQuoteIcon)({
  transform: "rotate(180deg)",
  marginBottom: -35,
  fontSize: 80,
});

const TextBody = styled(Typography)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
  },
}));

export default function Quote({
  text,
  className,
  textClassName,
  quoteIconClassName,
  noPadding,
}: any) {
  return (
    <Root className={className}>
      <OpenQuoteIconContainer $noPadding={noPadding}>
        <OpenQuoteIcon color="primary" className={quoteIconClassName} />
      </OpenQuoteIconContainer>
      <TextBody className={textClassName}>{text}</TextBody>
      <CloseQuoteIconContainer $noPadding={noPadding}>
        <ClosingQuoteIcon color="primary" className={quoteIconClassName} />
      </CloseQuoteIconContainer>
    </Root>
  );
}

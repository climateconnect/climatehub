import React, { PropsWithChildren, ReactElement } from "react";
import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const ExplainerElementWrapper = styled("div", {
  shouldForwardProp: (prop) => !(typeof prop === "string" && prop.startsWith("$")),
})<{ $horizontal?: boolean }>(({ $horizontal }) => ({
  display: "flex",
  flexDirection: $horizontal ? "row" : "column",
  justifyContent: $horizontal ? "center" : "auto",
  alignItems: "center",
  textAlign: $horizontal ? undefined : "center",
  maxWidth: $horizontal ? 330 : 300,
  position: "relative",
}));

const ExplainerIcon = styled("img", {
  shouldForwardProp: (prop) => !(typeof prop === "string" && prop.startsWith("$")),
})<{ $horizontal?: boolean }>(({ theme, $horizontal }) => ({
  maxWidth: 50,
  marginBottom: $horizontal ? 0 : theme.spacing(2),
  marginRight: $horizontal ? theme.spacing(5) : 0,
}));

type Props = PropsWithChildren<{
  icon?: string;
  text: string | ReactElement;
  alt?: string;
  horizontal?: boolean;
}>;
export default function ExplainerElement({ icon, text, children, alt, horizontal }: Props) {
  return (
    <ExplainerElementWrapper $horizontal={horizontal}>
      {children}
      <ExplainerIcon src={icon} $horizontal={horizontal} alt={alt} />
      <Typography>{text}</Typography>
    </ExplainerElementWrapper>
  );
}

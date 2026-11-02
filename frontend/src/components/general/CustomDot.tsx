import React from "react";
import { styled } from "@mui/material/styles";

const Dot = styled("span", {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active?: boolean }>(({ theme, $active }) => ({
  background: $active ? theme.palette.secondary.main : "transparent",
  border: `1px solid ${theme.palette.secondary.main}`,
  borderRadius: "100%",
  margin: theme.spacing(0.5),
  width: 12,
  height: 12,
}));

export default function CustomDot({ onClick, ...rest }: any) {
  const { active } = rest;
  // onMove means if dragging or swiping in progress.
  // active is provided by this lib for checking if the item is active or not.
  return <Dot $active={!!active} onClick={() => onClick()} />;
}

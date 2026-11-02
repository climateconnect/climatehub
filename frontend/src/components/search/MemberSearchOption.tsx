import { IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import React from "react";
import MiniProfilePreview from "../profile/MiniProfilePreview";

// Truncate long names/locations; the avatar must keep its size.
const PreviewWrapper = styled("div")({
  minWidth: 0,
  maxWidth: "100%",
  "& .MuiTypography-root": {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  },
  "& .MuiAvatar-root": {
    flexShrink: 0,
  },
});

type Props = { option; liProps? };

export default function MemberSearchOption({ option, liProps }: Props) {
  // key is passed by the caller on this element, not spread onto the li
  const { key: _key, ...props } = liProps ?? ({} as any);
  return (
    <li {...props}>
      <IconButton size="large">
        <AddCircleOutlineIcon />
      </IconButton>
      <PreviewWrapper>
        <MiniProfilePreview profile={option} nolink size="medium" title={option.location} />
      </PreviewWrapper>
    </li>
  );
}

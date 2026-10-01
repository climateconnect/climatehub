import { Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";

const HubIcon = styled("img")(({ theme }) => ({
  color: theme.palette.primary.main,
  fill: theme.palette.primary.main,
  marginRight: theme.spacing(1.5),
}));

export default function IdeaHubIcon({ idea, className }: any) {
  return (
    <Tooltip title={idea.hub.name}>
      <HubIcon src={getImageUrl(idea.hub.icon)} className={className} alt="idea hub icon" />
    </Tooltip>
  );
}

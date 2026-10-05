import { Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import ExploreIcon from "@mui/icons-material/Explore";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const Sectors = styled("div", {
  shouldForwardProp: (prop) => !(prop as string).startsWith("$"),
})<{ $hovering?: boolean }>(({ theme, $hovering }) => ({
  display: "flex",
  marginBottom: theme.spacing(0.75),
  background: $hovering ? "#e1e1e147" : "auto",
  padding: $hovering ? theme.spacing(2) : 0,
  paddingTop: $hovering ? theme.spacing(1) : 0,
  paddingBottom: $hovering ? theme.spacing(1) : 0,
  alignItems: "center",
}));

const SectorText = styled(Typography)(({ theme }) => ({
  marginLeft: theme.spacing(0.5),
  fontSize: 15,
  maxWidth: "250px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}));

const defaultIconStyles = {
  fontSize: 17,
};

export default function ProjectSectorsDisplay({
  main_project_sector,
  hovering,
  projectSectorClassName,
  color,
  iconClassName,
  className,
}: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  return (
    <Tooltip title={texts.categories}>
      <Sectors $hovering={hovering} className={className}>
        <ExploreIcon
          className={iconClassName}
          sx={iconClassName ? undefined : defaultIconStyles}
          color={color && color}
        />{" "}
        <SectorText className={projectSectorClassName}>{main_project_sector}</SectorText>
      </Sectors>
    </Tooltip>
  );
}

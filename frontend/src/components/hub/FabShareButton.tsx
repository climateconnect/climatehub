import { Fab } from "@mui/material";
import { styled } from "@mui/material/styles";
import { appHref } from "../../../public/lib/appLink";
import AddIcon from "@mui/icons-material/Add";
import React, { useContext } from "react";
import { HubContext } from "../context/HubContext";

const FabShareProject = styled(Fab, {
  shouldForwardProp: (prop) => prop !== "$isCustomHub",
})<{ $isCustomHub: boolean }>(({ theme, $isCustomHub }) => ({
  position: "fixed",
  background: $isCustomHub
    ? theme.palette.background.default_contrastText
    : theme.palette.primary.light,
  color: $isCustomHub ? theme.palette.background.default : "default",
  // bottom: theme.spacing(5),
  right: theme.spacing(3),
}));

interface FabShareButtonProps {
  locale: string;
  hubAmbassador?: any;
  isCustomHub: boolean;
}

export const FabShareButton = ({ locale, hubAmbassador, isCustomHub }: FabShareButtonProps) => {
  const { hubUrl } = useContext(HubContext);
  return (
    <FabShareProject
      $isCustomHub={isCustomHub}
      size="medium"
      color="primary"
      href={appHref("/share", { hubUrl, locale })}
      sx={{ bottom: (theme) => (hubAmbassador ? theme.spacing(11.5) : theme.spacing(5)) }}
    >
      <AddIcon />
    </FabShareProject>
  );
};

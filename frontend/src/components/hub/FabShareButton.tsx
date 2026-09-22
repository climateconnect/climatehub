import { Fab } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { Theme } from "@mui/material/styles";
import { appHref } from "../../../public/lib/appLink";
import AddIcon from "@mui/icons-material/Add";
import React, { useContext } from "react";
import { HubContext } from "../context/HubContext";

type ShareProjectMakeStyleProps = {
  isCustomHub: boolean;
};

const shareProjectFabStyle = makeStyles<Theme, ShareProjectMakeStyleProps>((theme) => ({
  fabShareProject: (props: ShareProjectMakeStyleProps) => ({
    position: "fixed",
    background: props.isCustomHub
      ? theme.palette.background.default_contrastText
      : theme.palette.primary.light,
    color: props.isCustomHub ? theme.palette.background.default : "default",
    // bottom: theme.spacing(5),
    right: theme.spacing(3),
  }),
}));

interface FabShareButtonProps {
  locale: string;
  hubAmbassador?: any;
  isCustomHub: boolean;
}

export const FabShareButton = ({ locale, hubAmbassador, isCustomHub }: FabShareButtonProps) => {
  const { hubUrl } = useContext(HubContext);
  const fabClass = shareProjectFabStyle({ isCustomHub: isCustomHub });
  return (
    <Fab
      className={fabClass.fabShareProject}
      size="medium"
      color="primary"
      href={appHref("/share", { hubUrl, locale })}
      sx={{ bottom: (theme) => (hubAmbassador ? theme.spacing(11.5) : theme.spacing(5)) }}
    >
      <AddIcon />
    </Fab>
  );
};

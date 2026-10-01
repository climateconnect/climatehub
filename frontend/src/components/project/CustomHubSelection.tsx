import React, { ChangeEvent, ElementType, useContext } from "react";
import { Checkbox, IconButton, Tooltip, Typography } from "@mui/material";
import getTexts from "../../../public/texts/texts";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import UserContext from "../context/UserContext";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { makeStyles } from "@mui/styles";
import { useTheme } from "@mui/material/styles";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";

const useStyles = makeStyles(() => ({
  text: {
    color: "inherit",
  },
}));

type Props = {
  currentHubName: string;
  // eslint-disable-next-line no-unused-vars
  handleUpdateSelectedHub: (hubName: string) => void;
  ToolTipIcon?: ElementType;
  typeId?: string;
};

export default function CustomHubSelection({
  currentHubName,
  handleUpdateSelectedHub,
  ToolTipIcon,
  typeId,
}: Props) {
  if (!ToolTipIcon) {
    ToolTipIcon = HelpOutlineIcon;
  }
  const classes = useStyles();
  const theme = useTheme();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ locale: locale, page: "project" });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const type = typeId || "project";

  const label = { inputProps: { "aria-label": "PRIO1 project checkbox" } };
  const prio1Project = currentHubName == "prio1";

  function handlePrio1ProjectCheckbox(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.checked) {
      handleUpdateSelectedHub("prio1");
    } else {
      handleUpdateSelectedHub("");
    }
  }

  const checkboxColor = getBackgroundContrastColor(theme);

  return (
    <Typography component="h2" variant="subtitle2" className={classes.text}>
      <Checkbox
        color={checkboxColor}
        {...label}
        checked={prio1Project}
        onChange={handlePrio1ProjectCheckbox}
      />
      {projectTypeTexts.projectIsPartOfPrio1[type]}
      <Tooltip title={projectTypeTexts.tooltipProjectIsPartOfPrio1[type]}>
        <IconButton size="large">
          <ToolTipIcon />
        </IconButton>
      </Tooltip>
    </Typography>
  );
}

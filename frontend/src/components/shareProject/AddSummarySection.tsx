import { IconButton, TextField, Tooltip, Typography } from "@mui/material";
import React, { useContext, useRef } from "react";

import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";
import { styled, useTheme } from "@mui/material/styles";

const ShortDescriptionWrapper = styled("div")(({ theme }) => ({
  width: "100%",
  [theme.breakpoints.up("md")]: {
    paddingTop: "56.25%",
    position: "relative",
  },
}));

const ShortDescription = styled(TextField)(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: "100%",
    // the original passed the same "input" rule as the root, input and inputMultiline classes
    "& .MuiInputBase-root, & .MuiInputBase-input, & .MuiInputBase-inputMultiline": {
      height: "100%",
      alignItems: "flex-start",
    },
  },
}));

export default function AddSummarySection({
  projectData,
  onDescriptionChange,
  className,
  subHeaderClassname,
  toolTipClassName,
  helpTexts,
  ToolTipIcon,
}) {
  const shortDescriptionRef = useRef(null);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const theme = useTheme();
  const backgroundContrastColor = getBackgroundContrastColor(theme);

  return (
    <div className={className}>
      <Typography component="h2" variant="subtitle2" color="primary" className={subHeaderClassname}>
        {texts["summarize_your_" + projectData.project_type.type_id]}*
        <Tooltip title={helpTexts.shortDescription} className={toolTipClassName}>
          <IconButton size="large">
            <ToolTipIcon />
          </IconButton>
        </Tooltip>
      </Typography>
      <ShortDescriptionWrapper>
        <ShortDescription
          variant="outlined"
          required
          fullWidth
          multiline
          color={backgroundContrastColor}
          helperText={
            texts.briefly_summarise_what_you_are_doing_part_one +
            (projectData.short_description ? projectData.short_description.length : 0) +
            texts.briefly_summarise_what_you_are_doing_part_two
          }
          ref={shortDescriptionRef}
          InputLabelProps={{
            shrink: true,
          }}
          onChange={(event) => onDescriptionChange(event, "short_description")}
          value={projectData.short_description}
        />
      </ShortDescriptionWrapper>
    </div>
  );
}

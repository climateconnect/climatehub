import { IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import React from "react";

const Headline = styled(Typography)(({ theme }) => ({
  fontSize: 20,
  fontWeight: "bold",
  marginBottom: theme.spacing(1),
  color: theme.palette.background.default_contrastText,
}));

export default function DetailledDescriptionInput({ title, helpText, value, onChange, infoKey }) {
  const handleDescriptionChange = (e) => {
    e.preventDefault();
    onChange(e, infoKey);
  };
  return (
    <div>
      <Headline color="contrast" variant="h2">
        {title}
        <Tooltip title={helpText} /*TODO(unused) className={classes.tooltip} */>
          <IconButton size="large">
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>
      </Headline>
      <TextField
        variant="outlined"
        fullWidth
        multiline
        rows={9}
        onChange={handleDescriptionChange}
        value={value}
      />
    </div>
  );
}

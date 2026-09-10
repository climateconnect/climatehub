import React from "react";
import Grid from "@mui/material/Grid";
import makeStyles from "@mui/styles/makeStyles";
import HubPreview from "./HubPreview";

const useStyles = makeStyles(() => ({
  reset: {
    margin: 0,
    padding: 0,
    listStyleType: "none",
    width: "100%",
  },
}));

export default function HubPreviews({ hubs, className }) {
  const classes = useStyles();
  return (
    <Grid className={`${classes.reset} ${className}`} spacing={2} container component="ul">
      {hubs.map((hub, index) => (
        <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }} component="li">
          <HubPreview hub={hub} />
        </Grid>
      ))}
    </Grid>
  );
}

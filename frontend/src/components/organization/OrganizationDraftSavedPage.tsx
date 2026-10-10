import { Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React from "react";

const useStyles = makeStyles((theme) => ({
  root: {
    textAlign: "center",
    padding: theme.spacing(3),
    [theme.breakpoints.up("sm")]: {
      padding: theme.spacing(5),
    },
    marginTop: theme.spacing(4),
    maxWidth: theme.breakpoints.values.lg,
    marginLeft: "auto",
    marginRight: "auto",
  },
  headline: {
    marginBottom: theme.spacing(3),
  },
}));

// Confirmation shown after an organisation was created as a draft, mirroring
// the draft confirmation in ProjectSubmittedPage.
export default function OrganizationDraftSavedPage({ texts }) {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Typography variant="h5" className={classes.headline}>
        {texts.your_organization_has_been_saved_as_a_draft}
      </Typography>
      <Typography variant="h5" className={classes.headline}>
        {texts.you_can_view_edit_and_publish_your_organization_drafts_in_the}
      </Typography>
    </div>
  );
}

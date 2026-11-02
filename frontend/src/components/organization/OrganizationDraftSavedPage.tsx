import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

const Root = styled("div")(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(3),
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(5),
  },
  marginTop: theme.spacing(4),
  maxWidth: theme.breakpoints.values.lg,
  marginLeft: "auto",
  marginRight: "auto",
}));

const Headline = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

// Confirmation shown after an organisation was created as a draft, mirroring
// the draft confirmation in ProjectSubmittedPage.
export default function OrganizationDraftSavedPage({ texts }) {
  return (
    <Root>
      <Headline variant="h5">{texts.your_organization_has_been_saved_as_a_draft}</Headline>
      <Headline variant="h5">
        {texts.you_can_view_edit_and_publish_your_organization_drafts_in_the}
      </Headline>
    </Root>
  );
}

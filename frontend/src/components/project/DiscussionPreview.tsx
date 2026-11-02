import { ButtonBase, Typography } from "@mui/material";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import React from "react";
import Posts from "../communication/Posts";
import { styled } from "@mui/material/styles";

const StyledButtonBase = styled(ButtonBase)(({ theme }) => ({
  width: "100%",
  textAlign: "start",
  marginBottom: theme.spacing(4),
  "&:hover": {
    backgroundColor: "#f5f5f5",
  },
}));

const DiscussionPreviewContainer = styled("div")(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.grey[500]}`,
  borderTop: `1px solid ${theme.palette.grey[500]}`,
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(2),
  width: "100%",
}));

const TopSection = styled("div")({
  display: "flex",
  justifyContent: "space-between",
});

const Heading = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  color: theme.palette.background.default_contrastText,
}));

export default function DiscussionPreview({
  latestParentComment,
  discussionTabLabel,
  handleTabChange,
  typesByTabValue,
  projectTabsRef,
  hubUrl,
}) {
  function switchToDiscussionTab(event) {
    handleTabChange(event, typesByTabValue.indexOf("comments"));
    projectTabsRef.current.scrollIntoView();
  }

  return (
    <StyledButtonBase>
      <DiscussionPreviewContainer onClick={switchToDiscussionTab}>
        <TopSection>
          <Heading display="inline" color="primary">
            {discussionTabLabel}
          </Heading>
          <UnfoldMoreIcon color="secondary" />
        </TopSection>
        <Posts
          posts={latestParentComment}
          type="preview"
          user={latestParentComment.author_user}
          truncate={3}
          noLink={true}
          hubUrl={hubUrl}
        />
      </DiscussionPreviewContainer>
    </StyledButtonBase>
  );
}

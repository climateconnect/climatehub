import { Box, Card, CardActions, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import AppLink from "../general/AppLink";
import OrganizationPreviewHeader from "./OrganizationPreviewHeader";
import OrganizationPreviewBody from "./OrganizationPreviewBody";
import { AssignmentSharp, GroupSharp } from "@mui/icons-material";

const Wrapper = styled(AppLink)({
  display: "block",
  height: "100%",
  textDecoration: "inherit",
  "&:hover": {
    textDecoration: "inherit",
  },
});

const PreviewCard = styled(Card)({
  display: "flex",
  flexDirection: "column",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#f1f1f1",
    boxShadow: "rgba(99, 99, 99, 0.33) 0px 2px 8px 0px;",
  },
  "-webkit-user-select": "none",
  "-moz-user-select": "none",
  "-ms-user-select": "none",
  userSelect: "none",
  backgroundColor: "#f7f7f7",
  backgroundRepeat: "no-repeat",
  backgroundSize: "calc(100% - 1px) 100%",
  borderRadius: "5px",
  textAlign: "center",
  height: "100%",
  boxShadow: "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;",
  padding: "0 14px",
});

const Footer = styled(CardActions)({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  marginTop: "auto",
  marginBottom: "10px",
});

const Members = styled("span")({
  float: "right",
  marginRight: "20px",
  display: "grid",
  gridTemplateColumns: "40px min-content",
  justifyContent: "center",
});

const NumberOfProjects = styled("span")({
  float: "left",
  marginLeft: "20px",
  display: "grid",
  gridTemplateColumns: "40px min-content",
  justifyContent: "center",
});

const MembersIcon = styled(GroupSharp)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

const ProjectsIcon = styled(AssignmentSharp)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

export default function OrganizationPreview({ organization }: { organization: any }) {
  return (
    <Wrapper href={`/organizations/${organization.url_slug}`} underline="hover">
      <PreviewCard variant="outlined">
        <OrganizationPreviewHeader organization={organization} />
        <OrganizationPreviewBody organization={organization} />
        <Footer>
          <Box>
            <Members>
              <Tooltip title="Members in organization">
                <MembersIcon />
              </Tooltip>
              <Typography>{organization.members_count}</Typography>
            </Members>
          </Box>
          <Box>
            <NumberOfProjects>
              <Tooltip title="Number of projects">
                <ProjectsIcon />
              </Tooltip>
              <Typography>{organization.projects_count}</Typography>
            </NumberOfProjects>
          </Box>
        </Footer>
      </PreviewCard>
    </Wrapper>
  );
}

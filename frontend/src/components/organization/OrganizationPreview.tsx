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
  position: "relative",
  overflow: "hidden",
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

const DraftTriangle = styled("div")(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  width: 0,
  height: 0,
  borderTop: "100px solid " + theme.palette.primary.main,
  borderRight: "100px solid transparent",
  zIndex: 1,
}));

const DraftText = styled("div")({
  transform: "rotate(-45deg)",
  display: "block",
  fontWeight: "bold",
  textTransform: "uppercase",
  marginTop: "-56px",
  marginLeft: "10px",
  fontSize: "20px",
  color: "white",
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
  const organizationUrl = organization.is_draft
    ? `/editOrganization/${organization.url_slug}`
    : `/organizations/${organization.url_slug}`;

  return (
    <Wrapper href={organizationUrl} underline="hover">
      <PreviewCard variant="outlined">
        {organization.is_draft && (
          <DraftTriangle>
            <DraftText>Draft</DraftText>
          </DraftTriangle>
        )}
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

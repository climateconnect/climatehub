import { Box, Card, CardActions, Tooltip, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React from "react";
import AppLink from "../general/AppLink";
import OrganizationPreviewHeader from "./OrganizationPreviewHeader";
import OrganizationPreviewBody from "./OrganizationPreviewBody";
import { AssignmentSharp, GroupSharp } from "@mui/icons-material";

const useStyles = makeStyles((theme) => {
  return {
    wrapper: {
      display: "block",
      height: "100%",
      textDecoration: "inherit",
      "&:hover": {
        textDecoration: "inherit",
      },
    },
    root: {
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
    },
    draftTriangle: {
      position: "absolute",
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      borderTop: "100px solid " + theme.palette.primary.main,
      borderRight: "100px solid transparent",
      zIndex: 1,
    },
    draftText: {
      transform: "rotate(-45deg)",
      display: "block",
      fontWeight: "bold",
      textTransform: "uppercase",
      marginTop: "-56px",
      marginLeft: "10px",
      fontSize: "20px",
      color: "white",
    },
    button: {
      marginTop: theme.spacing(1),
      margin: "0 auto",
      display: "block",
    },
    media: {
      height: 80,
      width: 80,
      backgroundSize: "contain",
      marginTop: theme.spacing(3),
      margin: "0 auto",
    },
    footer: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      marginTop: "auto",
      marginBottom: "10px",
    },
    members: {
      float: "right",
      marginRight: "20px",
      display: "grid",
      gridTemplateColumns: "40px min-content",
      justifyContent: "center",
    },
    number_of_projects: {
      float: "left",
      marginLeft: "20px",
      display: "grid",
      gridTemplateColumns: "40px min-content",
      justifyContent: "center",
    },
    iconColor: {
      color: theme.palette.background.default_contrastText,
    },
  };
});

export default function OrganizationPreview({ organization }: { organization: any }) {
  const classes = useStyles();

  const organizationUrl = organization.is_draft
    ? `/editOrganization/${organization.url_slug}`
    : `/organizations/${organization.url_slug}`;

  return (
    <AppLink href={organizationUrl} underline="hover" className={classes.wrapper}>
      <Card className={classes.root} variant="outlined">
        {organization.is_draft && (
          <div className={classes.draftTriangle}>
            <div className={classes.draftText}>Draft</div>
          </div>
        )}
        <OrganizationPreviewHeader organization={organization} />
        <OrganizationPreviewBody organization={organization} />
        <CardActions className={classes.footer}>
          <Box>
            <span className={classes.members}>
              <Tooltip title="Members in organization">
                <GroupSharp className={classes.iconColor} />
              </Tooltip>
              <Typography>{organization.members_count}</Typography>
            </span>
          </Box>
          <Box>
            <span className={classes.number_of_projects}>
              <Tooltip title="Number of projects">
                <AssignmentSharp className={classes.iconColor} />
              </Tooltip>
              <Typography>{organization.projects_count}</Typography>
            </span>
          </Box>
        </CardActions>
      </Card>
    </AppLink>
  );
}

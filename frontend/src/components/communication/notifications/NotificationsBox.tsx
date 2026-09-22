import { Menu } from "@mui/material";
import withStyles from "@mui/styles/withStyles";
import React from "react";

const NotificationsBox: any = withStyles({
  paper: {
    border: "1px solid #d3d4d5",
    minWidth: 300,
  },
})((props: any) => (
  <Menu
    elevation={0}
    getContentAnchorEl={null}
    disableScrollLock
    anchorOrigin={{
      vertical: "bottom",
      horizontal: "center",
    }}
    transformOrigin={{
      vertical: "top",
      horizontal: "center",
    }}
    {...props}
  />
));

export default NotificationsBox;

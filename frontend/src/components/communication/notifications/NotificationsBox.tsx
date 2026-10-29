import { Menu, menuClasses } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

const NotificationsBox: any = styled((props: any) => (
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
))({
  [`& .${menuClasses.paper}`]: {
    border: "1px solid #d3d4d5",
    minWidth: 300,
  },
});

export default NotificationsBox;

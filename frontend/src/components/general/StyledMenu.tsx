import { Menu, menuClasses } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

const StyledMenu: any = styled((props: any) => (
  <Menu
    elevation={0}
    getContentAnchorEl={null}
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
    width: 64,
  },
});

export default StyledMenu;

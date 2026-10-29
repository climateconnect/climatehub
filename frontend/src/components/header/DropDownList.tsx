import { Link, MenuItem, MenuList, Paper, Popper } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import UserContext from "../context/UserContext";
import { getStaticLinkFromItem } from "../../../public/lib/headerLinks";

const ClimateHubOption = styled(MenuItem)<{ component?: React.ElementType }>(({ theme }) => ({
  textAlign: "center",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  fontWeight: 600,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  color: theme.palette.background.default_contrastText,
}));

const StyledPopper = styled(Popper)({
  zIndex: 25,
});

const HoverBorderColorLink = styled(Link)(({ theme }) => ({
  "&:hover": {
    color: theme.palette.background.default_contrastText,
  },
}));

export default function DropDownList({
  buttonRef,
  handleOpen,
  handleClose,
  items,
  open,
  loadOnClick,
  popperRef,
}: any) {
  const { locale, startLoading } = useContext(UserContext);
  const handleClickLink = () => {
    startLoading();
  };

  return (
    <StyledPopper open={open} anchorEl={buttonRef.current}>
      <Paper ref={popperRef} onMouseEnter={handleOpen} onMouseLeave={handleClose}>
        <MenuList>
          {items?.map((item, index) => (
            <HoverBorderColorLink
              key={index}
              href={getStaticLinkFromItem(locale, item)} // add isExternalLink
              onClick={loadOnClick && handleClickLink}
              underline="hover"
              target={item.target || "_self"}
            >
              <ClimateHubOption component="button">{item.text}</ClimateHubOption>
            </HoverBorderColorLink>
          ))}
        </MenuList>
      </Paper>
    </StyledPopper>
  );
}

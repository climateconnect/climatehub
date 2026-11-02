import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import React, { useRef, useState } from "react";
import DropDownList from "../header/DropDownList";

const Root = styled("div")({
  position: "relative",
});

const StyledButton = styled(Button)(({ theme }) => ({
  paddingRight: theme.spacing(0.5),
  paddingLeft: theme.spacing(1.5),
}));

export default function DropDownButton({ buttonProps, options, children, href }: any) {
  const [showOptions, setShowOptions] = useState(false);
  const buttonRef = useRef(null);

  const handleShowOptions = (e) => {
    e.preventDefault();
    setShowOptions(true);
  };

  const handleHideOptions = () => {
    setShowOptions(false);
  };

  return (
    <Root>
      <StyledButton
        ref={buttonRef}
        onMouseEnter={handleShowOptions}
        onMouseLeave={handleHideOptions}
        {...buttonProps}
        className={buttonProps ? buttonProps.className : undefined}
        href={href ? href : buttonProps.href}
        color="inherit"
      >
        {children}
        <ArrowDropDownIcon />
      </StyledButton>
      <DropDownList
        buttonRef={buttonRef}
        handleClose={handleHideOptions}
        handleOpen={handleShowOptions}
        items={options}
        open={showOptions}
      />
    </Root>
  );
}

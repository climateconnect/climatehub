import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

const StyledButton = styled(Button)(({ theme }) => ({
  background: theme.palette.primary.extraLight,
  color: theme.palette.primary.main,
  height: 55,
  paddingLeft: theme.spacing(4),
  paddingRight: theme.spacing(4),
  fontSize: 18,
  "&:hover": {
    background: "#fff",
  },
}));

export default function LightBigButton({
  className,
  children,
  href,
  onClick,
}: {
  className?: string;
  children?;
  href?: string;
  onClick?;
}) {
  return (
    <StyledButton variant="contained" href={href} className={className} onClick={onClick}>
      {children}
    </StyledButton>
  );
}

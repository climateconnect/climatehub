import React from "react";
import { styled } from "@mui/material/styles";

const ImageContainer = styled("div")(({ theme }) => ({
  width: "100%",
  [theme.breakpoints.down("sm")]: {
    height: 180,
  },
  position: "relative",
  textAlign: "center",
  backgroundSize: "cover",
  height: 250,
}));

export default function HeaderImage({ src, children, className }) {
  return (
    <ImageContainer className={className} style={{ backgroundImage: "url(" + src + ")" }}>
      {children}
    </ImageContainer>
  );
}

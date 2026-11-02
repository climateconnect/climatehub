import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const ImageContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$isLocationHub",
})<{ $isLocationHub?: boolean }>(({ theme, $isLocationHub }) => ({
  backgroundSize: "cover",
  backgroundPosition: "bottom center",
  zIndex: -1,
  width: "100%",
  [theme.breakpoints.down("md")]: {
    minHeight: 100,
    backgroundSize: "cover",
  },
  position: "relative",
  [theme.breakpoints.up("md")]: {
    position: $isLocationHub ? "absolute" : "relative", // we want to have absolute positioning when its a location hub and user is not logged out
    zIndex: -1,
    minHeight: 200,
  },
}));

const HeaderImg = styled("img", {
  shouldForwardProp: (prop) => prop !== "$fullWidth",
})<{ $fullWidth?: boolean }>(({ $fullWidth }) => ({
  width: $fullWidth ? "80%" : "50%",
  visibility: "hidden",
}));

export default function HubHeaderImage({ image, source, fullWidth, isLocationHub }: any) {
  const { locale } = useContext(UserContext);

  const texts = getTexts({ page: "hub", locale: locale });
  return (
    <>
      <ImageContainer $isLocationHub={isLocationHub} style={{ backgroundImage: `url('${image}')` }}>
        <HeaderImg src={image} $fullWidth={fullWidth} alt="hub header" />
      </ImageContainer>
      {source && (
        <Typography
          sx={(theme) => ({
            float: "right",
            fontSize: 12,
            marginRight: theme.spacing(2),
          })}
        >
          {texts.image}: {source}
        </Typography>
      )}
    </>
  );
}

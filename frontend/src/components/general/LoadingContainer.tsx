import { Typography } from "@mui/material";
import { keyframes, styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { Box } from "@mui/system";

const SpinnerContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$subtractedHeight",
})<{ $subtractedHeight?: string }>(({ $subtractedHeight }) => ({
  display: "flex",
  position: "relative",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  height: `calc(100vh - ${$subtractedHeight}px)`,
  flexDirection: "column",
}));

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

export default function LoadingContainer({ headerHeight, footerHeight }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });
  return (
    <SpinnerContainer $subtractedHeight={(headerHeight + footerHeight).toString()}>
      <div>
        <LoadingIcon />
      </div>
      <Typography component="div" sx={{ fontSize: 18 }}>
        {texts.loading_and_waiting}
      </Typography>
    </SpinnerContainer>
  );
}

function LoadingIcon() {
  return (
    <Box
      component="img"
      src="/images/logo_spinner.svg"
      sx={{
        height: 80,
        width: 80,
        animation: `${spin} 2s linear infinite`,
      }}
    />
  );
}

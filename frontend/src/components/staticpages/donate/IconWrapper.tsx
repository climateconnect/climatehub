import React from "react";
import { styled } from "@mui/material/styles";

const LeftWrapper = styled("div", {
  shouldForwardProp: (prop) => prop !== "$noPadding",
})<{ $noPadding?: boolean }>(({ theme, $noPadding }) => ({
  padding: $noPadding ? 0 : theme.spacing(4),
  paddingTop: $noPadding ? 0 : theme.spacing(1),
  paddingBottom: 0,
}));

const IconContainer = styled("div")({
  width: 40,
});

const Icon = styled("img")({
  width: "100%",
});

type Props = {
  src: string;
  noPadding?: boolean;
};

export default function IconWrapper({ src, noPadding }: Props) {
  return (
    <LeftWrapper $noPadding={noPadding}>
      <IconContainer>
        <Icon src={src} alt="icon" />
      </IconContainer>
    </LeftWrapper>
  );
}

import { styled } from "@mui/material/styles";
import React from "react";

type CloudProps = {
  $show?: boolean;
  $type?: number | string;
  $light?: boolean;
  $white?: boolean;
  $reverse?: boolean;
};

const Cloud = styled("span", {
  shouldForwardProp: (prop) => !(typeof prop === "string" && prop.startsWith("$")),
})<CloudProps>(({ $show, $type, $light, $white, $reverse }) => ({
  display: !$show ? "none" : undefined,
  backgroundImage:
    "url(/icons/small-cloud-" + $type + ($light ? "-light" : $white ? "-white" : "") + ".svg)",
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  height: 50,
  width: 85,
  transform: $reverse ? "scaleX(-1)" : "auto",
}));

export default function SmallCloud({ className, type, reverse, light, show, white }: any) {
  return (
    <Cloud
      className={className}
      $type={type}
      $reverse={reverse}
      $light={light}
      $white={white}
      $show={show}
    />
  );
}

import { styled } from "@mui/material/styles";
import React from "react";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PersonIcon from "@mui/icons-material/Person";

type StyleProps = {
  $color: string;
  $size: number;
};

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

const iconStyles = ({ $color, $size }: StyleProps) => ({
  height: $color === "earth" ? $size : "auto",
  fontSize: $color === "earth" ? "inherit" : `${$size}px !important`,
});

const PlanetImage = styled("img", { shouldForwardProp })<StyleProps>(iconStyles);

const StyledFavoriteIcon = styled(FavoriteIcon, { shouldForwardProp })<StyleProps>((props) => ({
  ...iconStyles(props),
  color: props.$color,
}));

const StyledPersonIcon = styled(PersonIcon, { shouldForwardProp })<StyleProps>((props) => ({
  ...iconStyles(props),
  color: props.$color,
}));

export default function ButtonIcon({ icon, color, size }) {
  if (icon === "like") {
    return color === "earth" ? (
      <PlanetImage
        $color={color}
        $size={size}
        src={"/images/like-planet-earth.svg"}
        alt="like planet"
      />
    ) : (
      <StyledFavoriteIcon $color={color} $size={size} />
    );
  }
  if (icon === "follow") {
    return color === "earth" ? (
      <PlanetImage
        $color={color}
        $size={size}
        src={"/images/follow-planet-earth.svg"}
        alt="follow planet"
      />
    ) : (
      <StyledPersonIcon $color={color} $size={size} />
    );
  }
  return <></>;
}

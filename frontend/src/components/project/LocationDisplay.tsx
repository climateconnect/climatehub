import { Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import PlaceIcon from "@mui/icons-material/Place";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const Root = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(0.75),
  marginRight: theme.spacing(0.5),
}));

export default function LocationDisplay({
  location,
  textClassName,
  color,
  iconClassName,
  className,
}: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });
  return (
    <Tooltip title={texts.location}>
      <Root className={className}>
        <PlaceIcon className={iconClassName} color={color} />
        <Typography className={textClassName}>{location}</Typography>
      </Root>
    </Tooltip>
  );
}

import { Container, Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import theme from "../../../themes/theme";
import IconWrapper from "./IconWrapper";

// The original makeStyles used the statically imported theme (not the context theme)
const Root = styled(Container)({
  display: "flex",
});

const NarrowIcon = styled("img")({
  width: 28,
  marginBottom: theme.spacing(-2),
  marginRight: theme.spacing(2),
});

type Props = {
  className?: any;
  headlineClass?: any;
  textBodyClass?: any;
  icon?: any;
  text?: any;
  headline?: any;
  children?: any;
  subPoints?: any;
  subHeadlineClass?: any;
};
export default function TextBox({
  className,
  headlineClass,
  textBodyClass,
  icon,
  text,
  headline,
  children,
  subPoints,
  subHeadlineClass,
}: Props) {
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  return (
    <Root className={className}>
      {!isNarrowScreen && <IconWrapper src={icon} />}
      <div>
        <Typography component="h1" className={headlineClass}>
          {isNarrowScreen && <NarrowIcon src={icon} alt="icon" />}
          {headline}
        </Typography>
        {children}
        <Typography className={textBodyClass}>{text}</Typography>
        {subPoints &&
          subPoints.map((p, index) => (
            <div key={index}>
              <Typography component="h2" className={subHeadlineClass}>
                {p.headline}
              </Typography>
              <Typography>{p.text}</Typography>
            </div>
          ))}
      </div>
    </Root>
  );
}

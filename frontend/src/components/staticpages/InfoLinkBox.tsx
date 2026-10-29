import React from "react";
import { Typography, Link } from "@mui/material";
import { styled } from "@mui/material/styles";

const noTransientProps = (prop: PropertyKey) => !(typeof prop === "string" && prop.startsWith("$"));

const NoUnderlineLink = styled(Link)({
  textDecoration: "inherit",
  "&:hover": {
    textDecoration: "inherit",
  },
  color: "inherit",
});

const Box = styled("div", { shouldForwardProp: noTransientProps })<{ $centerContent?: boolean }>(
  ({ theme, $centerContent }) => ({
    display: "flex",
    alignItems: "center",
    maxWidth: 600,
    marginLeft: $centerContent ? theme.spacing(5) : 0,
    background: "#E6E5E5",
    padding: theme.spacing(3),
    [theme.breakpoints.down("md")]: {
      width: "100%",
      maxWidth: 700,
      margin: "0 auto",
      marginTop: theme.spacing(3),
    },
  })
);

const Icon = styled("img", { shouldForwardProp: noTransientProps })<{ $centerContent?: boolean }>(
  ({ theme, $centerContent }) => ({
    marginRight: $centerContent ? 0 : theme.spacing(3),
    width: 80,
    ["@media (max-width: 400px)"]: {
      width: 45,
    },
  })
);

const Headline = styled(Typography)(({ theme }) => ({
  fontSize: 20,
  fontWeight: 700,
  marginBottom: theme.spacing(1),
  ["@media (max-width: 400px)"]: {
    fontSize: 21,
  },
})) as typeof Typography;

const Text = styled(Typography)({
  fontWeight: 600,
});

export default function InfoLinkBox({
  className,
  iconSrc,
  iconAlt,
  text,
  headline,
  children,
  centerContent,
  link,
}: any) {
  return (
    <NoUnderlineLink href={link} underline="hover">
      <Box className={className} $centerContent={centerContent}>
        <Icon src={iconSrc} $centerContent={centerContent} alt={iconAlt} />
        <div>
          <Headline color="primary" component="h2">
            {headline}
          </Headline>

          <Text color="secondary">{text}</Text>
          {children}
        </div>
      </Box>
    </NoUnderlineLink>
  );
}

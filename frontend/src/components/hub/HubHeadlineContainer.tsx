import { Button, Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import theme from "../../themes/theme";
import { appHref } from "../../../public/lib/appLink";
import { HubContext } from "../context/HubContext";

const Root = styled("div", {
  shouldForwardProp: (prop) => prop !== "$isLocationHub",
})<{ $isLocationHub?: boolean }>(({ theme, $isLocationHub }) => ({
  minWidth: 300,

  background: theme.palette.primary.main,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-around",

  maxWidth: "800px",
  borderRadius: 5,
  border: `3px solid ${theme.palette.primary.main}`,
  marginTop: $isLocationHub ? theme.spacing(8) : theme.spacing(-11),
  [theme.breakpoints.down("md")]: {
    marginTop: $isLocationHub ? theme.spacing(-11) : theme.spacing(-11),
  },

  ["@media(max-width:960px)"]: {
    maxWidth: 550,
  },
}));

const HeadlineContainer = styled("div")({
  display: "flex",
  alignItems: "center",
});

const SubHeadlineContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$isLocationHub",
})<{ $isLocationHub?: boolean }>(({ theme, $isLocationHub }) => ({
  background: "#f0f2f5",
  borderRadius: 5,
  padding: theme.spacing(1),
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(2),
    paddingBottom: $isLocationHub ? theme.spacing(1) : theme.spacing(2),
  },
}));

const LocationSubHeadlineTextContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active?: boolean }>(({ theme, $active }) =>
  $active
    ? {
        background: "white",
        borderRadius: "25px",
        color: theme.palette.secondary.main,
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: theme.spacing(1.5),
      }
    : {}
);

const SignUpContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginTop: theme.spacing(1),
}));

export default function HubHeadlineContainer({ subHeadline, headline, isLocationHub }) {
  const { locale, user } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);

  const texts = getTexts({ page: "general", locale: locale });
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));

  return (
    <Root $isLocationHub={isLocationHub}>
      <HeadlineContainer>
        <Typography
          variant="h4"
          component="h1"
          sx={(theme) => ({
            fontWeight: 700,
            [theme.breakpoints.down("md")]: {
              fontSize: 25,
            },
            [theme.breakpoints.down("sm")]: {
              fontSize: 25,
            },
            color: "white",
            padding: theme.spacing(1),
          })}
        >
          {headline}
        </Typography>
      </HeadlineContainer>
      <SubHeadlineContainer $isLocationHub={isLocationHub}>
        <LocationSubHeadlineTextContainer $active={!!isLocationHub}>
          <Typography sx={{ fontWeight: 600 }}>{subHeadline}</Typography>
        </LocationSubHeadlineTextContainer>

        {isLocationHub && (
          <>
            {!isNarrowScreen && <hr />}
            {isNarrowScreen && !user && (
              <SignUpContainer>
                <Button
                  href={appHref("/signup", { hubUrl, locale })}
                  variant="contained"
                  color="primary"
                >
                  {texts.sign_up_now}
                </Button>
              </SignUpContainer>
            )}
          </>
        )}
      </SubHeadlineContainer>
    </Root>
  );
}

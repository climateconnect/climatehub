import { Button, Theme, Typography, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import theme from "../../themes/theme";
import { appHref } from "../../../public/lib/appLink";
import { HubContext } from "../context/HubContext";

const useStyles = makeStyles((theme) => ({
  root: (props) => ({
    minWidth: 300,

    background: theme.palette.primary.main,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-around",

    maxWidth: "800px",
    borderRadius: 5,
    border: `3px solid ${theme.palette.primary.main}`,
    marginTop: props.isLocationHub ? theme.spacing(8) : theme.spacing(-11),
    [theme.breakpoints.down("md")]: {
      marginTop: props.isLocationHub ? theme.spacing(-11) : theme.spacing(-11),
    },

    ["@media(max-width:960px)"]: {
      maxWidth: 550,
    },
  }),
  headlineContainer: {
    display: "flex",
    alignItems: "center",
  },

  headline: {
    fontWeight: 700,
    [theme.breakpoints.down("md")]: {
      fontSize: 25,
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: 25,
    },
    color: "white",
    padding: theme.spacing(1),
  },

  subHeadlineContainer: (props) => ({
    background: "#f0f2f5",
    borderRadius: 5,
    padding: theme.spacing(1),
    [theme.breakpoints.up("sm")]: {
      padding: theme.spacing(2),
      paddingBottom: props.isLocationHub ? theme.spacing(1) : theme.spacing(2),
    },
  }),

  highlighted: {
    color: theme.palette.yellow.main,
  },
  subHeadLineText: {
    fontWeight: 600,
  },

  locationSubHeadlineTextContainer: {
    background: "white",
    borderRadius: "25px",
    color: theme.palette.secondary.main,
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: theme.spacing(1.5),
  },
  signUpContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: theme.spacing(1),
  },
}));

export default function HubHeadlineContainer({ subHeadline, headline, isLocationHub }) {
  const classes = useStyles({ isLocationHub: isLocationHub });
  const { locale, user } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);

  const texts = getTexts({ page: "general", locale: locale });
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));

  return (
    <div className={classes.root}>
      <div className={classes.headlineContainer}>
        <Typography variant="h4" component="h1" className={classes.headline}>
          {headline}
        </Typography>
      </div>
      <div className={classes.subHeadlineContainer}>
        <div className={`${isLocationHub && classes.locationSubHeadlineTextContainer}`}>
          <Typography className={classes.subHeadLineText}>{subHeadline}</Typography>
        </div>

        {isLocationHub && (
          <>
            {!isNarrowScreen && <hr />}
            {isNarrowScreen && !user && (
              <div className={classes.signUpContainer}>
                <Button
                  href={appHref("/signup", { hubUrl, locale })}
                  variant="contained"
                  color="primary"
                >
                  {texts.sign_up_now}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

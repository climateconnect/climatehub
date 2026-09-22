import { Button, Theme, Typography, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import theme from "../../themes/theme";
import IconWrapper from "../staticpages/donate/IconWrapper";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { appHref } from "../../../public/lib/appLink";
import { useRouter } from "next/router";
import { HubContext } from "../context/HubContext";

type MakeStylesProps = {
  isLocationHub: boolean;
  isNarrowScreen: boolean;
};

const useStyles = makeStyles((theme) => ({
  root: (props: MakeStylesProps) => ({
    display: "flex",
    flexDirection: props.isNarrowScreen ? "column" : "row",
    [theme.breakpoints.down("md")]: {
      marginTop: theme.spacing(0),
      marginBottom: theme.spacing(-6),
    },
  }),
  contentContainer: (props: MakeStylesProps) => ({
    minWidth: 300,
    background: theme.palette.primary.main,
    display: "flex",
    flexDirection: "column",
    justifyContent: props.isNarrowScreen ? "space-around" : "flex-start",
    maxWidth: "800px",
    borderRadius: 5,
    border: `3px solid ${theme.palette.primary.main}`,
    marginTop: props.isLocationHub ? 0 : theme.spacing(-11),
    // marginBottom: theme.spacing(2),

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
      fontSize: 22,
    },
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(1),
  },
  lowerBoxWrapper: {
    background: "white",
    borderTopRightRadius: 10,
    borderTopLeftRadius: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: theme.spacing(2),
    [theme.breakpoints.down("md")]: {
      alignItems: "flex-start",
    },
  },
  advantagesBox: {
    display: "flex",
    justifyContent: "space-around",
    paddingBottom: theme.spacing(2),
    textAlign: "center",
    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
      paddingBottom: 0,
    },
  },
  reasonToJoin: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "30%",
    [theme.breakpoints.down("md")]: {
      flexDirection: "row",
      width: "100%",
      textAlign: "start",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
  },
  reasonText: {
    [theme.breakpoints.down("md")]: {
      fontSize: 15,
      fontWeight: 500,
      color: theme.palette.secondary.main,
      marginLeft: theme.spacing(2),
    },
  },
  signUpButton: {
    [theme.breakpoints.down("md")]: {
      width: "100%",
      textAlign: "center",
    },
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    background: "white",
    paddingBottom: theme.spacing(2),
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
    [theme.breakpoints.down("md")]: {
      paddingBottom: 0,
      borderBottom: 0,
    },
  },
  icon: {
    color: theme.palette.primary.light,
  },
}));

export default function LoggedOutLocationHubBox({ headline, isLocationHub, location }) {
  const { locale } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);
  const texts = getTexts({
    page: "dashboard",
    locale: locale,
    hubName: location,
  });

  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const classes = useStyles({ isLocationHub: isLocationHub, isNarrowScreen: isNarrowScreen });

  const REASONS_TO_JOIN = [
    {
      text: texts.find_engagement,
      icon: "/icons/floating_sign_heart.svg",
      iconMobile: FavoriteIcon,
    },
    {
      text: texts.find_collaborators_for_your_idea,
      icon: "/icons/floating_sign_lightbulb.svg",
      iconMobile: LightbulbIcon,
    },
    {
      text: texts.share_your_climate_project,
      icon: "/icons/floating_sign_group.svg",
      iconMobile: GroupAddIcon,
    },
  ];

  function ReasonToJoin({ reason }) {
    return (
      <div className={classes.reasonToJoin}>
        {isNarrowScreen ? (
          <reason.iconMobile className={classes.icon} />
        ) : (
          <IconWrapper src={reason.icon} noPadding={isNarrowScreen} />
        )}
        <Typography className={classes.reasonText}>{reason.text}</Typography>
      </div>
    );
  }

  function Headline() {
    return (
      <div className={classes.headlineContainer}>
        <Typography variant="h4" component="h1" className={classes.headline}>
          {headline}
        </Typography>
      </div>
    );
  }
  const router = useRouter();
  const subHub = router.query?.subHub;
  const parentHub = router.query?.hubUrl;

  return (
    <div className={classes.root}>
      <div className={classes.contentContainer}>
        <Headline />
        <div className={classes.lowerBoxWrapper}>
          <Typography component="p">
            {(texts as any)[(subHub ? (subHub as string) : (parentHub as string)) + "_welcometext"]}
          </Typography>
          {!subHub && (
            <div className={classes.advantagesBox}>
              {REASONS_TO_JOIN.map((r) => (
                <ReasonToJoin reason={r} key={r.text} />
              ))}
            </div>
          )}
        </div>
        <div className={classes.buttonContainer}>
          <Button
            variant="contained"
            href={appHref("/signup", { hubUrl, locale })}
            className={classes.signUpButton}
          >
            {isNarrowScreen ? texts.sign_up_now : texts.sign_up_now_to_make_a_difference}
          </Button>
        </div>
      </div>
    </div>
  );
}

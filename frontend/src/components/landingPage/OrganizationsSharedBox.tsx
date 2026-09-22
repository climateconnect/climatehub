import { Button, Theme, Typography, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import OrganizationPreviewsFixed from "../organization/OrganizationPreviewsFixed";
import SmallCloud from "../staticpages/SmallCloud";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "90%",
    maxWidth: 1280,
    margin: "0 auto",
    marginTop: theme.spacing(15),
    position: "relative",
  },
  headline: {
    fontSize: 25,
    fontWeight: 700,
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down("md")]: {
      fontSize: 21,
    },
  },
  explainerText: {
    maxWidth: 660,
    marginBottom: theme.spacing(3),
  },
  showProjectsButtonContainer: {
    marginTop: theme.spacing(3),
  },
  showProjectsArrow: {
    marginLeft: theme.spacing(2),
  },
  showProjectsText: {
    textDecoration: "underline",
  },
  smallCloud1: {
    position: "absolute",
    top: -60,
    right: "50%",
  },
  smallCloud2: {
    position: "absolute",
    right: "10%",
    top: -100,
    width: 100,
    height: 80,
  },
}));

export default function OrganizationsSharedBox({ organizations, isLoading }) {
  const classes = useStyles();
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({
    page: "landing_page",
    locale: locale,
    classes: classes,
    isNarrowScreen: isNarrowScreen,
  });
  return (
    <div className={classes.root}>
      <SmallCloud type={2} className={classes.smallCloud1} />
      <SmallCloud type={1} className={classes.smallCloud2} reverse />
      <Typography className={classes.headline} component="h1" color="primary">
        {texts.find_a_climate_action_organization_and_get_involved}
      </Typography>
      <Typography className={classes.explainerText}>
        {texts.find_a_climate_action_organization_and_get_involved_text}{" "}
        {!isNarrowScreen && (
          <>{texts.find_a_climate_action_organization_and_get_involved_additional_text}</>
        )}
      </Typography>
      <OrganizationPreviewsFixed organizations={organizations} isLoading={isLoading} />
      <div className={classes.showProjectsButtonContainer}>
        <Button color="inherit" href={getLocalePrefix(locale) + "/organizations"}>
          <span className={classes.showProjectsText}>{texts.explore_all_organizations}</span>
          <KeyboardArrowRightIcon className={classes.showProjectsArrow} />
        </Button>
      </div>
    </div>
  );
}

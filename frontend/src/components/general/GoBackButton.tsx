import { Button, IconButton, Theme } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
  WASSERAKTIONSWOCHEN_PATH,
  getWasseraktionswochenUrl,
} from "../../../public/data/wasseraktionswochen_config.js";

type StyleProps = {
  hubSlug?: string;
};
const PRIO1_SLUG = "prio1";

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => ({
  button: (props) => ({
    color:
      props.hubSlug === PRIO1_SLUG
        ? theme.palette.background.default
        : theme.palette.primary.contrastText,
    height: 54,
    [theme.breakpoints.down("sm")]: {
      minWidth: 35,
      maxWidth: 35,
      minHeight: 35,
      maxHeight: 35,
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      "&:hover": {
        backgroundColor: theme.palette.primary.main,
      },
    },
  }),
}));

export default function GoBackButton({
  texts,
  tinyScreen,
  locale,
  containerClassName,
  hubSlug,
  project,
  defaultBackUrl,
}: any) {
  const classes = useStyles({ hubSlug: hubSlug });
  const router = useRouter();

  const [backButtonText, setBackButtonText] = useState(texts.go_back);
  const [specialEventPagePath, setSpecialEventPagePath] = useState<string | null>(null);

  // Check if user came from a special event page and set button text accordingly
  useEffect(() => {
    if (typeof document === "undefined" || !project?.parent_project_slug) {
      return;
    }

    const referrer = document.referrer;

    // Check if user came from a special event page
    if (referrer.includes(WASSERAKTIONSWOCHEN_PATH)) {
      const backText =
        texts.back_to_parent?.replace("{parent_name}", project.parent_project_name || "") ||
        texts.go_back;
      setBackButtonText(backText);
      setSpecialEventPagePath(getWasseraktionswochenUrl(locale));
    }
  }, [project?.parent_project_slug, project?.parent_project_name, texts, locale]);

  const getDefaultBackUrl = () => {
    if (defaultBackUrl) {
      return defaultBackUrl;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const hubPage = urlParams.get("hub");

    // If hub parameter exists, go to hub browse page
    if (hubPage) {
      return "/" + locale + "/hubs/" + hubPage + "/browse";
    }
    return "/" + locale + "/browse";
  };

  const isInternalReferrer = (referrer: string): boolean => {
    if (!referrer) return false;
    try {
      return new URL(referrer).host === window.location.host;
    } catch {
      return false;
    }
  };

  const goBack = () => {
    // Priority 1: If user came from a special event page, go back there
    if (specialEventPagePath) {
      router.push(specialEventPagePath);
      return;
    }

    // Priority 2: Go back to the page the user actually came from, acting like
    // the browser back button. Only do so when the referrer indicates an
    // internal page AND there is actual history to go back to.
    //
    // When the user arrives via a server-side redirect (e.g. a vanity URL like
    // /klimakuechen-erlangen → /de/projects/klimakuechen), the Fetch spec sets
    // document.referrer to the redirect source URL (same host), which makes
    // isInternalReferrer return true. However, for permanent (301) redirects
    // the browser does not add the source to the history stack, so
    // router.back() with history.length === 1 would silently do nothing.
    // Checking history.length > 1 prevents this silent no-op.
    const hasBackHistory = typeof window !== "undefined" && window.history.length > 1;
    if (
      hasBackHistory &&
      typeof document !== "undefined" &&
      isInternalReferrer(document.referrer)
    ) {
      router.back();
    } else {
      router.push(getDefaultBackUrl());
    }
  };

  if (tinyScreen)
    return (
      <div className={containerClassName}>
        <IconButton onClick={goBack} className={classes.button} size="large">
          {/*adjusted viewBox to center the icon*/}
          <ArrowBackIosIcon fontSize="small" viewBox="-4.5 0 24 24" />
        </IconButton>
      </div>
    );
  else
    return (
      <div className={containerClassName}>
        <Button onClick={goBack} className={classes.button} startIcon={<ArrowBackIcon />}>
          {backButtonText}
        </Button>
      </div>
    );
}

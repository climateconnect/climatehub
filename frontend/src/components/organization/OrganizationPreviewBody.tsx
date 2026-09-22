import { Box, CardContent, Typography } from "@mui/material";
import React, { useState } from "react";
import makeStyles from "@mui/styles/makeStyles";
import LocationDisplay from "../project/LocationDisplay";

const useStyles = makeStyles((theme) => {
  return {
    locationName: {
      fontWeight: 600,
      whiteSpace: "nowrap",
      width: "100%",
      overflow: "hidden",
      OTextOverflow: "ellipsis",
      textOverflow: "ellipsis",
      color: theme.palette.text.primary,
    },
    infoLink: {
      display: "flex",
    },
    cardIconBox: {
      width: 40,
      flex: "0 0 40px",
      display: "inline-block",
    },
    textContent: {
      fontSize: 14,
      whiteSpace: "normal",
    },
    locationBox: {
      margin: "0 auto",
    },
    locationNameBox: {
      maxWidth: "200px",
      overflow: "hidden",
    },
    shortenedSummary: {
      overflow: "hidden",
      WebkitBoxOrient: "vertical",
      display: "-webkit-box",
      lineHeight: 1.25,
    },
    summaryBox: {
      overflow: "hidden",
    },
    contentWrapper: {
      padding: 0,
      display: "flex",
      flexDirection: "column",
      flex: 1,
      overflow: "hidden",
    },
    placeIcon: {
      color: theme.palette.background.default_contrastText,
    },
    metadataText: {
      display: "inline",
      fontSize: 14,
      marginLeft: theme.spacing(0.25),
    },
    cardIcon: {
      verticalAlign: "bottom",
      marginRight: theme.spacing(0.5),
      marginLeft: theme.spacing(-0.25),
      fontSize: "default",
      color: theme.palette.background.default_contrastText,
    },
  };
});

export default function OrganizationPreviewBody({ organization }) {
  const classes = useStyles();
  // eslint-disable-next-line no-unused-vars
  const [linesOfText, setLinesOfText] = useState(5);

  return (
    <CardContent className={classes.contentWrapper}>
      <Box className={classes.locationBox}>
        {!!organization.info.location && (
          <LocationDisplay
            textClassName={classes.metadataText}
            iconClassName={classes.cardIcon}
            location={organization?.info?.location}
          />
        )}
      </Box>
      <Box
        className={classes.summaryBox}
        /*TODO(unused) ref={(textBox) => {
          const linesEstimation = textBox?.clientHeight / 25;
          setLinesOfText(Math.floor(linesEstimation));
        }} */
      >
        <Typography className={classes.shortenedSummary} style={{ WebkitLineClamp: linesOfText }}>
          {organization.short_description ?? organization.description}
        </Typography>
      </Box>
    </CardContent>
  );
}

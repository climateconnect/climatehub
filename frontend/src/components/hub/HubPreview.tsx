import { Card, CardMedia, Theme, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import AppLink from "../general/AppLink";

const useStyles = makeStyles<Theme, { disableBoxShadow?: boolean }>((theme) => ({
  root: (props) => ({
    boxShadow: props.disableBoxShadow ? undefined : `3px 3px 3px #e0e0e0`,
    borderColor: "#e0e0e0",
  }),
  placeholderImg: {
    visibility: "hidden",
    width: "100%",
  },
  title: {
    fontSize: 25,
    color: theme.palette.secondary.main,
    fontWeight: 600,
  },
  cardContentWrapper: {
    height: 120,
    background: "#f8f8f8",
    padding: theme.spacing(1),
    paddingLeft: theme.spacing(2),
  },
  noUnderline: {
    textDecoration: "inherit",
    "&:hover": {
      textDecoration: "inherit",
    },
  },
}));

export default function HubPreview({ hub, disableBoxShadow = false }) {
  const classes = useStyles({ disableBoxShadow: disableBoxShadow });
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });

  return (
    <AppLink
      href={`/hubs/${hub.url_slug}/browse`}
      className={classes.noUnderline}
      underline="hover"
    >
      <Card className={classes.root} variant="outlined">
        <CardMedia
          className={classes.media}
          title={hub.name}
          image={getImageUrl(hub.thumbnail_image)}
        >
          <img
            src={getImageUrl(hub.thumbnail_image)}
            className={classes.placeholderImg}
            alt={texts.image_for + " " + hub.name}
          />
        </CardMedia>
        <div className={classes.cardContentWrapper}>
          <Typography className={classes.title}>{hub.name}</Typography>
        </div>
      </Card>
    </AppLink>
  );
}

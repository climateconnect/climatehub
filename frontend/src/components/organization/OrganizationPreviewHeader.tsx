import React from "react";
import { Avatar, Box, Chip, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { getImageUrl } from "../../../public/lib/imageOperations";

const useStyles = makeStyles((theme) => {
  return {
    header: {
      fontWeight: "bold",
      margin: "5px",
      overflow: "hidden",
      wordBreak: "break-word",
      lineHeight: 1.3,
      color: theme.palette.text.primary,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      // @ts-ignore - WebkitBoxOrient is deprecated but still required for line-clamp to work
      WebkitBoxOrient: "vertical",
    },
    headerWrapper: {
      justifyContent: "center",
    },
    media: {
      height: 80,
      width: 80,
      backgroundSize: "contain",
      marginTop: theme.spacing(3),
      margin: "0 auto",
    },
    chip: {
      height: 20,
      position: "relative",
      margin: "1px 1px",
    },
    chipGroup: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      marginTop: "-15px",
    },
  };
});

export default function OrganizationPreviewHeader({ organization }) {
  const classes = useStyles();

  return (
    <div>
      <Avatar
        alt={organization.name}
        //TODO(unused) size="large"
        src={getImageUrl(organization.thumbnail_image)}
        className={classes.media}
        component="div"
      />
      {organization.types?.length > 0 && (
        <Box className={classes.chipGroup}>
          {organization.types.map((type) => (
            <Chip
              key={type.key}
              className={classes.chip}
              label={type.name}
              size="small"
              color="primary"
            />
          ))}
        </Box>
      )}
      <Box className={classes.headerWrapper}>
        <Typography variant="h6" component="h2" className={classes.header}>
          {organization.name}
        </Typography>
      </Box>
    </div>
  );
}

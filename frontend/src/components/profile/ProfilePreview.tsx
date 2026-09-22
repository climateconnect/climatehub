import { Avatar, Button, Tooltip, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import AppLink from "../general/AppLink";
import ProfileBadge from "./ProfileBadge";

const useStyles = makeStyles((theme) => {
  return {
    avatarWithInfo: {
      textAlign: "center",
      alginSelf: "center",
      maxWidth: theme.spacing(36),
      padding: theme.spacing(2),
    },
    avatar: {
      height: theme.spacing(20),
      width: theme.spacing(20),
      margin: "0 auto",
      fontSize: 50,
    },
    name: {
      fontWeight: 700,
      padding: theme.spacing(1),
      paddingBottom: 0,
      marginTop: theme.spacing(2),
      textAlign: "center",
    },
    subtitle: {
      color: `${theme.palette.secondary.main}`,
    },
    messageButton: {
      margin: "0 auto",
    },
    additionalInfo: {
      paddingBottom: theme.spacing(1),
    },
    info: {
      display: "flex",
      alignItems: "center",
      margin: "0 auto",
      textAlign: "center",
      justifyContent: "center",
      marginTop: theme.spacing(0.5),
    },
    lowImportanceInfo: {
      color: theme.palette.grey[700],
      fontSize: "12px",
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    highImportanceInfo: {
      color: "#000",
    },
    disableHover: {
      color: theme.palette.background?.default_contrastText,
      "&:hover": {
        textDecoration: "none",
      },
    },
    icon: {
      marginRight: theme.spacing(0.5),
    },
    badge: {
      bottom: "10%",
    },
  };
});

export default function ProfilePreview({ profile, allowMessage, showAdditionalInfo }: any) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "profile", locale: locale });
  const avatarProps = {
    alt: profile.name,
    size: "large",
    src: getImageUrl(profile.thumbnail_image),
    className: classes.avatar,
  };
  return (
    <div className={classes.avatarWithInfo}>
      <AppLink
        href={`/profiles/${profile.url_slug}`}
        className={classes.disableHover}
        underline="hover"
      >
        {profile.badges?.length > 0 ? (
          <ProfileBadge badge={profile.badges[0]} className={classes.badge}>
            <Avatar {...avatarProps} />
          </ProfileBadge>
        ) : (
          <Avatar {...avatarProps} />
        )}
        <Typography variant="h6" className={classes.name}>
          {profile.first_name + " " + profile.last_name}
        </Typography>
        {showAdditionalInfo && (
          <div className={classes.additionalInfo}>
            {Object.keys(profile.additionalInfo).map((key, index) => {
              const item = profile.additionalInfo[key];
              return (
                <Typography
                  key={index}
                  className={`${classes.info}
                    ${
                      item.importance === "low"
                        ? classes.lowImportanceInfo
                        : classes.highImportanceInfo
                    }`}
                >
                  {item.icon &&
                    (item.toolTipText ? (
                      <Tooltip className={classes.icon} title={item.toolTipText}>
                        <item.icon name={item.iconName} />
                      </Tooltip>
                    ) : (
                      <item.icon className={classes.icon} name={item.iconName} />
                    ))}
                  {item.text}
                </Typography>
              );
            })}
          </div>
        )}
      </AppLink>
      {allowMessage && (
        <div>
          <Button
            variant="contained"
            href={"/messageUser/" + profile.url_slug}
            color="primary"
            className={classes.messageButton}
          >
            {texts.send_message}
          </Button>
        </div>
      )}
    </div>
  );
}

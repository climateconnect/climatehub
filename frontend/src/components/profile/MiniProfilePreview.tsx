import { Avatar, IconButton, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import ClearIcon from "@mui/icons-material/Clear";
import React from "react";
import { getImageUrl } from "./../../../public/lib/imageOperations";
import AppLink from "../general/AppLink";
import ProfileBadge from "./ProfileBadge";

const useStyles = makeStyles((theme) => {
  return {
    avatarWrapper: {
      display: "inline-block",
      verticalAlign: "middle",
    },
    profileName: {
      display: "inline-block",
      verticalAlign: "middle",
      marginLeft: theme.spacing(1),
    },
    smallProfileName: {
      fontSize: 14,
    },
    mediumProfileName: {
      fontSize: 16,
    },
    smallAvatar: {
      height: 20,
      width: 20,
    },
    mediumAvatar: {
      height: 30,
      width: 30,
    },
    contentWrapper: {
      display: "inline-flex",
      alignItems: "center",
      verticalAlign: "middle",
    },
    badge: {
      bottom: "20%",
    },
  };
});

type Props = { className?; profile?; avatarClassName?; size?; nolink?; onDelete? };

export default function MiniProfilePreview({
  className,
  profile,
  avatarClassName,
  size,
  nolink,
  onDelete,
}: Props) {
  if (!nolink)
    return (
      <>
        <AppLink
          color="inherit"
          href={`/profiles/${profile.url_slug}`}
          className={`${"" /*TODO(undefined) classes.avatarWithInfo*/} ${className}`}
          underline="hover"
        >
          <Content profile={profile} avatarClassName={avatarClassName} size={size} />
        </AppLink>
        {onDelete && (
          <IconButton onClick={() => onDelete(profile)} size="large">
            <ClearIcon />
          </IconButton>
        )}
      </>
    );
  else
    return (
      <div className={`${"" /*TODO(undefined) classes.avatarWithInfo*/} ${className}`}>
        <Content profile={profile} avatarClassName={avatarClassName} size={size} />
      </div>
    );
}

function Content({ profile, avatarClassName, size }) {
  const classes = useStyles();

  const avatarProps = {
    src: getImageUrl(profile.thumbnail_image),
    className: `${size === "small" && classes.smallAvatar} ${
      size === "medium" && classes.mediumAvatar
    } ${avatarClassName}`,
  };
  return (
    <span className={classes.contentWrapper}>
      <div className={classes.avatarWrapper}>
        {profile.badges?.length > 0 ? (
          <ProfileBadge
            badge={profile.badges[0]}
            size={["medium", "small"].includes(size) ? "small" : "medium"}
            className={size === "medium" ? classes.badge : undefined}
          >
            <Avatar {...avatarProps} />
          </ProfileBadge>
        ) : (
          <Avatar {...avatarProps} />
        )}
      </div>
      <Typography
        color="inherit"
        className={`${classes.profileName} ${size === "medium" && classes.mediumProfileName} ${
          size === "small" && classes.smallProfileName
        }`}
        variant="h6"
      >
        {[profile.first_name, profile.last_name].filter(Boolean).join(" ")}
      </Typography>
    </span>
  );
}

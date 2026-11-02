import {
  Avatar,
  IconButton,
  Link,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Theme,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import { THUMBNAIL_SOURCES, resolveVariantUrl } from "../../general/ResponsiveImage";
import UserContext from "../../context/UserContext";
import { StyledMenuItem } from "./Notification";
import CloseIcon from "@mui/icons-material/Close";
import Cookies from "universal-cookie";

const useStyles = makeStyles<Theme, {}>((theme) => {
  return {
    messageSender: {
      fontWeight: 600,
      width: "90%",
      whiteSpace: "normal",
      overflow: "hidden",
      WebkitBoxOrient: "vertical",
      display: "-webkit-box",
      wordBreak: "break-word",
      color: theme.palette.background.default_contrastText,
    },
    listItemText: {
      whiteSpace: "normal",
    },
    goToInboxText: {
      textAlign: "center",
      display: "block",
      marginTop: theme.spacing(1),
    },
    notificationText: {
      width: "90%",
      whiteSpace: "normal",
      overflow: "hidden",
      WebkitBoxOrient: "vertical",
      display: "-webkit-box",
      WebkitLineClamp: 1,
      wordBreak: "break-word",
    },
    deleteIcon: {
      position: "absolute",
      right: 0,
    },
    content: {
      display: "flex",
      alignItems: "center",
    },
  };
});

type Props = {
  link: any;
  primaryText: any;
  secondaryText?: any;
  notificationIcon?: any;
  avatar?: any;
  notification: any;
};
export default function GenericNotification({
  link,
  primaryText,
  secondaryText,
  notificationIcon,
  avatar,
  notification,
}: Props) {
  const token = new Cookies().get("auth_token");
  const { locale, setNotificationsRead, refreshNotifications, hideNotification } = useContext(
    UserContext
  );
  const classes = useStyles();

  const deleteNotification = async () => {
    hideNotification(notification.id);
    await setNotificationsRead(token, [notification], locale);
    await refreshNotifications();
  };

  return (
    <StyledMenuItem>
      <Link href={getLocalePrefix(locale) + link} underline="none">
        <div className={classes.content}>
          {avatar ? (
            <ListItemAvatar>
              <Avatar
                alt={avatar.alt}
                src={resolveVariantUrl(avatar.image_variants, THUMBNAIL_SOURCES, avatar.image)}
              />
            </ListItemAvatar>
          ) : (
            <ListItemIcon>
              <notificationIcon.icon />
            </ListItemIcon>
          )}
          <ListItemText
            primary={primaryText}
            secondary={secondaryText}
            primaryTypographyProps={{
              className: classes.messageSender,
            }}
            secondaryTypographyProps={{
              className: classes.notificationText,
            }}
          />
        </div>
      </Link>
      <IconButton onClick={deleteNotification} className={classes.deleteIcon} size="large">
        <CloseIcon />
      </IconButton>
    </StyledMenuItem>
  );
}

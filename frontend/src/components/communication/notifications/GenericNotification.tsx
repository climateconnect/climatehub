import {
  Avatar,
  IconButton,
  Link,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Theme,
} from "@mui/material";
import { styled, SxProps } from "@mui/material/styles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import { getImageUrl } from "../../../../public/lib/imageOperations";
import UserContext from "../../context/UserContext";
import { StyledMenuItem } from "./Notification";
import CloseIcon from "@mui/icons-material/Close";
import Cookies from "universal-cookie";

const Content = styled("div")({
  display: "flex",
  alignItems: "center",
});

const messageSenderSx: SxProps<Theme> = (theme) => ({
  fontWeight: 600,
  width: "90%",
  whiteSpace: "normal",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  display: "-webkit-box",
  wordBreak: "break-word",
  color: theme.palette.background.default_contrastText,
});

const notificationTextSx: SxProps<Theme> = {
  width: "90%",
  whiteSpace: "normal",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  display: "-webkit-box",
  WebkitLineClamp: 1,
  wordBreak: "break-word",
};

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

  const deleteNotification = async () => {
    hideNotification(notification.id);
    await setNotificationsRead(token, [notification], locale);
    await refreshNotifications();
  };

  return (
    <StyledMenuItem>
      <Link href={getLocalePrefix(locale) + link} underline="none">
        <Content>
          {avatar ? (
            <ListItemAvatar>
              <Avatar alt={avatar.alt} src={getImageUrl(avatar.image)} />
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
              sx: messageSenderSx,
            }}
            secondaryTypographyProps={{
              sx: notificationTextSx,
            }}
          />
        </Content>
      </Link>
      <IconButton onClick={deleteNotification} sx={{ position: "absolute", right: 0 }} size="large">
        <CloseIcon />
      </IconButton>
    </StyledMenuItem>
  );
}

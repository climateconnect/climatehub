import { Avatar, Badge, Divider, ListItemButton, ListItemText } from "@mui/material";
import { styled } from "@mui/material/styles";
import GroupIcon from "@mui/icons-material/Group";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import { getDateTime } from "../../../../public/lib/dateOperations";
import { getImageUrl } from "../../../../public/lib/imageOperations";
import UserContext from "../../context/UserContext";

const MobileAvatar = styled(Avatar)(({ theme }) => ({
  marginRight: theme.spacing(2),
}));

const Time = styled("span")(({ theme }) => ({
  color: theme.palette.grey[600],
}));

const UnreadBadge = styled(Badge)(({ theme }) => ({
  "& span": {
    backgroundColor: theme.palette.success.main,
  },
}));

const BadgeAndTimeContainer = styled("span")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  marginLeft: theme.spacing(2),
}));

export default function MobileChatPreview({ chat, isFirstChat, forwardedRef }) {
  const { locale } = useContext(UserContext);
  const isGroupChat = !chat.chatting_partner && !!chat.name;
  const last_activity = chat.last_message ? chat.last_message.sent_at : chat.created_at;
  return (
    <>
      {isFirstChat && <Divider component="li" />}
      <ListItemButton
        ref={forwardedRef}
        component="a"
        href={getLocalePrefix(locale) + "/chat/" + chat.chat_uuid}
        alignItems="center"
      >
        {isGroupChat ? (
          <MobileAvatar>
            <GroupIcon />
          </MobileAvatar>
        ) : (
          <MobileAvatar src={getImageUrl(chat.chatting_partner.image)} />
        )}
        <ListItemText
          primary={
            isGroupChat
              ? chat.name
              : chat.chatting_partner.first_name + " " + chat.chatting_partner.last_name
          }
          secondary={chat.content}
          secondaryTypographyProps={{
            sx: {
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            },
          }}
        />
        <BadgeAndTimeContainer>
          <span /*TODO(undefined) className={classes.timeContainer}*/>
            <Time>{getDateTime(last_activity)}</Time>
          </span>
          {chat.unread_count > 0 && (
            <span /*TODO(undefined) className={classes.badgeContainer}*/>
              <UnreadBadge color="primary" badgeContent={chat.unread_count} />
            </span>
          )}
        </BadgeAndTimeContainer>
      </ListItemButton>
      <Divider component="li" />
    </>
  );
}

import CommentIcon from "@mui/icons-material/Comment";
import React, { useContext } from "react";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import GenericNotification from "./GenericNotification";

function CommentNotification({ link, object_commented_on, comment_text, is_reply, notification }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "notification", locale: locale });
  const primaryText =
    (is_reply ? texts.reply_to_your_comment_on : texts.comment_on) +
    ' "' +
    object_commented_on.name +
    '"';
  return (
    <GenericNotification
      link={link}
      primaryText={primaryText}
      secondaryText={comment_text}
      notificationIcon={{ icon: CommentIcon }}
      notification={notification}
    />
  );
}

export const ProjectCommentNotification = ({ notification, hubUrl }) => {
  const baseUrl = `/projects/${notification.project.url_slug}`;
  const notifLink = hubUrl ? `${baseUrl}?hub=${hubUrl}#comments` : `${baseUrl}#comments`;
  return (
    <CommentNotification
      link={notifLink}
      object_commented_on={notification.project}
      comment_text={notification.project_comment.content}
      is_reply={false}
      notification={notification}
    />
  );
};

export const ProjectCommentReplyNotification = ({ notification, hubUrl }) => {
  const baseUrl = `/projects/${notification.project.url_slug}`;
  const notifLink = hubUrl ? `${baseUrl}?hub=${hubUrl}#comments` : `${baseUrl}#comments`;
  return (
    <CommentNotification
      link={notifLink}
      object_commented_on={notification.project}
      comment_text={notification?.project_comment?.content}
      is_reply={true}
      notification={notification}
    />
  );
};

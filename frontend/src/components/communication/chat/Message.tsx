import { Box, CircularProgress, Link, Tooltip, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext, useEffect, useState } from "react";
import EventIcon from "@mui/icons-material/Event";
import Cookies from "universal-cookie";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import { getDateTime } from "../../../../public/lib/dateOperations";
import {
  fetchOriginContext,
  isSupportedOriginType,
  OriginContext,
} from "../../../../public/lib/messageOriginOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import MessageContent from "./../MessageContent";

const useStyles = makeStyles((theme) => ({
  time: {
    fontSize: 10,
    float: "right",
    marginRight: theme.spacing(-3),
    color: theme.palette.secondary.main,
  },
  timeContainer: {
    paddingLeft: theme.spacing(4),
  },
  sentTime: {
    color: "#bdb8c7",
  },
  senderName: {
    fontSize: 12,
  },
  originContext: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    borderRadius: theme.spacing(0.75),
    backgroundColor: theme.palette.grey[100],
    padding: theme.spacing(0.5, 1),
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    maxWidth: "100%",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  originContextText: {
    display: "inline",
  },
}));

const PROJECT_TYPE_ORIGIN_TEXT_KEYS = {
  EV: "chat_message_origin_event",
  ID: "chat_message_origin_idea",
  PR: "chat_message_origin_project",
};

export default function Message({ message, classes, isPrivateChat }) {
  const ownClasses = useStyles();
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });
  const received = message.sender.url_slug !== user.url_slug;
  const sent_date = getDateTime(message.sent_at);
  const [originContext, setOriginContext] = useState<OriginContext | null>(null);

  useEffect(() => {
    if (!isSupportedOriginType(message.origin_type) || !message.origin_id) {
      setOriginContext(null);
      return;
    }

    let active = true;
    const token = new Cookies().get("auth_token");

    fetchOriginContext(message.origin_type, message.origin_id, token, locale).then((data) => {
      if (!active) return;
      setOriginContext(data);
    });

    return () => {
      active = false;
    };
  }, [locale, message.origin_id, message.origin_type]);

  let originTemplate = "";
  let originName = "";
  let originHref = "";
  if (originContext?.type === "event_registration") {
    originTemplate = texts.chat_message_origin_event_registration as string;
    originName = originContext.event_name;
    originHref = `${getLocalePrefix(locale)}/projects/${originContext.event_url_slug}`;
  } else if (originContext?.type === "project") {
    const textKey =
      PROJECT_TYPE_ORIGIN_TEXT_KEYS[originContext.project_type] ?? PROJECT_TYPE_ORIGIN_TEXT_KEYS.PR;
    originTemplate = texts[textKey] as string;
    originName = originContext.project_name;
    originHref = `${getLocalePrefix(locale)}/projects/${originContext.project_url_slug}`;
  }
  const originParts = originTemplate.split(/\{(?:event_name|project_name)\}/);

  return (
    <div
      className={`${received ? classes.receivedContainer : classes.sentContainer} ${
        classes.messageContainer
      }`}
      id="messageContainer"
    >
      <span
        color={received ? "default" : "primary"}
        className={`${received ? classes.receivedMessage : classes.sentMessage} ${classes.message}`}
      >
        {received && !isPrivateChat && (
          <Link
            href={getLocalePrefix(locale) + "/profiles/" + message.sender.url_slug}
            target="_blank"
            underline="hover"
          >
            <Typography className={ownClasses.senderName} color="primary" component="span">
              {message.sender.first_name + " " + message.sender.last_name}
            </Typography>
          </Link>
        )}
        <MessageContent content={message.content} received={received} />
        {originContext && (
          <Box className={ownClasses.originContext}>
            <EventIcon
              fontSize="inherit"
              sx={(theme) => ({ color: received ? "inherit" : theme.palette.text.primary })}
            />
            <Typography
              variant="caption"
              className={ownClasses.originContextText}
              sx={(theme) => ({ color: received ? "inherit" : theme.palette.text.primary })}
            >
              {originParts[0]}
              <Link href={originHref} underline="hover">
                {originName}
              </Link>
              {originParts[1]}
            </Typography>
          </Box>
        )}
        <div className={ownClasses.timeContainer}>
          <div className={`${ownClasses.time} ${!received && ownClasses.sentTime}`}>
            {message.unconfirmed && (
              <Tooltip title={texts.sending_message + "..."}>
                <CircularProgress size={10} color="inherit" className={classes.loader} />
              </Tooltip>
            )}
            {sent_date}
          </div>
        </div>
      </span>
    </div>
  );
}

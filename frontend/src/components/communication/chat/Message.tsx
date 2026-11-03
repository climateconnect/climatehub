import { CircularProgress, Link, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useEffect, useState } from "react";
// Same organization icon as in MobilePageNav
import Groups2Icon from "@mui/icons-material/Groups2";
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

const notTransient = (prop: PropertyKey) => typeof prop !== "string" || !prop.startsWith("$");

const MessageContainer = styled("div", { shouldForwardProp: notTransient })<{
  $received: boolean;
}>(({ theme, $received }) => ({
  ...($received
    ? { textAlign: "left", marginLeft: theme.spacing(1) }
    : { textAlign: "right", marginRight: theme.spacing(1) }),
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const MessageBubble = styled("span", { shouldForwardProp: notTransient })<{
  $received: boolean;
}>(({ theme, $received }) => ({
  ...($received
    ? {
        backgroundColor: theme.palette.grey[300],
        padding: theme.spacing(1),
        paddingRight: theme.spacing(4),
      }
    : {
        backgroundColor: theme.palette.primary.main,
        padding: theme.spacing(1),
        color: "white",
        textAlign: "left",
        paddingRight: theme.spacing(4),
      }),
  maxWidth: "70%",
  display: "inline-block",
  borderRadius: theme.spacing(1),
}));

const SenderName = styled(Typography)({
  fontSize: 12,
}) as typeof Typography;

const OriginBox = styled("div")(({ theme }) => ({
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
}));

const TimeContainer = styled("div")(({ theme }) => ({
  paddingLeft: theme.spacing(4),
}));

const Time = styled("div", { shouldForwardProp: notTransient })<{ $received: boolean }>(
  ({ theme, $received }) => ({
    fontSize: 10,
    float: "right",
    marginRight: theme.spacing(-3),
    color: theme.palette.secondary.main,
    ...(!$received && { color: "#bdb8c7" }),
  })
);

const PROJECT_TYPE_ORIGIN_TEXT_KEYS = {
  EV: "chat_message_origin_event",
  ID: "chat_message_origin_idea",
  PR: "chat_message_origin_project",
};

// Same icon images as ProjectTypeDisplay (used by ProjectPreview)
const PROJECT_TYPE_ORIGIN_ICON_IDS = {
  EV: "event",
  ID: "idea",
  PR: "project",
};

export default function Message({ message, isPrivateChat }) {
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
  } else if (originContext?.type === "organization") {
    originTemplate = texts.chat_message_origin_organization as string;
    originName = originContext.organization_name;
    originHref = `${getLocalePrefix(locale)}/organizations/${originContext.organization_url_slug}`;
  }
  const originIconId =
    originContext?.type === "project"
      ? PROJECT_TYPE_ORIGIN_ICON_IDS[originContext.project_type] ?? PROJECT_TYPE_ORIGIN_ICON_IDS.PR
      : PROJECT_TYPE_ORIGIN_ICON_IDS.EV;
  const originParts = originTemplate.split(/\{(?:event_name|project_name|organization_name)\}/);

  return (
    <MessageContainer $received={received} id="messageContainer">
      <MessageBubble $received={received} color={received ? "default" : "primary"}>
        {received && !isPrivateChat && (
          <Link
            href={getLocalePrefix(locale) + "/profiles/" + message.sender.url_slug}
            target="_blank"
            underline="hover"
          >
            <SenderName color="primary" component="span">
              {message.sender.first_name + " " + message.sender.last_name}
            </SenderName>
          </Link>
        )}
        <MessageContent content={message.content} received={received} />
        {originContext && (
          <OriginBox>
            {originContext.type === "organization" ? (
              <Groups2Icon
                sx={(theme) => ({
                  fontSize: 16,
                  color: received ? "inherit" : theme.palette.text.primary,
                })}
              />
            ) : (
              <img
                src={`/images/project_types/${originIconId}.png`}
                alt=""
                width={16}
                height={16}
              />
            )}
            <Typography
              variant="caption"
              sx={(theme) => ({
                display: "inline",
                color: received ? "inherit" : theme.palette.text.primary,
              })}
            >
              {originParts[0]}
              <Link href={originHref} underline="hover">
                {originName}
              </Link>
              {originParts[1]}
            </Typography>
          </OriginBox>
        )}
        <TimeContainer>
          <Time $received={received}>
            {message.unconfirmed && (
              <Tooltip title={texts.sending_message + "..."}>
                <CircularProgress
                  size={10}
                  color="inherit"
                  sx={(theme) => ({ display: "inline-block", marginRight: theme.spacing(0.25) })}
                />
              </Tooltip>
            )}
            {sent_date}
          </Time>
        </TimeContainer>
      </MessageBubble>
    </MessageContainer>
  );
}

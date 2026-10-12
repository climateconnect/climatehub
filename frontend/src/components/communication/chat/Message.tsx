import { CircularProgress, Link, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useEffect, useState } from "react";
import EventIcon from "@mui/icons-material/Event";
import Cookies from "universal-cookie";
import { apiRequest, getLocalePrefix } from "../../../../public/lib/apiOperations";
import { getDateTime } from "../../../../public/lib/dateOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import MessageContent from "./../MessageContent";

type EventRegistrationOriginContext = {
  event_name: string;
  event_url_slug: string;
};

const originContextCache = new Map<number, EventRegistrationOriginContext | null>();
const pendingOriginContextRequests = new Map<
  number,
  Promise<EventRegistrationOriginContext | null>
>();

const fetchEventRegistrationOriginContext = async (
  registrationId: number,
  token?: string,
  locale?: string
): Promise<EventRegistrationOriginContext | null> => {
  if (!registrationId || registrationId <= 0) return null;
  if (originContextCache.has(registrationId)) {
    return originContextCache.get(registrationId) ?? null;
  }

  const pendingRequest = pendingOriginContextRequests.get(registrationId);
  if (pendingRequest) return pendingRequest;

  const request = apiRequest({
    method: "get",
    url: `/api/event-registration-origin/${registrationId}/`,
    token,
    locale,
  })
    .then((response) => {
      const data = response.data as EventRegistrationOriginContext;
      originContextCache.set(registrationId, data);
      return data;
    })
    .catch((error) => {
      console.warn("Failed to resolve event registration origin context", error);
      originContextCache.set(registrationId, null);
      return null;
    })
    .finally(() => {
      pendingOriginContextRequests.delete(registrationId);
    });

  pendingOriginContextRequests.set(registrationId, request);
  return request;
};

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

const OriginContext = styled("div")(({ theme }) => ({
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

export default function Message({ message, isPrivateChat }) {
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });
  const received = message.sender.url_slug !== user.url_slug;
  const sent_date = getDateTime(message.sent_at);
  const [originContext, setOriginContext] = useState<EventRegistrationOriginContext | null>(null);

  useEffect(() => {
    if (message.origin_type !== "event_registration" || !message.origin_id) {
      setOriginContext(null);
      return;
    }

    let active = true;
    const token = new Cookies().get("auth_token");

    fetchEventRegistrationOriginContext(message.origin_id, token, locale).then((data) => {
      if (!active) return;
      setOriginContext(data);
    });

    return () => {
      active = false;
    };
  }, [locale, message.origin_id, message.origin_type]);

  const originTemplate = texts.chat_message_origin_event_registration as string;
  const originParts = originTemplate?.split("{event_name}") ?? [originTemplate ?? "", ""];

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
        {originContext && message.origin_type === "event_registration" && (
          <OriginContext>
            <EventIcon
              fontSize="inherit"
              sx={(theme) => ({ color: received ? "inherit" : theme.palette.text.primary })}
            />
            <Typography
              variant="caption"
              sx={(theme) => ({
                display: "inline",
                color: received ? "inherit" : theme.palette.text.primary,
              })}
            >
              {originParts[0]}
              <Link
                href={`${getLocalePrefix(locale)}/projects/${originContext.event_url_slug}`}
                underline="hover"
              >
                {originContext.event_name}
              </Link>
              {originParts[1]}
            </Typography>
          </OriginContext>
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

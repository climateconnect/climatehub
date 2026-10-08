import { Box, CircularProgress, Link, Tooltip, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext, useEffect, useState } from "react";
import EventIcon from "@mui/icons-material/Event";
import BusinessIcon from "@mui/icons-material/Business";
import Cookies from "universal-cookie";
import { apiRequest, getLocalePrefix } from "../../../../public/lib/apiOperations";
import { getDateTime } from "../../../../public/lib/dateOperations";
import {
  fetchOrganizationOriginContext,
  OrganizationOriginContext,
} from "../../../../public/lib/messageOriginOperations";
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

export default function Message({ message, classes, isPrivateChat, previousMessage = null }) {
  const ownClasses = useStyles();
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });
  const received = message.sender.url_slug !== user.url_slug;
  const sent_date = getDateTime(message.sent_at);
  const [originContext, setOriginContext] = useState<EventRegistrationOriginContext | null>(null);

  const [organizationOrigin, setOrganizationOrigin] = useState<OrganizationOriginContext | null>(
    null
  );
  // Show the organization chip only when the origin differs from the previous message
  const isNewOrganizationOrigin =
    message.origin_type === "organization" &&
    !(
      previousMessage?.origin_type === "organization" &&
      previousMessage?.origin_id === message.origin_id
    );

  useEffect(() => {
    if (!isNewOrganizationOrigin || !message.origin_id) {
      setOrganizationOrigin(null);
      return;
    }
    let active = true;
    const token = new Cookies().get("auth_token");
    fetchOrganizationOriginContext(message.origin_id, token, locale).then((data) => {
      if (active) setOrganizationOrigin(data);
    });
    return () => {
      active = false;
    };
  }, [locale, message.origin_id, isNewOrganizationOrigin]);

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
  const organizationOriginParts = (texts.chat_message_origin_organization as string).split(
    "{organization_name}"
  );
  const originParts = originTemplate?.split("{event_name}") ?? [originTemplate ?? "", ""];

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
        {originContext && message.origin_type === "event_registration" && (
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
              <Link
                href={`${getLocalePrefix(locale)}/projects/${originContext.event_url_slug}`}
                underline="hover"
              >
                {originContext.event_name}
              </Link>
              {originParts[1]}
            </Typography>
          </Box>
        )}
        {organizationOrigin && isNewOrganizationOrigin && (
          <Box className={ownClasses.originContext}>
            <BusinessIcon
              fontSize="inherit"
              sx={(theme) => ({ color: received ? "inherit" : theme.palette.text.primary })}
            />
            <Typography
              variant="caption"
              className={ownClasses.originContextText}
              sx={(theme) => ({ color: received ? "inherit" : theme.palette.text.primary })}
            >
              {organizationOriginParts[0]}
              <Link
                href={`${getLocalePrefix(locale)}/organizations/${
                  organizationOrigin.organization_url_slug
                }`}
                underline="hover"
              >
                {organizationOrigin.organization_name}
              </Link>
              {organizationOriginParts[1]}
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

import makeStyles from "@mui/styles/makeStyles";
import { array, object, string, func, bool } from "prop-types";
import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { useChatScroll } from "../../hooks/useChatScroll";
import Message from "./Message";

const useStyles = makeStyles((theme) => {
  return {
    receivedContainer: {
      textAlign: "left",
      marginLeft: theme.spacing(1),
    },
    sentContainer: {
      textAlign: "right",
      marginRight: theme.spacing(1),
    },
    messageContainer: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    receivedMessage: {
      backgroundColor: theme.palette.grey[300],
      padding: theme.spacing(1),
      paddingRight: theme.spacing(4),
    },
    sentMessage: {
      backgroundColor: theme.palette.primary.main,
      padding: theme.spacing(1),
      color: "white",
      textAlign: "left",
      paddingRight: theme.spacing(4),
    },
    message: {
      maxWidth: "70%",
      display: "inline-block",
      borderRadius: theme.spacing(1),
    },
    loader: {
      display: "inline-block",
      marginRight: theme.spacing(0.25),
    },
    noHistoryText: {
      textAlign: "center",
      fontStyle: "italic",
      padding: theme.spacing(2, 3),
    },
    scrollContainer: {
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
    },
    messagesList: {
      listStyle: "none",
      padding: 0,
      margin: 0,
    },
    sentinel: {
      height: "1px",
      width: "100%",
    },
  };
});

const Messages = ({
  messages,
  chatting_partner,
  className,
  loadFunc,
  hasMore,
  title,
  isPrivateChat,
  texts,
  relatedIdea,
  emptyConversationLead,
}) => {
  const classes = useStyles();
  const [isLoading, setIsLoading] = useState(false);
  const [scrollComponentHeight, setScrollComponentHeight] = useState(0);

  const loadMore = async (page) => {
    setIsLoading(true);
    await loadFunc(page);
    setIsLoading(false);
  };

  const { scrollRef, sentinelRef } = useChatScroll({
    hasMore: hasMore,
    isLoading,
    loadMore,
  });

  // Scroll down when the component is mounted
  useEffect(() => {
    const messageContainer = scrollRef.current;
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
      setScrollComponentHeight(messageContainer.clientHeight);
      setIsLoading(false);
    }
  }, []);

  // Scroll down when the clientHeight changes or new messages arrive
  useEffect(() => {
    const messageContainer = scrollRef.current;
    if (!messageContainer) return;

    // Handle height changes (user typing)
    if (scrollComponentHeight !== messageContainer.clientHeight) {
      if (messageContainer.scrollTop === messageContainer.scrollHeight - scrollComponentHeight) {
        messageContainer.scrollTop =
          messageContainer.scrollTop + (scrollComponentHeight - messageContainer.clientHeight);
      }
      setScrollComponentHeight(messageContainer.clientHeight);
    }
  }, [scrollComponentHeight]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    const messageContainer = scrollRef.current;
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  }, [messages]);

  const sortByNewestFirst = (a, b) => new Date(a.sent_at) - new Date(b.sent_at);

  return (
    <Box ref={scrollRef} className={`${classes.scrollContainer} ${className}`}>
      <ul className={classes.messagesList}>
        {/* Sentinel div for IntersectionObserver - placed at the top */}
        <div ref={sentinelRef} className={classes.sentinel} />

        {isLoading && <div className={classes.loader}>Loading ...</div>}

        {messages && messages.length > 0 ? (
          messages.sort(sortByNewestFirst).map((message, index) => {
            return (
              <Message
                message={message}
                key={index}
                classes={classes}
                isPrivateChat={isPrivateChat}
              />
            );
          })
        ) : relatedIdea ? (
          <div className={classes.noHistoryText}>
            <p>
              {texts.here_you_can_discuss + ' "' + relatedIdea.name + '"'}
              .<br />
              {texts.everybody_who_clicked_join_is_in_this_group}.
            </p>
            <p>{texts.write_a_message_to_get_the_conversation_started}</p>
          </div>
        ) : isPrivateChat ? (
          <div className={classes.noHistoryText}>
            <p>
              {emptyConversationLead
                ? emptyConversationLead
                : `${texts.this_is_the_very_beginning_of_your_conversation_with} ${
                    chatting_partner.first_name + " " + chatting_partner.last_name
                  }.`}
            </p>
            <p>{texts.write_a_message_to_get_the_conversation_started}</p>
          </div>
        ) : (
          <div className={classes.noHistoryText}>
            <p>
              {texts.this_is_the_very_beginning_of_your_conversation_in} {title}
            </p>
            <p>{texts.write_a_message_to_get_the_conversation_started}</p>
          </div>
        )}
      </ul>
    </Box>
  );
};

Messages.propTypes = {
  messages: array.isRequired,
  chatting_partner: object,
  className: string.isRequired,
  loadFunc: func.isRequired,
  hasMore: bool.isRequired,
  title: string,
  isPrivateChat: bool.isRequired,
  texts: object,
  relatedIdea: object,
  emptyConversationLead: string,
};

export default Messages;

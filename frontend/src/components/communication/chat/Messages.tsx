import { array, object, string, func, bool } from "prop-types";
import React, { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useChatScroll } from "../../hooks/useChatScroll";
import Message from "./Message";

const ScrollContainer = styled(Box)({
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
});

const MessagesList = styled("ul")({
  listStyle: "none",
  padding: 0,
  margin: 0,
});

const Sentinel = styled("div")({
  height: "1px",
  width: "100%",
});

const Loader = styled("div")(({ theme }) => ({
  display: "inline-block",
  marginRight: theme.spacing(0.25),
}));

const NoHistoryText = styled("div")(({ theme }) => ({
  textAlign: "center",
  fontStyle: "italic",
  padding: theme.spacing(2, 3),
}));

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
    <ScrollContainer ref={scrollRef} className={className}>
      <MessagesList>
        {/* Sentinel div for IntersectionObserver - placed at the top */}
        <Sentinel ref={sentinelRef} />

        {isLoading && <Loader>Loading ...</Loader>}

        {messages && messages.length > 0 ? (
          messages.sort(sortByNewestFirst).map((message, index) => {
            return <Message message={message} key={index} isPrivateChat={isPrivateChat} />;
          })
        ) : relatedIdea ? (
          <NoHistoryText>
            <p>
              {texts.here_you_can_discuss + ' "' + relatedIdea.name + '"'}
              .<br />
              {texts.everybody_who_clicked_join_is_in_this_group}.
            </p>
            <p>{texts.write_a_message_to_get_the_conversation_started}</p>
          </NoHistoryText>
        ) : isPrivateChat ? (
          <NoHistoryText>
            <p>
              {emptyConversationLead
                ? emptyConversationLead
                : `${texts.this_is_the_very_beginning_of_your_conversation_with} ${
                    chatting_partner.first_name + " " + chatting_partner.last_name
                  }.`}
            </p>
            <p>{texts.write_a_message_to_get_the_conversation_started}</p>
          </NoHistoryText>
        ) : (
          <NoHistoryText>
            <p>
              {texts.this_is_the_very_beginning_of_your_conversation_in} {title}
            </p>
            <p>{texts.write_a_message_to_get_the_conversation_started}</p>
          </NoHistoryText>
        )}
      </MessagesList>
    </ScrollContainer>
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

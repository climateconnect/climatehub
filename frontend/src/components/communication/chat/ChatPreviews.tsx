import {
  Badge,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Theme,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { array } from "prop-types";
import React, { Fragment, useContext } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import { getDateTime } from "../../../../public/lib/dateOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import LoadingSpinner from "../../general/LoadingSpinner";
import MiniProfilePreview from "../../profile/MiniProfilePreview";
import ChatTitle from "./ChatTitle";
import MobileChatPreview from "./MobileChatPreview";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useRouter } from "next/router";

const NoChatsMessage = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: "center",
  maxWidth: 600,
  margin: "0 auto",
}));

const miniProfilePreviewStyles = {
  display: "flex",
  alignItems: "center",
  flexBasis: 250,
  flexShrink: 0,
} as const;

// ChatTitle types `className` as required; styled() supplies it
const StyledChatTitle = (styled(ChatTitle)(
  miniProfilePreviewStyles
) as unknown) as React.ComponentType<Omit<React.ComponentProps<typeof ChatTitle>, "className">>;

const StyledMiniProfilePreview = styled(MiniProfilePreview)(miniProfilePreviewStyles);

const ContentPreview = styled("span", {
  shouldForwardProp: (prop) => typeof prop !== "string" || !prop.startsWith("$"),
})<{ $unread?: boolean }>(({ $unread }) => ({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
  ...($unread && { fontWeight: "bold" }),
}));

const BadgeAndTimeContainer = styled("span")({
  float: "right",
  height: 40,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
});

const UnreadBadge = styled(Badge)(({ theme }) => ({
  "& span": {
    backgroundColor: theme.palette.success.main,
  },
}));

export default function ChatPreviews({
  chats,
  loadFunc,
  hasMore,
  chatSearchEnabled,
  isLoading = false,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const router = useRouter();
  const hubUrl = typeof router.query.hub === "string" ? router.query.hub : null;

  const loadMore = async () => {
    if (loadFunc) {
      await loadFunc();
    }
  };

  const { lastElementRef } = useInfiniteScroll({
    hasMore: hasMore || false,
    isLoading: isLoading,
    onLoadMore: loadMore,
  });

  if (chats.length === 0 && !chatSearchEnabled)
    return (
      <>
        <Divider />
        <NoChatsMessage variant="h6">
          {texts.you_havent_chatted_to_anybody_yet_click_on}
        </NoChatsMessage>
      </>
    );
  if (chats.length === 0 && chatSearchEnabled)
    return (
      <>
        <Divider />
        <NoChatsMessage variant="h6">{texts.no_chats_found_for_this_search}</NoChatsMessage>
      </>
    );

  return (
    <>
      <List>
        {chats.map((chat, index) => {
          const isLastElement = index === chats.length - 1;
          return (
            <ChatPreview
              key={index}
              isFirstChat={index === 0}
              isNarrowScreen={isNarrowScreen}
              chat={chat}
              locale={locale}
              forwardedRef={isLastElement ? lastElementRef : null}
              hubUrl={hubUrl}
            />
          );
        })}
      </List>
      {isLoading && <LoadingSpinner isLoading />}
    </>
  );
}

const ChatPreview = ({ chat, isNarrowScreen, isFirstChat, locale, forwardedRef, hubUrl }) => {
  const lastAction = chat.last_message ? chat.last_message.sent_at : chat.created_at;
  if (!lastAction) console.log(chat);

  if (isNarrowScreen)
    return <MobileChatPreview chat={chat} isFirstChat={isFirstChat} forwardedRef={forwardedRef} />;
  else
    return (
      <Fragment>
        {isFirstChat && <Divider component="li" />}
        <ListItemButton
          ref={forwardedRef}
          component="a"
          href={
            getLocalePrefix(locale) + "/chat/" + chat.chat_uuid + (hubUrl ? `?hub=${hubUrl}` : "")
          }
          alignItems="center"
          sx={{ display: "flex" }}
        >
          {!chat.chatting_partner ? (
            <StyledChatTitle
              chat={chat}
              //TODO(unused) mobile={isNarrowScreen}
              size="medium"
            />
          ) : (
            <StyledMiniProfilePreview profile={chat.chatting_partner} size="medium" nolink />
          )}
          <ListItemText
            secondary={
              <>
                <ContentPreview $unread={!!chat.unread_count}>{chat.content}</ContentPreview>
                <BadgeAndTimeContainer>
                  <span>
                    <span>{getDateTime(lastAction)}</span>
                  </span>
                  {chat.unread_count > 0 && (
                    <span>
                      <UnreadBadge color="primary" badgeContent={chat.unread_count} />
                    </span>
                  )}
                </BadgeAndTimeContainer>
              </>
            }
          />
        </ListItemButton>
        <Divider component="li" />
      </Fragment>
    );
};

ChatPreviews.propTypes = {
  chats: array.isRequired,
};

import { Button, Container, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import NextCookies from "next-cookies";
import React, { useEffect, useState, useContext } from "react";
import Cookies from "universal-cookie";
import { apiRequest, sendToLogin, redirect, getRedirectUrl } from "../public/lib/apiOperations";
import getTexts from "../public/texts/texts";
import ChatPreviews from "../src/components/communication/chat/ChatPreviews";
import UserContext from "../src/components/context/UserContext";
import WideLayout from "../src/components/layouts/WideLayout";
import UserSearchField from "../src/components/communication/chat/UserSearchField";
import ChatSearchField from "../src/components/communication/chat/ChatSearchField";
import LoadingSpinner from "../src/components/general/LoadingSpinner";

const InboxContainer = styled(Container)({
  padding: 0,
});

const Headline = styled(Typography)(({ theme }) => ({
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  textAlign: "center",
})) as typeof Typography;

const NewChatButton = styled(Button)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  marginRight: theme.spacing(1),
  [theme.breakpoints.down("lg")]: {
    marginLeft: theme.spacing(1),
  },
}));

const SearchChatButton = styled(Button)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  [theme.breakpoints.down("lg")]: {
    marginLeft: theme.spacing(1),
  },
}));

const SearchSectionContainer = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(4),
  [theme.breakpoints.down("lg")]: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
}));

export async function getServerSideProps(ctx) {
  const { auth_token } = NextCookies(ctx);
  const hubUrl = ctx?.query?.hub ?? null;

  if (ctx.req && !auth_token) {
    const texts = getTexts({ page: "chat", locale: ctx.locale });
    const message = texts.you_have_to_log_in_to_see_your_inbox;
    return sendToLogin(ctx, message);
  }
  const chatData: any = await getChatsOfLoggedInUser(auth_token, 1, ctx.locale);
  return {
    props: {
      chatData: chatData?.chats || null,
      initialNextPage: chatData?.nextPage || null,
      hubUrl,
    },
  };
}

export default function Inbox({ chatData, initialNextPage, hubUrl }) {
  const token = new Cookies().get("auth_token");
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });
  const [userSearchEnabled, setUserSearchEnabled] = useState(false);
  const [chatSearchEnabled, setChatSearchEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatsState, setChatsState] = useState({
    chats: parseChats(chatData, texts),
    nextPage: initialNextPage,
  });

  const [searchedChatsState, setSearchedChatsState] = useState({
    chats: [] as any[],
    nextPage: 0 as number | null,
  });

  const resetAlertMessage = () => setErrorMessage("");

  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchingOpen, setSearchingOpen] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const applyFilterToChats = async (filter) => {
    try {
      setSearchingOpen(true);
      setSearchTerm(filter);
      handleSetIsLoading(true);
      const url = `/api/chat/?page=1&search=${filter}`;
      const response = await apiRequest({
        token: token,
        method: "get",
        url: url,
        locale: locale,
      });

      handleSetIsLoading(false);

      const parsedChatData = parseChatData(response.data.results);
      const parsedChats = parseChats(parsedChatData, texts);

      setSearchedChatsState({
        chats: parsedChats,
        nextPage: response.data.next ? 2 : null,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadMoreFilteredChats = async () => {
    try {
      const url = `/api/chat/?page=${searchedChatsState.nextPage}&search=${searchTerm}`;
      const response = await apiRequest({
        token: token,
        method: "get",
        url: url,
        locale: locale,
      });

      const parsedChatData = parseChatData(response.data.results);
      const parsedChats = parseChats(parsedChatData, texts);

      setSearchedChatsState({
        ...searchedChatsState,
        nextPage: response.data.next ? searchedChatsState.nextPage! + 1 : null,
        chats: [...searchedChatsState.chats, ...parsedChats],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSetIsLoading = (newValue) => {
    setIsLoading(newValue);
  };

  const updateErrorMessage = (e) => {
    setErrorMessage(e);
  };

  const enableChatSearch = () => {
    setChatSearchEnabled(true);
  };

  const enableUserSearch = () => {
    setUserSearchEnabled(true);
  };

  const disableUserSearch = () => {
    setUserSearchEnabled(false);
  };

  const disableChatSearch = () => {
    setSearchedChatsState({
      chats: [],
      nextPage: 0,
    });
    setChatSearchEnabled(false);
  };

  const loadMoreChats = async () => {
    if (isFetchingMore) return; // Prevent multiple simultaneous requests

    try {
      setIsFetchingMore(true);
      const newChatData: any = await getChatsOfLoggedInUser(token, chatsState.nextPage, locale);
      const newChats = newChatData.chats;
      setChatsState({
        ...chatsState,
        nextPage: newChatData.nextPage,
        chats: [...chatsState.chats, ...parseChats(newChats, texts)],
      });
    } catch (error) {
      console.error("Error loading more chats:", error);
    } finally {
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    const redirectUrl = getRedirectUrl(locale);
    if (!user)
      redirect("/signin", {
        redirect: redirectUrl,
        message: texts.login_required,
      });
  }, [user]);

  return (
    <div>
      <WideLayout
        title={texts.inbox}
        messageType="error"
        message={errorMessage}
        resetAlertMessage={resetAlertMessage}
        hubUrl={hubUrl}
      >
        <InboxContainer maxWidth="md">
          <Headline component="h1" variant="h4">
            {texts.inbox}
          </Headline>
          <SearchSectionContainer>
            {(() => {
              if (userSearchEnabled)
                return (
                  <span>
                    <UserSearchField
                      cancelUserSearch={disableUserSearch}
                      setErrorMessage={updateErrorMessage}
                    />
                    <ChatPreviews
                      chatSearchEnabled={chatSearchEnabled}
                      loadFunc={loadMoreChats}
                      chats={chatsState.chats}
                      hasMore={!!chatsState.nextPage}
                      isLoading={isFetchingMore}
                    />
                  </span>
                );

              if (chatSearchEnabled)
                return (
                  <span>
                    <ChatSearchField
                      cancelChatSearch={disableChatSearch}
                      applyFilterToChats={applyFilterToChats}
                    />

                    {!searchingOpen ? (
                      <ChatPreviews
                        chatSearchEnabled={chatSearchEnabled}
                        loadFunc={loadMoreChats}
                        chats={chatsState.chats}
                        hasMore={!!chatsState.nextPage}
                        isLoading={isFetchingMore}
                      />
                    ) : (
                      [
                        !isLoading ? (
                          <ChatPreviews
                            chatSearchEnabled={chatSearchEnabled}
                            loadFunc={loadMoreFilteredChats}
                            chats={searchedChatsState.chats}
                            hasMore={!!searchedChatsState.nextPage}
                            isLoading={isFetchingMore}
                          />
                        ) : (
                          <LoadingSpinner isLoading />
                        ),
                      ]
                    )}
                  </span>
                );
              if (!userSearchEnabled && !chatSearchEnabled)
                return (
                  <span>
                    <NewChatButton
                      startIcon={<AddIcon />}
                      variant="contained"
                      color="primary"
                      onClick={enableUserSearch}
                    >
                      {texts.new_chat}
                    </NewChatButton>
                    <SearchChatButton
                      startIcon={<SearchIcon />}
                      variant="contained"
                      color="primary"
                      onClick={enableChatSearch}
                    >
                      {texts.find_a_chat}
                    </SearchChatButton>
                    <ChatPreviews
                      chatSearchEnabled={chatSearchEnabled}
                      loadFunc={loadMoreChats}
                      chats={chatsState.chats}
                      hasMore={!!chatsState.nextPage}
                      isLoading={isFetchingMore}
                    />
                  </span>
                );
            })()}
          </SearchSectionContainer>
        </InboxContainer>
      </WideLayout>
    </div>
  );
}

const parseChats = (chats, texts) =>
  chats
    ? chats.map((chat) => ({
        ...chat,
        chatting_partner:
          chat.participants.length === 2 && chat.participants.find((p) => p.id !== chat.user.id),
        unread_count: chat.unread_count,
        content: chat.last_message ? chat.last_message.content : texts.chat_has_been_created,
      }))
    : [];

async function getChatsOfLoggedInUser(token, nextPage, locale) {
  try {
    const url = `/api/chats/?page=${nextPage}`;
    const resp = await apiRequest({
      method: "get",
      url: url,
      token: token,
      locale: locale,
    });
    return {
      chats: parseChatData(resp.data.results),
      nextPage: resp.data.next ? nextPage + 1 : null,
    };
  } catch (err: any) {
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    console.log("error!");
    console.log(err);
    return null;
  }
}

const parseChatData = (chats) => {
  return chats.map((c) => ({
    ...c,
    participants: c.participants.map((p) => ({
      ...p.user_profile,
      role: p.role,
      created_at: p.created_at,
    })),
  }));
};

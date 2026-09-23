import NextCookies from "next-cookies";
import React, { useContext, useEffect, useState } from "react";
import Cookies from "universal-cookie";
import { apiRequest, redirect, sendToLogin, getRedirectUrl } from "../../public/lib/apiOperations";
import {
  getChat,
  getChatMessagesByUUID,
  getMessageFromServer,
  getRolesOptions,
  parseParticipantsWithRole,
} from "../../public/lib/messagingOperations";
import getTexts from "../../public/texts/texts";
import MessagingLayout from "../../src/components/communication/chat/MessagingLayout";
import UserContext from "../../src/components/context/UserContext";
import ConfirmDialog from "../../src/components/dialogs/ConfirmDialog";
import PageNotFound from "../../src/components/general/PageNotFound";
import FixedHeightLayout from "../../src/components/layouts/FixedHeightLayout";

export async function getServerSideProps(ctx) {
  const { auth_token } = NextCookies(ctx);
  const texts = getTexts({ page: "chat", locale: ctx.locale });
  if (ctx.req && !auth_token) {
    const message = texts.login_required;
    return sendToLogin(ctx, message);
  }
  const [chat, messages_object, rolesOptions] = await Promise.all([
    getChat(ctx.query.chatUUID, auth_token, ctx.locale),
    getChatMessagesByUUID(ctx.query.chatUUID, auth_token, 1, null, ctx.locale),
    getRolesOptions(ctx.locale),
  ]);
  if (!chat) {
    return {
      props: {
        chat_id: null,
      },
    };
  }
  if (!messages_object) throw Error("impossible");
  return {
    props: {
      chat_uuid: ctx.query.chatUUID,
      chatParticipants: parseParticipantsWithRole(chat.participants, rolesOptions),
      title: chat.title,
      messages: messages_object.messages,
      nextLink: messages_object.nextLink,
      hasMore: messages_object.hasMore,
      chatUUID: ctx.query["chatUUID"],
      rolesOptions: rolesOptions,
      chat_id: chat.id,
      idea: chat.idea,
    },
  };
}

export default function Chat({
  chatParticipants,
  title,
  chatUUID,
  messages,
  nextLink,
  hasMore,
  rolesOptions,
  chat_id,
  idea,
}) {
  const token = new Cookies().get("auth_token");
  const { chatSocket, user, socketConnectionState, locale } = useContext(UserContext);
  const [participants, setParticipants] = useState(chatParticipants);
  const [state, setState] = useState({
    nextPage: 2,
    messages: messages ? [...messages] : [],
    nextLink: nextLink,
    hasMore: hasMore,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const texts = getTexts({ page: "chat", locale: locale });
  const handleChatWindowClose = (e) => {
    if (state.messages.filter((m) => m.unconfirmed).length > 0) {
      e.preventDefault();
      return (e.returnValue = texts.changes_might_not_be_saved);
    }
  };

  useEffect(() => {
    if (chatSocket) {
      chatSocket.onmessage = async (rawData) => {
        if (rawData) {
          const data = JSON.parse(rawData.data);
          if (data.chat_uuid === chatUUID) {
            const message = await getMessageFromServer(data.message_id, token, locale);
            setState((state) => {
              return {
                ...state,
                messages: [
                  ...state.messages.filter(
                    (m) =>
                      !((m.content === message.content && m.unconfirmed) || m.id === message.id)
                  ),
                  message,
                ],
              };
            });
          }
        }
      };
    } else console.log("now there is no chat socket");
  }, [chatSocket, state]);

  useEffect(() => {
    const redirectUrl = getRedirectUrl(locale);
    if (!user)
      redirect("/signin", {
        redirect: redirectUrl,
        message: texts.login_required,
      });
  }, [user]);

  const chatting_partner = user && participants?.filter((p) => p.id !== user.id)[0];
  const isPrivateChat = !title || title.length === 0;

  const loadMoreMessages = async () => {
    try {
      const newMessagesObject = await getChatMessagesByUUID(
        chatUUID,
        token,
        state.nextPage,
        state.nextLink,
        locale
      );
      if (!newMessagesObject) throw Error("error");
      const newMessages = newMessagesObject.messages;
      const sortedMessages = newMessages.sort((a, b) => a.id - b.id);
      setState({
        ...state,
        nextPage: state.nextPage + 1,
        nextLink: newMessagesObject.nextLink,
        hasMore: newMessagesObject.hasMore,
        messages: [...sortedMessages, ...state.messages],
      });

      return [...sortedMessages];
    } catch (e) {
      console.log("error");
      console.log(e);
      setState({
        ...state,
        hasMore: false,
      });
      return [];
    }
  };

  const sendMessage = async (message) => {
    if (message.length > 0) {
      if (socketConnectionState === "connected") {
        await sendChatMessageThroughSocket(message);
      } else {
        await sendChatMessageThroughPostRequest(message, chatUUID, token);
      }
    }
  };

  const sendChatMessageThroughSocket = async (message) => {
    try {
      chatSocket.send(JSON.stringify({ message: message, chat_uuid: chatUUID }));
      setState({
        ...state,
        messages: [
          ...state.messages,
          {
            content: message,
            sender: user,
            unconfirmed: true,
            sent_at: new Date(),
          },
        ],
      });
    } catch (e) {
      console.log("couldn't send because the socket was closed. Falling back to post request");
      console.log(e);
      await sendChatMessageThroughPostRequest(message, chatUUID, token);
    }
  };

  const sendChatMessageThroughPostRequest = async (message, chat_uuid, token) => {
    try {
      const resp = await apiRequest({
        method: "post",
        url: "/api/chat/" + chat_uuid + "/send_message/",
        payload: { message_content: message },
        token: token,
        locale: locale,
      });
      console.log(resp.data);
      setState({
        ...state,
        messages: [
          ...state.messages,
          {
            content: message,
            sender: user,
            sent_at: new Date(),
          },
        ],
      });
    } catch (err: any) {
      if (err.response && err.response.data)
        console.log("Error in sendChatMessageThroughPostRequest: " + err.response.data.detail);
      setErrorMessage(err.response.data.detail);
      if (err.response && err.response.data.detail === "Invalid token.")
        console.log("invalid token! token:" + token);
      console.log(err);
      return null;
    }
  };

  const requestLeaveChat = () => {
    setDialogOpen(true);
  };

  const onDialogClose = async (confirmed) => {
    if (confirmed) await leaveChat();
    setDialogOpen(false);
  };

  const leaveChat = async () => {
    if (!title) setErrorMessage(texts.cannot_leave_private_chats);
    try {
      const res = await apiRequest({
        method: "post",
        url: "/api/chat/" + chatUUID + "/leave/",
        payload: {},
        token: token,
        locale: locale,
      });
      console.log(res);
      redirect("/inbox", {
        message: `${texts.left_group_chat} ${title}`,
      });
    } catch (e: any) {
      console.log(e.response.data.detail);
      setErrorMessage(e?.response?.data?.detail);
    }
  };

  return (
    <FixedHeightLayout
      message={errorMessage}
      messageType={errorMessage && "error"}
      title={
        isPrivateChat && chatting_partner
          ? texts.chat_with + " " + chatting_partner.first_name + " " + chatting_partner.last_name
          : title
      }
    >
      {user && chat_id ? (
        <MessagingLayout
          chatting_partner={chatting_partner}
          messages={state.messages}
          isPrivateChat={isPrivateChat}
          title={title}
          sendMessage={sendMessage}
          // socketConnectionState={socketConnectionState}
          loadMoreMessages={loadMoreMessages}
          hasMore={state.hasMore}
          participants={participants}
          rolesOptions={rolesOptions}
          token={token}
          chat_uuid={chatUUID}
          chat_id={chat_id}
          setParticipants={setParticipants}
          handleChatWindowClose={handleChatWindowClose}
          leaveChat={requestLeaveChat}
          relatedIdea={idea}
        />
      ) : (
        <PageNotFound itemName="Chat" returnText={texts.return_to_inbox} returnLink="/inbox" />
      )}
      <ConfirmDialog
        open={dialogOpen}
        onClose={onDialogClose}
        title={texts.confirm_leave_chat}
        text={texts.cant_rejoin}
        confirmText={texts.yes}
        cancelText={texts.no}
      />
    </FixedHeightLayout>
  );
}

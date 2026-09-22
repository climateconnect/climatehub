import { Alert, CircularProgress, Drawer, IconButton, Theme } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import React, { useContext, useEffect, useRef, useState } from "react";
import Cookies from "universal-cookie";
import { apiRequest } from "../../../../public/lib/apiOperations";
import {
  getChat,
  getChatMessagesByUUID,
  getMessageFromServer,
  getRolesOptions,
  parseParticipantsWithRole,
  startPrivateChat,
} from "../../../../public/lib/messagingOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import MiniProfilePreview from "../../profile/MiniProfilePreview";
import ChatContent from "./ChatContent";

type ChatDrawerProps = {
  open: boolean;
  onClose: () => void;
  contactPerson: any;
  contextTerm: string;
  contactRole?: string;
};

const useStyles = makeStyles((theme) => ({
  content: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minHeight: 0,
    width: "100%",
    overflow: "hidden",
  },
  header: {
    flex: "none",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.grey[200],
  },
  headerInfo: {
    textAlign: "left",
    minWidth: 0,
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4),
    flex: 1,
  },
  alert: {
    flex: "none",
    margin: theme.spacing(1),
  },
}));

export default function ChatDrawer({
  open,
  onClose,
  contactPerson,
  contextTerm,
  contactRole,
}: ChatDrawerProps) {
  const classes = useStyles();
  const isMobile = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const token = new Cookies().get("auth_token");
  const { chatSocket, user, locale, socketConnectionState } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });

  const [chat, setChat] = useState<any>(null);
  const [thread, setThread] = useState({
    nextPage: 2,
    messages: [],
    nextLink: null,
    hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [curMessage, setCurMessage] = useState("");
  const [showSendHelper, setShowSendHelper] = useState(false);
  const startedForContactRef = useRef(null);
  const triggerElementRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (!triggerElementRef.current && document.activeElement) {
        triggerElementRef.current = document.activeElement;
      }
    } else if (triggerElementRef.current) {
      (triggerElementRef.current as HTMLElement).focus?.();
      triggerElementRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !contactPerson) return;
    if (startedForContactRef.current === contactPerson.url_slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const chatResponse = await startPrivateChat(contactPerson, token, locale);
        if (!chatResponse?.chat_uuid) throw Error(texts.could_not_start_chat);
        const [chatData, messagesObject, rolesOptions] = await Promise.all([
          getChat(chatResponse.chat_uuid, token, locale),
          getChatMessagesByUUID(chatResponse.chat_uuid, token, 1, null, locale),
          getRolesOptions(locale),
        ]);
        if (!chatData || !messagesObject) throw Error(texts.could_not_start_chat);
        if (cancelled) return;
        startedForContactRef.current = contactPerson.url_slug;
        setChat({
          chat_uuid: chatResponse.chat_uuid,
          id: chatData.id,
          title: chatData.title,
          participants: parseParticipantsWithRole(chatData.participants, rolesOptions ?? []),
        });
        setThread({
          nextPage: 2,
          messages: [...(messagesObject.messages ?? [])],
          nextLink: messagesObject.nextLink,
          hasMore: messagesObject.hasMore,
        });
      } catch (e: any) {
        if (!cancelled) setErrorMessage(e?.message || texts.could_not_start_chat);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactPerson, token, locale]);

  useEffect(() => {
    if (!chatSocket || !chat?.chat_uuid) return;
    chatSocket.onmessage = async (rawData) => {
      if (!rawData) return;
      const data = JSON.parse(rawData.data);
      if (data.chat_uuid !== chat.chat_uuid) return;
      const message = await getMessageFromServer(data.message_id, token, locale);
      setThread((thread) => ({
        ...thread,
        messages: [
          ...thread.messages.filter(
            (m) => !((m.content === message.content && m.unconfirmed) || m.id === message.id)
          ),
          message,
        ],
      }));
    };
  }, [chatSocket, chat?.chat_uuid, token, locale]);

  const loadMoreMessages = async () => {
    try {
      const newMessagesObject = await getChatMessagesByUUID(
        chat.chat_uuid,
        token,
        thread.nextPage,
        thread.nextLink,
        locale
      );
      if (!newMessagesObject) throw Error("error");
      const newMessages = newMessagesObject.messages;
      const sortedMessages = newMessages.sort((a, b) => a.id - b.id);
      setThread({
        ...thread,
        nextPage: thread.nextPage + 1,
        nextLink: newMessagesObject.nextLink,
        hasMore: newMessagesObject.hasMore,
        messages: [...sortedMessages, ...thread.messages],
      });
      return [...sortedMessages];
    } catch (e) {
      console.log(e);
      setThread({
        ...thread,
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
        await sendChatMessageThroughPostRequest(message, chat.chat_uuid, token);
      }
    }
  };

  const sendChatMessageThroughSocket = async (message) => {
    try {
      chatSocket.send(JSON.stringify({ message: message, chat_uuid: chat.chat_uuid }));
      setThread((thread) => ({
        ...thread,
        messages: [
          ...thread.messages,
          {
            content: message,
            sender: user,
            unconfirmed: true,
            sent_at: new Date(),
          },
        ],
      }));
    } catch (e) {
      console.log("couldn't send because the socket was closed. Falling back to post request");
      console.log(e);
      await sendChatMessageThroughPostRequest(message, chat.chat_uuid, token);
    }
  };

  const sendChatMessageThroughPostRequest = async (message, chat_uuid, token) => {
    try {
      await apiRequest({
        method: "post",
        url: "/api/chat/" + chat_uuid + "/send_message/",
        payload: { message_content: message },
        token: token,
        locale: locale,
      });
      setThread((thread) => ({
        ...thread,
        messages: [
          ...thread.messages,
          {
            content: message,
            sender: user,
            sent_at: new Date(),
          },
        ],
      }));
      return true;
    } catch (err: any) {
      if (err?.response?.data)
        console.log("Error in sendChatMessageThroughPostRequest: " + err.response.data?.detail);
      setErrorMessage(err?.response?.data?.detail || texts.could_not_start_chat);
      return false;
    }
  };

  const onSendMessage = (event) => {
    sendMessage(curMessage);
    setCurMessage("");
    if (event) event.preventDefault();
  };

  const onCurMessageChange = (event) => {
    setCurMessage(event.target.value);
  };

  const handleMessageKeydown = (event) => {
    if (event.key === "Enter")
      if (event.ctrlKey) onSendMessage();
      else {
        setShowSendHelper(true);
      }
  };

  if (!contactPerson) return null;

  const chatting_partner = chat?.participants?.filter((p) => p.id !== user?.id)[0] ?? contactPerson;
  const userParticipant = chat?.participants?.find((p) => p.id === user?.id);
  const partnerFullName = [chatting_partner?.first_name, chatting_partner?.last_name]
    .filter(Boolean)
    .join(" ");
  const partnerDisplayName = chatting_partner?.name ?? partnerFullName;
  const drawerLabel = texts.chat_with + " " + partnerDisplayName;
  const emptyConversationLead =
    contextTerm && partnerFullName
      ? texts.this_is_the_very_beginning_of_your_conversation_about.replace(
          "{context}",
          contextTerm
        ) +
        " " +
        partnerFullName +
        "."
      : undefined;

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      variant="temporary"
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        role: "dialog",
        "aria-label": drawerLabel,
        sx: {
          display: "flex",
          flexDirection: "column",
          width: { xs: "100%", sm: 400 },
          maxWidth: "100%",
          height: { xs: "auto", sm: "100%" },
          minHeight: { xs: 280, sm: "auto" },
          maxHeight: { xs: "min(75vh, 560px)", sm: "100%" },
          borderTopLeftRadius: { xs: 28, sm: 0 },
          borderTopRightRadius: { xs: 28, sm: 0 },
        },
      }}
    >
      <div className={classes.content}>
        <div className={classes.header}>
          <div className={classes.headerInfo}>
            <MiniProfilePreview profile={chatting_partner} title={contactRole} />
          </div>
          <IconButton onClick={onClose} aria-label={texts.close_chat} size="small">
            <CloseIcon />
          </IconButton>
        </div>
        {loading && (
          <div className={classes.loadingContainer}>
            <CircularProgress size={28} />
          </div>
        )}
        {errorMessage && (
          <Alert severity="error" className={classes.alert}>
            {errorMessage}
          </Alert>
        )}
        {chat && !loading && (
          <ChatContent
            showChatParticipants={false}
            participants={chat.participants}
            user_role={userParticipant?.role}
            messages={thread.messages}
            chatting_partner={chatting_partner}
            hasMore={thread.hasMore}
            loadMoreMessages={loadMoreMessages}
            isPrivateChat={true}
            title={null}
            loading={false}
            curMessage={curMessage}
            showSendHelper={showSendHelper}
            setShowSendHelper={setShowSendHelper}
            onCurMessageChange={onCurMessageChange}
            handleMessageKeydown={handleMessageKeydown}
            onSendMessage={onSendMessage}
            handleToggleMemberManagementExpanded={() => {}}
            emptyConversationLead={emptyConversationLead}
          />
        )}
      </div>
    </Drawer>
  );
}

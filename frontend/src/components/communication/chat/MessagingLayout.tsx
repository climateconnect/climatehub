import makeStyles from "@mui/styles/makeStyles";
import Alert from "@mui/material/Alert";
import React, { useContext, useEffect, useState } from "react";
import ROLE_TYPES from "../../../../public/data/role_types";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import ChatContent from "./ChatContent";
import ChatHeader from "./ChatHeader";
import ChatMemberManagementOverlay from "./ChatMemberManagementOverlay";

const useStyles = makeStyles((theme) => {
  return {
    maxWidth: {
      maxWidth: theme.breakpoints.values["md"],
      margin: "0 auto",
    },
    showParticipantsButton: {
      cursor: "pointer",
    },
    alert: {
      width: "100%",
      maxWidth: theme.breakpoints.values["md"],
      margin: "0 auto",
    },
  };
});

export default function MessagingLayout({
  chatting_partner,
  messages,
  loading,
  sendMessage,
  loadMoreMessages,
  hasMore,
  title,
  isPrivateChat,
  participants,
  setParticipants,
  rolesOptions,
  token,
  chat_uuid,
  chat_id,
  handleChatWindowClose,
  leaveChat,
  relatedIdea,
  inputNote = "",
}) {
  const classes = useStyles();
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });

  const handleWindowClose = (e) => {
    if (curMessage && curMessage.length > 0) {
      e.preventDefault();
      return (e.returnValue = texts.you_have_an_unsent_message_are_you_sure_you_want_to_leave);
    } else handleChatWindowClose();
  };

  useEffect(() => {
    window.addEventListener("beforeunload", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
    };
  });
  const [curMessage, setCurMessage] = useState("");
  const [showChatParticipants, setShowChatParticipants] = useState(false);
  const [memberManagementExpanded, setMemberManagementExpanded] = useState(false);
  const [alertMessage, setAlertMessage] = useState({});
  const [showAlertMessage, setShowAlertMessage] = useState(false);
  const [showSendHelper, setShowSendHelper] = useState(false);
  const userParticipant = participants.find((p) => p.id === user?.id);
  const user_role = userParticipant && userParticipant.role;
  //TODO show user when socket has closed
  const onSendMessage = (event) => {
    sendMessage(curMessage);
    setCurMessage("");
    if (event) event.preventDefault();
  };
  const canEditMembers =
    user_role?.role_type === ROLE_TYPES.all_type ||
    user_role?.role_type === ROLE_TYPES.read_write_type;

  const handleMessageKeydown = (event) => {
    if (event.key === "Enter")
      if (event.ctrlKey) onSendMessage();
      else {
        setShowSendHelper(true);
      }
  };

  const onCurMessageChange = (event) => {
    setCurMessage(event.target.value);
  };

  const handleToggleMemberManagementExpanded = (msg, severity) => {
    if (msg && severity) {
      setAlertMessage({ message: msg, severity: severity });
      setShowAlertMessage(true);
    }
    setMemberManagementExpanded(!memberManagementExpanded);
  };

  const toggleShowChatParticipants = () => setShowChatParticipants(!showChatParticipants);
  return (
    <>
      <ChatHeader
        isPrivateChat={isPrivateChat}
        chatting_partner={chatting_partner}
        title={title}
        toggleShowChatParticipants={toggleShowChatParticipants}
        showChatParticipants={showChatParticipants}
        className={classes.maxWidth}
        canEditMembers={canEditMembers}
        handleToggleMemberManagementExpanded={handleToggleMemberManagementExpanded}
        memberManagementExpanded={memberManagementExpanded}
        leaveChat={leaveChat}
      />
      {showAlertMessage && alertMessage && (
        <Alert
          className={classes.alert}
          severity={alertMessage.severity}
          onClose={() => {
            setShowAlertMessage(!showAlertMessage);
          }}
        >
          {alertMessage.message}
        </Alert>
      )}
      {!memberManagementExpanded ? (
        <ChatContent
          showChatParticipants={showChatParticipants}
          participants={participants}
          user_role={user_role}
          messages={messages}
          chatting_partner={chatting_partner}
          hasMore={hasMore}
          loadMoreMessages={loadMoreMessages}
          isPrivateChat={isPrivateChat}
          title={title}
          loading={loading}
          curMessage={curMessage}
          showSendHelper={showSendHelper}
          setShowSendHelper={setShowSendHelper}
          onCurMessageChange={onCurMessageChange}
          handleMessageKeydown={handleMessageKeydown}
          onSendMessage={onSendMessage}
          handleToggleMemberManagementExpanded={handleToggleMemberManagementExpanded}
          relatedIdea={relatedIdea}
          inputNote={inputNote}
        />
      ) : (
        <ChatMemberManagementOverlay
          participants={participants}
          user_role={user_role}
          rolesOptions={rolesOptions}
          token={token}
          chat_uuid={chat_uuid}
          chat_id={chat_id}
          toggleMemberManagementExpanded={handleToggleMemberManagementExpanded}
          setParticipants={setParticipants}
        />
      )}
    </>
  );
}

import { Button, IconButton, TextField, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import SendIcon from "@mui/icons-material/Send";
import React, { useContext } from "react";
import ROLE_TYPES from "../../../../public/data/role_types";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import MiniProfilePreview from "../../profile/MiniProfilePreview";
import Messages from "./Messages";

const ChatParticipantsContainer = styled("div")(({ theme }) => ({
  background: theme.palette.grey[200],
  width: "100%",
  paddingBottom: theme.spacing(1),
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  maxWidth: 960,
  margin: "0 auto",
}));

const ParticipantPreview = styled(MiniProfilePreview)(({ theme }) => ({
  padding: theme.spacing(1),
}));

const StyledMessages = styled(Messages)(({ theme }) => ({
  flex: "auto",
  overflowY: "auto",
  width: "100%",
  maxWidth: theme.breakpoints.values["md"],
  margin: "0 auto",
}));

const BottomBar = styled("div")(({ theme }) => ({
  background: theme.palette.grey[200],
  flex: "none",
  width: "100%",
  maxWidth: theme.breakpoints.values["md"],
  margin: "0 auto",
}));

const SendMessageBarContent = styled("form")(({ theme }) => ({
  padding: theme.spacing(1),
}));

const MessageInput = styled(TextField)({
  width: "calc(100% - 60px)",
  border: 0,
});

const SendButton = styled(IconButton)(({ theme }) => ({
  height: 40,
  width: 40,
  marginLeft: theme.spacing(2),
}));

const SendButtonIcon = styled(SendIcon)({
  height: 35,
  width: 35,
});

export default function ChatContent({
  showChatParticipants,
  participants,
  user_role,
  messages,
  chatting_partner,
  hasMore,
  loadMoreMessages,
  isPrivateChat,
  title,
  loading,
  curMessage,
  onCurMessageChange,
  handleMessageKeydown,
  onSendMessage,
  handleToggleMemberManagementExpanded,
  showSendHelper,
  setShowSendHelper,
  relatedIdea,
  emptyConversationLead,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });

  const handleOpen = () => {
    setShowSendHelper(true);
  };
  const handleClose = () => {
    setShowSendHelper(false);
  };

  return (
    <>
      {showChatParticipants && (
        <ChatParticipantsContainer>
          {participants.map((p, index) => {
            return <ParticipantPreview key={index} profile={p} />;
          })}
          {user_role.role_type === ROLE_TYPES.all_type && (
            <Button startIcon={<GroupAddIcon />} onClick={handleToggleMemberManagementExpanded}>
              {texts.manage}
            </Button>
          )}
        </ChatParticipantsContainer>
      )}
      {loading ? (
        <div>{texts.loading_and_waiting}</div>
      ) : (
        <StyledMessages
          messages={messages}
          chatting_partner={chatting_partner}
          hasMore={hasMore}
          loadFunc={loadMoreMessages}
          isPrivateChat={isPrivateChat}
          title={title}
          texts={texts}
          relatedIdea={relatedIdea}
          emptyConversationLead={emptyConversationLead}
        />
      )}
      <BottomBar>
        <SendMessageBarContent onSubmit={onSendMessage}>
          <MessageInput
            variant="outlined"
            size="small"
            autoFocus
            multiline
            placeholder={texts.message}
            value={curMessage}
            onChange={onCurMessageChange}
            onKeyDown={handleMessageKeydown}
          />
          <Tooltip
            open={showSendHelper}
            onClose={handleClose}
            onOpen={handleOpen}
            arrow
            title={texts.click_here_to_send_or_press_ctrl_enter}
            placement="top"
          >
            <SendButton
              disableRipple
              disableFocusRipple
              size="small"
              type="submit"
              style={{ backgroundColor: "transparent" }}
            >
              <SendButtonIcon />
            </SendButton>
          </Tooltip>
        </SendMessageBarContent>
      </BottomBar>
    </>
  );
}

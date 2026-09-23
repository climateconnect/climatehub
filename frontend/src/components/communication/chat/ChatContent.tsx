import { Button, IconButton, TextField, Tooltip } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import SendIcon from "@mui/icons-material/Send";
import React, { useContext } from "react";
import ROLE_TYPES from "../../../../public/data/role_types";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import MiniProfilePreview from "../../profile/MiniProfilePreview";
import Messages from "./Messages";

const useStyles = makeStyles((theme) => ({
  chatParticipantsContainer: {
    background: theme.palette.grey[200],
    width: "100%",
    paddingBottom: theme.spacing(1),
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    maxWidth: 960,
    margin: "0 auto",
  },
  chatParticipantsPreview: {
    padding: theme.spacing(1),
  },
  content: {
    flex: "auto",
    overflowY: "auto",
    width: "100%",
  },
  maxWidth: {
    maxWidth: theme.breakpoints.values["md"],
    margin: "0 auto",
  },
  bottomBar: {
    background: theme.palette.grey[200],
    flex: "none",
    width: "100%",
  },
  sendMessageBarContent: {
    padding: theme.spacing(1),
  },
  messageInput: {
    width: "calc(100% - 60px)",
    border: 0,
  },
  sendButton: {
    height: 40,
    width: 40,
    marginLeft: theme.spacing(2),
  },
  sendButtonIcon: {
    height: 35,
    width: 35,
  },
}));

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
  const classes = useStyles();
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
        <div className={classes.chatParticipantsContainer}>
          {participants.map((p, index) => {
            return (
              <MiniProfilePreview
                key={index}
                profile={p}
                className={classes.chatParticipantsPreview}
              />
            );
          })}
          {user_role.role_type === ROLE_TYPES.all_type && (
            <Button
              className={classes.manageMembersButton}
              startIcon={<GroupAddIcon />}
              onClick={handleToggleMemberManagementExpanded}
            >
              {texts.manage}
            </Button>
          )}
        </div>
      )}
      {loading ? (
        <div>{texts.loading_and_waiting}</div>
      ) : (
        <Messages
          messages={messages}
          chatting_partner={chatting_partner}
          className={`${classes.content} ${classes.maxWidth}`}
          hasMore={hasMore}
          loadFunc={loadMoreMessages}
          isPrivateChat={isPrivateChat}
          title={title}
          texts={texts}
          relatedIdea={relatedIdea}
          emptyConversationLead={emptyConversationLead}
        />
      )}
      <div className={`${classes.bottomBar} ${classes.maxWidth}`}>
        <form className={classes.sendMessageBarContent} onSubmit={onSendMessage}>
          <TextField
            variant="outlined"
            size="small"
            autoFocus
            multiline
            placeholder={texts.message}
            className={classes.messageInput}
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
            <IconButton
              disableRipple
              disableFocusRipple
              size="small"
              type="submit"
              className={classes.sendButton}
              style={{ backgroundColor: "transparent" }}
            >
              <SendIcon className={classes.sendButtonIcon} />
            </IconButton>
          </Tooltip>
        </form>
      </div>
    </>
  );
}

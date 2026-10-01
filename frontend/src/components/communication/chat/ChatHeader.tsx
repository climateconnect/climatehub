import { IconButton, Link, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import getTexts from "../../../../public/texts/texts";
import ChatTitle from "../../communication/chat/ChatTitle";
import UserContext from "../../context/UserContext";
import MiniProfilePreview from "../../profile/MiniProfilePreview";

const TopBar = styled("div")(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(1),
  background: theme.palette.grey[200],
  width: "100%",
  flex: "none",
}));

const BackButton = styled(IconButton)(({ theme }) => ({
  float: "left",
  left: theme.spacing(1),
  top: theme.spacing(0.75),
}));

const ManageMembersButton = styled(IconButton)(({ theme }) => ({
  float: "right",
  right: theme.spacing(1),
  top: theme.spacing(0.75),
}));

const ShowParticipantsLink = styled(Link)({
  cursor: "pointer",
  userSelect: "none",
});

export default function ChatHeader({
  isPrivateChat,
  chatting_partner,
  title,
  toggleShowChatParticipants,
  showChatParticipants,
  className,
  canEditMembers,
  handleToggleMemberManagementExpanded,
  memberManagementExpanded,
  leaveChat,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });
  return (
    <TopBar className={className}>
      {!memberManagementExpanded && (
        <Tooltip title={texts.back_to_inbox}>
          <BackButton href={getLocalePrefix(locale) + "/inbox"} size="large">
            <KeyboardArrowLeftIcon />
          </BackButton>
        </Tooltip>
      )}
      {!isPrivateChat && (
        <Tooltip title={texts.leave_group_chat}>
          <ManageMembersButton onClick={leaveChat} size="large">
            <ExitToAppIcon />
          </ManageMembersButton>
        </Tooltip>
      )}
      {!isPrivateChat && !showChatParticipants && canEditMembers && !memberManagementExpanded && (
        <Tooltip title={texts.manage_chat_members}>
          <ManageMembersButton onClick={handleToggleMemberManagementExpanded} size="large">
            <GroupAddIcon />
          </ManageMembersButton>
        </Tooltip>
      )}
      {isPrivateChat ? (
        <MiniProfilePreview profile={chatting_partner} />
      ) : (
        <div>
          <ChatTitle chat={{ name: title }} />
          <div>
            <ShowParticipantsLink underline="always" onClick={toggleShowChatParticipants}>
              {showChatParticipants ? texts.hide_chat_participants : texts.show_chat_participants}
            </ShowParticipantsLink>
          </div>
        </div>
      )}
    </TopBar>
  );
}

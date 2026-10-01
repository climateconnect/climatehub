import React from "react";
import { Avatar, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import GroupIcon from "@mui/icons-material/Group";

const AvatarWrapper = styled("div")({
  display: "inline-block",
  verticalAlign: "middle",
});

const mediumAvatarSx = {
  height: 30,
  width: 30,
};

const ProfileName = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$medium",
})<{ $medium?: boolean }>(({ theme, $medium }) => ({
  display: "inline-block",
  verticalAlign: "middle",
  marginLeft: theme.spacing(1),
  ...($medium && { fontSize: 16 }),
}));

export default function ChatTitle({ chat, className, size }) {
  return (
    <div className={className}>
      <AvatarWrapper>
        <Avatar sx={size == "medium" ? mediumAvatarSx : undefined}>
          <GroupIcon />
        </Avatar>
      </AvatarWrapper>
      <ProfileName color="inherit" $medium={size === "medium"} variant="h6">
        {chat.name}
      </ProfileName>
    </div>
  );
}

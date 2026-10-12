import { Avatar, IconButton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import ClearIcon from "@mui/icons-material/Clear";
import React from "react";
import { getImageUrl } from "./../../../public/lib/imageOperations";
import AppLink from "../general/AppLink";
import ProfileBadge from "./ProfileBadge";

const shouldForwardProp = (prop: PropertyKey) => !String(prop).startsWith("$");

const AvatarWrapper = styled("div", { shouldForwardProp })<{ $isMedium?: boolean }>(
  ({ $isMedium }) => ({
    display: "inline-block",
    verticalAlign: "middle",
    ...($isMedium && {
      "& .MuiBadge-badge": {
        bottom: "20%",
      },
    }),
  })
);

const ProfileName = styled(Typography, { shouldForwardProp })<{
  $size?: string;
  $hasTitle?: boolean;
}>(({ $size, $hasTitle }) => ({
  display: "inline-block",
  verticalAlign: "middle",
  ...($hasTitle && {
    lineHeight: 1.2,
  }),
  ...($size === "medium" && {
    fontSize: 16,
  }),
  ...($size === "small" && {
    fontSize: 14,
  }),
}));

const ProfileAvatar = styled(Avatar, { shouldForwardProp })<{ $size?: string }>(({ $size }) => ({
  ...($size === "small" && {
    height: 20,
    width: 20,
  }),
  ...($size === "medium" && {
    height: 30,
    width: 30,
  }),
}));

const ContentWrapper = styled("span")({
  display: "inline-flex",
  alignItems: "center",
  verticalAlign: "middle",
});

const NameAndTitle = styled("span")(({ theme }) => ({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "flex-start",
  marginLeft: theme.spacing(1),
}));

const ProfileTitle = styled(Typography)({
  lineHeight: 1.2,
});

type Props = { className?; profile?; avatarClassName?; size?; nolink?; onDelete?; title? };

export default function MiniProfilePreview({
  className,
  profile,
  avatarClassName,
  size,
  nolink,
  onDelete,
  title,
}: Props) {
  if (!nolink)
    return (
      <>
        <AppLink
          color="inherit"
          href={`/profiles/${profile.url_slug}`}
          className={`${"" /*TODO(undefined) classes.avatarWithInfo*/} ${className}`}
          underline="hover"
        >
          <Content profile={profile} avatarClassName={avatarClassName} size={size} title={title} />
        </AppLink>
        {onDelete && (
          <IconButton onClick={() => onDelete(profile)} size="large">
            <ClearIcon />
          </IconButton>
        )}
      </>
    );
  else
    return (
      <div className={`${"" /*TODO(undefined) classes.avatarWithInfo*/} ${className}`}>
        <Content profile={profile} avatarClassName={avatarClassName} size={size} title={title} />
      </div>
    );
}

function Content({ profile, avatarClassName, size, title }) {
  const avatarProps = {
    src: getImageUrl(profile.thumbnail_image),
    className: avatarClassName,
    $size: size,
  };
  return (
    <ContentWrapper>
      <AvatarWrapper $isMedium={size === "medium"}>
        {profile.badges?.length > 0 ? (
          <ProfileBadge
            badge={profile.badges[0]}
            size={["medium", "small"].includes(size) ? "small" : "medium"}
          >
            <ProfileAvatar {...avatarProps} />
          </ProfileBadge>
        ) : (
          <ProfileAvatar {...avatarProps} />
        )}
      </AvatarWrapper>
      <NameAndTitle>
        <ProfileName color="inherit" $size={size} $hasTitle={!!title} variant="h6">
          {[profile.first_name, profile.last_name].filter(Boolean).join(" ")}
        </ProfileName>
        {title && (
          <ProfileTitle color="textSecondary" variant="body2">
            {title}
          </ProfileTitle>
        )}
      </NameAndTitle>
    </ContentWrapper>
  );
}

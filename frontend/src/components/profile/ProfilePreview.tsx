import { Avatar, Button, Tooltip, Typography } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";
import React, { useContext } from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import AppLink from "../general/AppLink";
import ProfileBadge from "./ProfileBadge";

const AvatarWithInfo = styled("div")(({ theme }) => ({
  textAlign: "center",
  alginSelf: "center",
  maxWidth: theme.spacing(36),
  padding: theme.spacing(2),
}));

const ProfileAvatar = styled(Avatar)(({ theme }) => ({
  height: theme.spacing(20),
  width: theme.spacing(20),
  margin: "0 auto",
  fontSize: 50,
}));

const NameText = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  padding: theme.spacing(1),
  paddingBottom: 0,
  marginTop: theme.spacing(2),
  textAlign: "center",
}));

const MessageButton = styled(Button)({
  margin: "0 auto",
});

const AdditionalInfo = styled("div")(({ theme }) => ({
  paddingBottom: theme.spacing(1),
}));

const InfoText = styled(Typography, {
  shouldForwardProp: (prop) => !String(prop).startsWith("$"),
})<{ $lowImportance?: boolean }>(({ theme, $lowImportance }) => ({
  display: "flex",
  alignItems: "center",
  margin: "0 auto",
  textAlign: "center",
  justifyContent: "center",
  marginTop: theme.spacing(0.5),
  ...($lowImportance
    ? {
        color: theme.palette.grey[700],
        fontSize: "12px",
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
      }
    : {
        color: "#000",
      }),
}));

const DisableHoverLink = styled(AppLink)(({ theme }) => ({
  color: theme.palette.background?.default_contrastText,
  "&:hover": {
    textDecoration: "none",
  },
}));

const iconSx = (theme: Theme) => ({ marginRight: theme.spacing(0.5) });

export default function ProfilePreview({ profile, allowMessage, showAdditionalInfo }: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "profile", locale: locale });
  const avatarProps = {
    alt: profile.name,
    size: "large",
    src: getImageUrl(profile.thumbnail_image),
  };
  return (
    <AvatarWithInfo>
      <DisableHoverLink href={`/profiles/${profile.url_slug}`} underline="hover">
        {profile.badges?.length > 0 ? (
          <ProfileBadge badge={profile.badges[0]}>
            <ProfileAvatar {...avatarProps} />
          </ProfileBadge>
        ) : (
          <ProfileAvatar {...avatarProps} />
        )}
        <NameText variant="h6">{profile.first_name + " " + profile.last_name}</NameText>
        {showAdditionalInfo && (
          <AdditionalInfo>
            {Object.keys(profile.additionalInfo).map((key, index) => {
              const item = profile.additionalInfo[key];
              return (
                <InfoText key={index} $lowImportance={item.importance === "low"}>
                  {item.icon &&
                    (item.toolTipText ? (
                      <Tooltip title={item.toolTipText}>
                        <item.icon sx={iconSx} name={item.iconName} />
                      </Tooltip>
                    ) : (
                      <item.icon sx={iconSx} name={item.iconName} />
                    ))}
                  {item.text}
                </InfoText>
              );
            })}
          </AdditionalInfo>
        )}
      </DisableHoverLink>
      {allowMessage && (
        <div>
          <MessageButton
            variant="contained"
            href={"/messageUser/" + profile.url_slug}
            color="primary"
          >
            {texts.send_message}
          </MessageButton>
        </div>
      )}
    </AvatarWithInfo>
  );
}

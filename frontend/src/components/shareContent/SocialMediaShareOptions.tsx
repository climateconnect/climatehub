import { Button, InputAdornment, TextField } from "@mui/material";
import { styled } from "@mui/material/styles";
import LinkIcon from "@mui/icons-material/Link";
import React from "react";
import {
  BlueskyIcon,
  BlueskyShareButton,
  EmailIcon,
  EmailShareButton,
  FacebookIcon,
  FacebookShareButton,
  RedditIcon,
  RedditShareButton,
  TelegramIcon,
  TelegramShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from "react-share";

const ShareButtonsContainer = styled("div")(({ theme }) => ({
  paddingBottom: theme.spacing(2),
  display: "flex",
  gap: "5px",
  justifyContent: "center",
  flexWrap: "wrap",
}));

const CopyButton = styled(Button)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

//The actual share buttons and copy-link field, used both in the
//SocialMediaShareDialog (modal) and inline (e.g. on the project submitted page)
export default function SocialMediaShareOptions({
  createShareRecord,
  tinyScreen,
  SHARE_OPTIONS,
  contentLink,
  messageTitle,
  mailBody,
  texts,
}) {
  const iconSize = tinyScreen ? 40 : 50;

  const facebookHashtag = "#BelieveInTogether";

  const handleClick = (sharedVia) => {
    createShareRecord(sharedVia);
    navigator.clipboard.writeText(contentLink);
  };

  return (
    <>
      <ShareButtonsContainer>
        <EmailShareButton
          beforeOnClick={() => createShareRecord(SHARE_OPTIONS.e_mail)}
          url={contentLink}
          subject={messageTitle}
          body={mailBody}
        >
          <EmailIcon size={iconSize} round={true} />
        </EmailShareButton>
        <FacebookShareButton
          beforeOnClick={() => createShareRecord(SHARE_OPTIONS.facebook)}
          url={contentLink}
          hashtag={facebookHashtag}
        >
          <FacebookIcon size={iconSize} round={true} />
        </FacebookShareButton>
        <BlueskyShareButton
          beforeOnClick={() => createShareRecord(SHARE_OPTIONS.bluesky)}
          url={contentLink}
          title={messageTitle}
        >
          <BlueskyIcon size={iconSize} round={true} />
        </BlueskyShareButton>
        <WhatsappShareButton
          beforeOnClick={() => createShareRecord(SHARE_OPTIONS.whatsapp)}
          url={contentLink}
          title={messageTitle}
        >
          <WhatsappIcon size={iconSize} round={true} />
        </WhatsappShareButton>
        <RedditShareButton
          beforeOnClick={() => createShareRecord(SHARE_OPTIONS.reddit)}
          url={contentLink}
          title={messageTitle}
        >
          <RedditIcon size={iconSize} round={true} />
        </RedditShareButton>
        <TelegramShareButton
          beforeOnClick={() => createShareRecord(SHARE_OPTIONS.telegram)}
          url={contentLink}
          title={messageTitle}
        >
          <TelegramIcon size={iconSize} round={true} />
        </TelegramShareButton>
      </ShareButtonsContainer>
      <TextField
        fullWidth
        label={texts.link}
        defaultValue={contentLink}
        InputProps={{
          readOnly: true,
          startAdornment: (
            <InputAdornment position="start">
              <LinkIcon />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <CopyButton onClick={() => handleClick(SHARE_OPTIONS.link)}>
                {tinyScreen ? texts.copy : texts.copy_link}
              </CopyButton>
            </InputAdornment>
          ),
        }}
        variant="outlined"
      />
    </>
  );
}

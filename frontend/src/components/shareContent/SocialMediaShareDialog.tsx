import React from "react";
import GenericDialog from "../dialogs/GenericDialog";
import SocialMediaShareOptions from "./SocialMediaShareOptions";

export default function SocialMediaShareDialog({
  open,
  onClose,
  createShareRecord,
  tinyScreen,
  SHARE_OPTIONS,
  contentLink,
  messageTitle,
  mailBody,
  texts,
  dialogTitle,
}) {
  const handleClose = () => {
    onClose(false);
  };

  return (
    <GenericDialog onClose={handleClose} open={open} title={dialogTitle}>
      <SocialMediaShareOptions
        createShareRecord={createShareRecord}
        tinyScreen={tinyScreen}
        SHARE_OPTIONS={SHARE_OPTIONS}
        contentLink={contentLink}
        messageTitle={messageTitle}
        mailBody={mailBody}
        texts={texts}
      />
    </GenericDialog>
  );
}

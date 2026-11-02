import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { func, bool, object, string, oneOfType } from "prop-types";

import React from "react";

import GenericDialog from "./GenericDialog";

const ButtonsContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
  textAlign: "right",
}));

const DialogButton = styled(Button)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

export default function ConfirmDialog({
  onClose,
  open,
  cancelText,
  confirmText,
  text,
  title,
  className,
}) {
  const handleCancel = () => {
    onClose(false);
  };

  const handleConfirm = () => {
    onClose(true);
  };
  return (
    <GenericDialog onClose={handleCancel} open={open} title={title} dialogContentClass={className}>
      <Typography>{text}</Typography>
      <ButtonsContainer>
        <DialogButton variant="contained" color="primary" onClick={handleCancel}>
          {cancelText}
        </DialogButton>
        <DialogButton variant="contained" color="primary" onClick={handleConfirm}>
          {confirmText}
        </DialogButton>
      </ButtonsContainer>
    </GenericDialog>
  );
}

ConfirmDialog.propTypes = {
  onClose: func.isRequired,
  open: bool.isRequired,
  cancelText: string.isRequired,
  confirmText: string.isRequired,
  text: oneOfType([string, object]).isRequired,
  title: string.isRequired,
  className: string,
};
ConfirmDialog.defaultProps = {
  className: "",
};

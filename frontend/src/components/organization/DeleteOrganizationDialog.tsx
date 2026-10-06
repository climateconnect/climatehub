import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { bool, func, object, oneOfType, string } from "prop-types";
import React from "react";

import GenericDialog from "../dialogs/GenericDialog";

const ButtonsContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
  textAlign: "right",
}));

const DialogButton = styled(Button)(({ theme }) => ({
  marginLeft: theme.spacing(1),
}));

export default function DeleteOrganizationDialog({
  onClose,
  open,
  cancelText,
  confirmText,
  text,
  title,
  className,
  showConfirmButton,
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
        {showConfirmButton && (
          <DialogButton variant="contained" color="primary" onClick={handleConfirm}>
            {confirmText}
          </DialogButton>
        )}
      </ButtonsContainer>
    </GenericDialog>
  );
}

DeleteOrganizationDialog.propTypes = {
  onClose: func.isRequired,
  open: bool.isRequired,
  cancelText: string.isRequired,
  confirmText: string.isRequired,
  text: oneOfType([string, object]).isRequired,
  title: string.isRequired,
  className: string,
  showConfirmButton: bool,
};

DeleteOrganizationDialog.defaultProps = {
  className: "",
  showConfirmButton: true,
};

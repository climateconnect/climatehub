import React from "react";
import GenericDialog from "./GenericDialog";
import { styled } from "@mui/material/styles";

const Widget = styled("iframe")({
  height: "100%",
  width: "100%",
});

export default function DonationWigetDialog({ onClose, open, title }) {
  const handleClose = () => {
    onClose();
  };

  return (
    <GenericDialog open={open} title={title} onClose={handleClose} fullScreen maxWidth="lg">
      <Widget src="https://spenden.twingle.de/climate-connect-gug-haftungsbeschrankt/climate-connect/tw5ee1f393e9a58/widget" />
    </GenericDialog>
  );
}

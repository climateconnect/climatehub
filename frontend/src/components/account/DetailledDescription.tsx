import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import MessageContent from "../communication/MessageContent";

const Headline = styled(Typography)(({ theme }) => ({
  fontSize: 23,
  fontWeight: "bold",
  marginBottom: theme.spacing(2),
  color: theme.palette.background.default_contrastText,
}));

export default function DetailledDescription({ title, value, className }) {
  return (
    <div className={className}>
      <Headline variant="h2">{title}</Headline>
      <MessageContent content={value} />
    </div>
  );
}

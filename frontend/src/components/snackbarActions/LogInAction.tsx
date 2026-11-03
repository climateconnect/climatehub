import { Button, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import React, { useContext } from "react";
import { redirect, getRedirectUrl } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const SignUpButton = styled(Button)({
  background: "white",
});

export default function LogInAction({ onClose }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });
  const urlParams = new URLSearchParams(window.location.search);
  const hub = urlParams.get("hub");

  const onClickSignUp = () => {
    const redirectUrl = getRedirectUrl(locale);
    redirect("/signin", { redirect: redirectUrl, hub: hub });
  };

  return (
    <>
      <SignUpButton color="grey" variant="contained" onClick={onClickSignUp}>
        {texts.log_in}
      </SignUpButton>
      <IconButton aria-label="close" color="inherit" onClick={onClose} size="large">
        <CloseIcon fontSize="small" />
      </IconButton>
    </>
  );
}

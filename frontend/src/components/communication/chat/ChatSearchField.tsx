import React, { useContext } from "react";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../../../src/components/context/UserContext";
import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import ApplyFilterSearchBar from "../../search/ApplyFilterSearchBar";

const ButtonBar = styled("div")({
  marginTop: 20,
  marginBottom: 10,
  position: "relative",
  height: 40,
});

const CancelButton = styled(Button)({
  position: "absolute",
  right: 0,
});

export default function ChatSearchField({ cancelChatSearch, applyFilterToChats }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });

  return (
    <>
      <ApplyFilterSearchBar
        applyFilterToChats={applyFilterToChats}
        label={texts.enter_chat_name_to_open}
        freeSolo
        helperText={texts.type_the_name_of_a_user_or_group_to_open_a_chat_with}
      />

      <ButtonBar>
        <CancelButton variant="contained" onClick={cancelChatSearch}>
          {texts.cancel}
        </CancelButton>
      </ButtonBar>
    </>
  );
}

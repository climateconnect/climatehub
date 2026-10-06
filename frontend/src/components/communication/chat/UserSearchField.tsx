import React, { useContext, useState } from "react";
import { styled } from "@mui/material/styles";
import AutoCompleteSearchBar from "../../../../src/components/search/AutoCompleteSearchBar";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../../../src/components/context/UserContext";
import { TextField, Button, IconButton } from "@mui/material";
import { apiRequest } from "../../../../public/lib/apiOperations";
import MiniProfilePreview from "../../profile/MiniProfilePreview";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Cookies from "universal-cookie";
import { useRouter } from "next/router";

const ButtonBar = styled("div")(({ theme }) => ({
  marginTop: 20,
  marginBottom: theme.spacing(2),
  position: "relative",
  height: 40,
}));

const CancelButton = styled(Button)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  position: "absolute",
  right: 0,
}));

const StyledMiniProfilePreview = styled(MiniProfilePreview)(({ theme }) => ({
  padding: theme.spacing(2),
  display: "inline-flex",
}));

const GroupChatName = styled(TextField)(({ theme }) => ({
  marginTop: 5,
  marginLeft: theme.spacing(2),
  width: 250,
}));

export default function UserSearchField({ cancelUserSearch, setErrorMessage }) {
  const token = new Cookies().get("auth_token");
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({ page: "chat", locale: locale });
  const [newChatMembers, setNewChatMembers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState("");
  const router = useRouter();
  const hubUrl = typeof router.query.hub === "string" ? router.query.hub : null;

  const handleAddNewChatMember = (member) => {
    setNewChatMembers([...newChatMembers, member]);
  };

  const handleGroupNameChange = (e) => {
    setGroupName(e.target.value);
  };
  const getUsersToFilterOut = () => [user, ...newChatMembers];

  const renderSearchOption = ({ key, ...props }, option) => {
    return (
      <li key={key} {...props}>
        <IconButton size="large">
          <AddCircleOutlineIcon />
        </IconButton>
        {option.first_name + " " + option.last_name}
      </li>
    );
  };
  const handleRemoveMember = (member) => {
    setNewChatMembers([...newChatMembers.filter((m) => m.id !== member.id)]);
  };

  const handleStartChat = (e) => {
    e.preventDefault();
    const isGroupchat = newChatMembers.length > 1;
    const urlPostfix = isGroupchat ? "/api/start_group_chat/" : "/api/start_private_chat/";
    if (newChatMembers.length >= 1) {
      const payload: any = {};
      if (isGroupchat) {
        // lines 77 - 83 don't run because TextField for entering Group chat name has prop required set
        if (!groupName) {
          setErrorMessage(
            texts.please_set_a_group_name_if_youre_starting_a_chat_with_more_than_one_member
          );
          return;
        }
        payload.participants = newChatMembers.map((m) => m.id);
        payload.group_chat_name = groupName;
      } else {
        payload.profile_url_slug = newChatMembers[0].url_slug;
      }

      console.log(payload);
      apiRequest({
        method: "post",
        url: urlPostfix,
        payload: payload,
        token: token,
        locale: locale,
      })
        .then(async function (response) {
          console.log(response);
          const queryString = hubUrl ? `?hub=${encodeURIComponent(hubUrl)}` : "";
          router.push("/chat/" + response.data.chat_uuid + "/" + queryString);
        })
        .catch(function (error) {
          console.log(error.response.data.message);
          // TODO: Show error message that user cant connect
        });
    } else
      setErrorMessage(
        texts.please_add_one_or_more_users_to_chat_to_by_searching_them_in_the_search_bar_above
      );
  };
  return (
    <>
      <AutoCompleteSearchBar
        label={
          newChatMembers.length < 1
            ? texts.search_user_to_message + "..."
            : texts.add_more_chat_participants + "..."
        }
        baseUrl={process.env.API_URL + "/api/members/?search="}
        clearOnSelect
        freeSolo
        filterOut={getUsersToFilterOut()}
        onSelect={handleAddNewChatMember}
        renderOption={renderSearchOption}
        getOptionLabel={(option) => option.first_name + " " + option.last_name}
        helperText={
          <>
            {texts.type_the_name_of_the_users_you_want_to_message}
            <br />
            {texts.group_chat_creation_possible}
          </>
        }
      />
      <form onSubmit={handleStartChat}>
        {newChatMembers.length > 1 && (
          <GroupChatName
            label={texts.group_chat_name}
            size="small"
            required
            onChange={handleGroupNameChange}
            value={groupName}
          />
        )}
        <div /*TODO(undefined) className={classes.newChatParticipantsContainer} */>
          {newChatMembers.map((m) => (
            <StyledMiniProfilePreview key={m.url_slug} profile={m} onDelete={handleRemoveMember} />
          ))}
        </div>
        <ButtonBar>
          <Button variant="contained" color="primary" type="submit">
            {texts.start_chat}
          </Button>
          <CancelButton variant="contained" onClick={cancelUserSearch}>
            {texts.cancel}
          </CancelButton>
        </ButtonBar>
      </form>
    </>
  );
}

import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import { Mention, MentionsInput } from "react-mentions";
import { apiRequest } from "../../../public/lib/apiOperations";
import MiniProfilePreview from "../profile/MiniProfilePreview";
import UserContext from "../context/UserContext";

const useStyles = makeStyles((theme) => ({
  InputWithMentionsBox: {
    fontSize: 16,
    width: "100%",
    borderBottom: `1px solid rgba(0, 0, 0, 0.87)`,
    marginLeft: theme.spacing(3),
    overflow: "visible",
    "&:hover": {
      borderBottom: "2px solid black",
      marginBottom: -1,
    },
    "&:focus-within": {
      borderBottom: `2px solid ${theme.palette.primary.main}`,
      marginBottom: -1,
    },
  },
  mention: {
    zIndex: 100,
  },
  messageInput: {
    flexGrow: 1,
    display: "block",
    paddingTop: 3,

    paddingBottom: 7,
    "& textarea": {
      border: 0,
      overflow: "auto",
      outline: "none",
      fontSize: 16,
    },
    "& li": {
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      "&:hover": {
        background: theme.palette.grey[50],
      },
    },
  },
}));

type MentionSuggestion = {
  first_name: string;
  last_name: string;
  thumbnail_image?: string | null;
  location?: string | null;
};

export const renderMentionSuggestion = (suggestion: MentionSuggestion) => (
  <MiniProfilePreview profile={suggestion} nolink size="medium" title={suggestion.location} />
);

export default function InputWithMentions({ baseUrl, value, onChange, placeholder, onKeyDown }) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);

  //TODO: This function might have to be throttled in the future
  function lookupUsers(searchValue, callback) {
    if (!searchValue) return;
    apiRequest({
      method: "get",
      url: (baseUrl + searchValue).replace(process.env.API_URL, ""),
      locale: locale,
    })
      .then((response) => {
        return response.data.results.map((user) => ({
          display: user.first_name + " " + user.last_name,
          id: user.url_slug,
          first_name: user.first_name,
          last_name: user.last_name,
          thumbnail_image: user.thumbnail_image,
          location: user.location,
        }));
      })
      .then(callback)
      .catch(console.error);
  }

  return (
    <>
      <div className={classes.InputWithMentionsBox}>
        <MentionsInput
          value={value}
          className={classes.messageInput}
          onChange={onChange}
          placeholder={placeholder}
          a11ySuggestionsListLabel={"Suggested users for mention"}
          allowSpaceInQuery
          onKeyDown={onKeyDown}
        >
          <Mention
            className={classes.mention}
            displayTransform={(login) => `@${login}`}
            trigger="@"
            markup={`@@@____id__^^____display__@@@^^^`}
            data={lookupUsers}
            renderSuggestion={renderMentionSuggestion}
            /*TODO(unused) allowSpaceInQuery */
          />
        </MentionsInput>
      </div>
    </>
  );
}

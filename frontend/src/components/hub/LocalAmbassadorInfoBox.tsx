import { Avatar, Button, Typography } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { redirect } from "../../../public/lib/apiOperations";
import React, { useContext } from "react";
import { THUMBNAIL_SOURCES, resolveVariantUrl } from "../general/ResponsiveImage";
import { startPrivateChat } from "../../../public/lib/messagingOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import Cookies from "universal-cookie";
import { useRouter } from "next/router";

const useStyles = makeStyles((theme) => ({
  root: {
    background: "white",
    width: 320,
    marginLeft: "auto",
  },
  upperSection: {
    padding: theme.spacing(2),
    background: theme.palette.grey.light,
  },
  lowerSection: {
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
  },
  headline: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  avatar: {
    marginRight: theme.spacing(2),
    width: 65,
    height: 65,
  },
  name: {
    fontWeight: 700,
  },
  button: {
    marginTop: theme.spacing(1),
    borderColor: theme.palette?.background?.default_contrastText,
    "&:hover": {
      borderColor: theme.palette?.background?.default_contrastText,
    },
  },
  secondaryTextColor: {
    color: theme.palette?.background?.default_contrastText,
  },
}));

export default function LocalAmbassadorInfoBox({ hubAmbassador, hubData, hubSupportersExists }) {
  const classes = useStyles();
  const { locale, user } = useContext(UserContext);
  const cookies = new Cookies();
  const token = cookies.get("auth_token");
  const texts = getTexts({
    page: "hub",
    locale: locale,
    hubAmbassador: hubAmbassador,
    hubName: hubData.name,
  });
  const router = useRouter();
  const handleClickContact = async (e) => {
    e.preventDefault();

    if (!user) {
      return redirect("/signup", {
        errorMessage: texts.please_create_an_account_or_log_in_to_contact_the_ambassador,
      });
    }

    const chat = await startPrivateChat(hubAmbassador?.user, token, locale);
    router.push("/chat/" + chat.chat_uuid + "/");
  };

  const parseTextWithCustomVariables = (m) => {
    return m.replaceAll("${ambassador.first_name}", hubAmbassador?.user?.first_name);
  };

  function getAmbassadorBoxText() {
    if (hubAmbassador?.custom_ambassador_box_text) {
      return parseTextWithCustomVariables(hubAmbassador.custom_ambassador_box_text);
    } else {
      return texts.local_ambassador_is_there_for_you;
    }
  }
  //allow for custom variables
  const ambassadorBoxText = getAmbassadorBoxText();
  return (
    <div className={classes.root}>
      {!hubSupportersExists && (
        <div className={classes.upperSection}>
          <Typography
            color="primary"
            className={`${classes.headline} ${classes.secondaryTextColor}`}
          >
            {texts.do_you_need_support}
          </Typography>
          <Typography>{ambassadorBoxText}</Typography>
        </div>
      )}
      <div className={classes.lowerSection}>
        <Avatar
          className={classes.avatar}
          src={resolveVariantUrl(
            hubAmbassador?.user?.image_variants,
            THUMBNAIL_SOURCES,
            hubAmbassador?.user?.thumbnail_image
          )}
        />
        <div>
          <Typography className={classes.name}>
            {hubAmbassador?.user?.first_name} {hubAmbassador?.user?.last_name}
          </Typography>
          <Typography>{hubAmbassador?.title}</Typography>
          <Button
            variant="outlined"
            className={`${classes.button} ${classes.secondaryTextColor}`}
            onClick={handleClickContact}
          >
            {texts.send_message}
          </Button>
        </div>
      </div>
    </div>
  );
}

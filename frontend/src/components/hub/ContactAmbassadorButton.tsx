import { Avatar, Button } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import { redirect } from "../../../public/lib/apiOperations";
import { appHref } from "../../../public/lib/appLink";
import { HubContext } from "../context/HubContext";
import { startPrivateChat } from "../../../public/lib/messagingOperations";
import { useRouter } from "next/router";
import UserContext from "../context/UserContext";
import getTexts from "../../../public/texts/texts";
import Cookies from "universal-cookie";
import ContactCreatorButtonInfo from "../communication/contactcreator/ContactCreatorButtonInfo";
import { getImageUrl } from "../../../public/lib/imageOperations";
import SendIcon from "@mui/icons-material/Send";
import theme from "../../themes/theme";

const useStyles = makeStyles(() => ({
  root: {
    zIndex: 10,
    position: "fixed",
    bottom: 0,
    right: "1%",
    display: "flex",
    flexDirection: "column",
    maxWidth: 350,
  },
  mobileButton: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  mobileAvatar: {
    margin: 1,
  },
  ambassadorText: {
    padding: theme.spacing(1, 2),
  },
}));

export default function ContactAmbassadorButton({
  hubAmbassador,
  mobile,
}: {
  hubAmbassador: any;
  mobile: boolean;
}) {
  const classes = useStyles();
  const { locale, user } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);
  const cookies = new Cookies();
  const token = cookies.get("auth_token");
  const texts = getTexts({ page: "hub", hubAmbassador: hubAmbassador, locale: locale });
  const router = useRouter();
  const handleClickContact = async (e) => {
    e.preventDefault();

    if (!user) {
      const queryString: any = {
        errorMessage: texts.please_create_an_account_or_log_in_to_contact_the_ambassador,
      };
      return redirect("/signup", queryString);
    }

    const chat = await startPrivateChat(hubAmbassador?.user, token, locale);
    router.push(appHref("/chat/" + chat.chat_uuid, { hubUrl, locale }));
  };
  if (mobile) {
    return (
      <>
        {hubAmbassador && (
          <Button
            className={classes.mobileButton}
            variant="contained"
            color="primary"
            onClick={handleClickContact}
            size="small"
          >
            <Avatar
              className={classes.mobileAvatar}
              src={getImageUrl(hubAmbassador?.user?.thumbnail_image)}
            />
            {texts.contact_ambassador}
            <SendIcon />
          </Button>
        )}
      </>
    );
  }
  return (
    <>
      {hubAmbassador && (
        <div className={classes.root} onClick={handleClickContact}>
          <ContactCreatorButtonInfo
            creatorName={`${hubAmbassador?.user?.first_name} ${hubAmbassador?.user?.last_name}`}
            creatorImageURL={getImageUrl(hubAmbassador?.user?.thumbnail_image)}
            customMessage={hubAmbassador.custom_message}
          />
          <Button variant="contained" color="primary" className={classes.ambassadorText}>
            {texts.contact_ambassador}
          </Button>
        </div>
      )}
    </>
  );
}

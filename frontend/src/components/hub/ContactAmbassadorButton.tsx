import { Avatar, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
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

// Spacing intentionally comes from the static app theme import, as in the original makeStyles.
const Root = styled("div")({
  zIndex: 10,
  position: "fixed",
  bottom: 0,
  right: "1%",
  display: "flex",
  flexDirection: "column",
  maxWidth: 350,
});

const MobileButton = styled(Button)({
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
});

const MobileAvatar = styled(Avatar)({
  margin: 1,
});

const AmbassadorText = styled(Button)({
  padding: theme.spacing(1, 2),
});

export default function ContactAmbassadorButton({
  hubAmbassador,
  mobile,
}: {
  hubAmbassador: any;
  mobile: boolean;
}) {
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
          <MobileButton
            variant="contained"
            color="primary"
            onClick={handleClickContact}
            size="small"
          >
            <MobileAvatar src={getImageUrl(hubAmbassador?.user?.thumbnail_image)} />
            {texts.contact_ambassador}
            <SendIcon />
          </MobileButton>
        )}
      </>
    );
  }
  return (
    <>
      {hubAmbassador && (
        <Root onClick={handleClickContact}>
          <ContactCreatorButtonInfo
            creatorName={`${hubAmbassador?.user?.first_name} ${hubAmbassador?.user?.last_name}`}
            creatorImageURL={getImageUrl(hubAmbassador?.user?.thumbnail_image)}
            customMessage={hubAmbassador.custom_message}
          />
          <AmbassadorText variant="contained" color="primary">
            {texts.contact_ambassador}
          </AmbassadorText>
        </Root>
      )}
    </>
  );
}

import { Avatar, Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { redirect } from "../../../public/lib/apiOperations";
import React, { useContext } from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { startPrivateChat } from "../../../public/lib/messagingOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import Cookies from "universal-cookie";
import { useRouter } from "next/router";

const Root = styled("div")({
  background: "white",
  width: 320,
  marginLeft: "auto",
});

const UpperSection = styled("div")(({ theme }) => ({
  padding: theme.spacing(2),
  background: theme.palette.grey.light,
}));

const LowerSection = styled("div")(({ theme }) => ({
  padding: theme.spacing(2),
  display: "flex",
  alignItems: "center",
}));

// headline + secondaryTextColor: the color rule came last in the original, so it wins
const Headline = styled(Typography)(({ theme }) => ({
  fontSize: 20,
  fontWeight: 600,
  marginBottom: theme.spacing(1),
  color: theme.palette?.background?.default_contrastText,
}));

const AmbassadorAvatar = styled(Avatar)(({ theme }) => ({
  marginRight: theme.spacing(2),
  width: 65,
  height: 65,
}));

const Name = styled(Typography)({
  fontWeight: 700,
});

const ContactButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1),
  borderColor: theme.palette?.background?.default_contrastText,
  "&:hover": {
    borderColor: theme.palette?.background?.default_contrastText,
  },
  color: theme.palette?.background?.default_contrastText,
}));

export default function LocalAmbassadorInfoBox({ hubAmbassador, hubData, hubSupportersExists }) {
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
    <Root>
      {!hubSupportersExists && (
        <UpperSection>
          <Headline color="primary">{texts.do_you_need_support}</Headline>
          <Typography>{ambassadorBoxText}</Typography>
        </UpperSection>
      )}
      <LowerSection>
        <AmbassadorAvatar src={getImageUrl(hubAmbassador?.user?.thumbnail_image)} />
        <div>
          <Name>
            {hubAmbassador?.user?.first_name} {hubAmbassador?.user?.last_name}
          </Name>
          <Typography>{hubAmbassador?.title}</Typography>
          <ContactButton variant="outlined" onClick={handleClickContact}>
            {texts.send_message}
          </ContactButton>
        </div>
      </LowerSection>
    </Root>
  );
}

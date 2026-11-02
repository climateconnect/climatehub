import { Button, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import React, { MouseEventHandler, useContext } from "react";

import ButtonIcon from "../../general/ButtonIcon";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";

const LargeScreenButtonContainer = styled("span")({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  marginRight: "3px",
});

const LargeJoinButton = styled(Button)({
  height: 40,
  maxWidth: 140,
});

const MediumScreenIconButton = styled(IconButton)({
  height: 40,
});

const MobileButtonContainer = styled("span")({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  cursor: "pointer",
  height: 40,
});

const MobileIconButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(1),
  "&:hover": {
    background: "none",
  },
}));

const ButtonLabel = styled("div")({
  position: "relative",
});

type Props = {
  hasAdminPermissions?: Boolean;
  screenSize?: any;
  handleSendProjectJoinRequest: MouseEventHandler<HTMLButtonElement>;
  requestedToJoin: boolean;
  className?: string;
};

export default function JoinButton({
  hasAdminPermissions,
  screenSize,
  handleSendProjectJoinRequest,
  requestedToJoin,
  className,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ locale: locale, page: "project" });

  if (screenSize?.belowSmall) {
    return (
      <MobileButtonContainer className={className} onClick={handleSendProjectJoinRequest}>
        <MobileIconButton disabled={requestedToJoin} size="large">
          <ButtonIcon icon="add" size={40} color={"primary"} />
        </MobileIconButton>
      </MobileButtonContainer>
    );
  }

  if (screenSize?.belowMedium && !screenSize.belowSmall && !hasAdminPermissions) {
    return (
      <LargeScreenButtonContainer className={className}>
        <MediumScreenIconButton
          disabled={requestedToJoin}
          onClick={handleSendProjectJoinRequest}
          size="large"
        >
          <ButtonIcon icon="add" size={40} color={"primary"} />
        </MediumScreenIconButton>
      </LargeScreenButtonContainer>
    );
  }

  return (
    <LargeScreenButtonContainer className={className}>
      <LargeJoinButton
        color={"primary"}
        disabled={requestedToJoin === true}
        onClick={handleSendProjectJoinRequest}
        startIcon={!requestedToJoin && <AddIcon />}
        variant="contained"
      >
        <ButtonLabel>
          <div>{requestedToJoin ? texts.requested : texts.join}</div>
        </ButtonLabel>
      </LargeJoinButton>
    </LargeScreenButtonContainer>
  );
}

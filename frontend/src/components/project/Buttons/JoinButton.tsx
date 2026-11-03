import { Button, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import React, { useContext, useState } from "react";

import ButtonIcon from "../../general/ButtonIcon";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import { useFeatureToggles } from "../../featureToggle";
import JoinRequestDialog from "../JoinRequestDialog";

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
  // With a message the request is sent from the confirmation dialog; resolves to true if the
  // dialog should close. Without arguments it sends the legacy default message.
  handleSendProjectJoinRequest: (_message?: string) => Promise<boolean | void> | void;
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
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ locale: locale, page: "project" });
  const { isEnabled, isLoading: togglesLoading } = useFeatureToggles();
  const useConfirmation = !!user && isEnabled("PROJECT_JOIN_REQUEST_CONFIRMATION", false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClick = () => {
    // Don't fall back to the legacy immediate send before the toggles are known.
    if (requestedToJoin || (user && togglesLoading)) return;
    if (useConfirmation) {
      setDialogOpen(true);
    } else {
      handleSendProjectJoinRequest();
    }
  };

  const dialog = useConfirmation ? (
    <JoinRequestDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSend={async (message) => (await handleSendProjectJoinRequest(message)) !== false}
    />
  ) : null;

  return (
    <>
      {renderButton()}
      {dialog}
    </>
  );

  function renderButton() {
    if (screenSize?.belowSmall) {
      return (
        <MobileButtonContainer className={className} onClick={handleClick}>
          <MobileIconButton disabled={requestedToJoin} size="large">
            <ButtonIcon icon="add" size={40} color={"primary"} />
          </MobileIconButton>
        </MobileButtonContainer>
      );
    }

    if (screenSize?.belowMedium && !screenSize.belowSmall && !hasAdminPermissions) {
      return (
        <LargeScreenButtonContainer className={className}>
          <MediumScreenIconButton disabled={requestedToJoin} onClick={handleClick} size="large">
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
          onClick={handleClick}
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
}

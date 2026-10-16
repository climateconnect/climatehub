import { Button, IconButton } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { Theme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import React, { useContext, useState } from "react";

import ButtonIcon from "../../general/ButtonIcon";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import { useFeatureToggles } from "../../featureToggle";
import JoinRequestDialog from "../JoinRequestDialog";

const useStyles = makeStyles((theme: Theme) => ({
  largeScreenButtonContainer: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    marginRight: "3px",
  },

  largeJoinButton: {
    height: 40,
    maxWidth: 140,
  },

  mediumScreenIconButton: {
    height: 40,
  },
  mobileButtonContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    cursor: "pointer",
    height: 40,
  },
  iconButton: {
    padding: theme.spacing(1),
    "&:hover": {
      background: "none",
    },
  },
  fabProgress: {
    color: "white",
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: "auto",
    marginBottom: "auto",
  },
  buttonLabel: {
    position: "relative",
  },
  hidden: {
    visibility: "hidden",
  },
}));

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
  const classes = useStyles();

  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ locale: locale, page: "project" });
  const { isEnabled } = useFeatureToggles();
  const useConfirmation = !!user && isEnabled("PROJECT_JOIN_REQUEST_CONFIRMATION", false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClick = () => {
    if (requestedToJoin) return;
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
        <span className={`${className} ${classes.mobileButtonContainer}`} onClick={handleClick}>
          <IconButton className={classes.iconButton} disabled={requestedToJoin} size="large">
            <ButtonIcon icon="add" size={40} color={"primary"} />
          </IconButton>
        </span>
      );
    }

    if (screenSize?.belowMedium && !screenSize.belowSmall && !hasAdminPermissions) {
      return (
        <span className={`${className} ${classes.largeScreenButtonContainer}`}>
          <IconButton
            className={classes.mediumScreenIconButton}
            disabled={requestedToJoin}
            onClick={handleClick}
            size="large"
          >
            <ButtonIcon icon="add" size={40} color={"primary"} />
          </IconButton>
        </span>
      );
    }

    return (
      <span className={`${className} ${classes.largeScreenButtonContainer}`}>
        <Button
          className={classes.largeJoinButton}
          color={"primary"}
          disabled={requestedToJoin === true}
          onClick={handleClick}
          startIcon={!requestedToJoin && <AddIcon />}
          variant="contained"
        >
          <div className={classes.buttonLabel}>
            <div>{requestedToJoin ? texts.requested : texts.join}</div>
          </div>
        </Button>
      </span>
    );
  }
}

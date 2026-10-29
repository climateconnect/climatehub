import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import GenericDialog from "../../dialogs/GenericDialog";
import DonorBadgeExplainerList from "./DonorBadgeExplainerList";

const DialogRoot = styled("div")({
  maxWidth: 500,
});

const ExplainerText = styled(Typography)({
  fontSize: 16,
});

const CallToActionText = styled(Typography)(({ theme }) => ({
  textAlign: "center",
  fontSize: 20,
  fontWeight: 600,
  color: theme.palette.primary.main,
}));

const DonateButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));

export default function DonorForestExplainerDialog({ onClose, open, possibleBadges }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "donate", locale: locale });
  return (
    <GenericDialog onClose={onClose} open={open} title={texts.forest_explainer_dialog_title}>
      <DialogRoot>
        <ExplainerText>{texts.donor_forest_dialog_explainer_text}</ExplainerText>
        <DonorBadgeExplainerList possibleBadges={possibleBadges} />
        <CallToActionText>{texts.donor_forest_dialog_call_to_action_text}</CallToActionText>
        <DonateButtonContainer>
          <Button href={`${getLocalePrefix(locale)}/donate`} color="primary" variant="contained">
            {texts.donate}
          </Button>
        </DonateButtonContainer>
      </DialogRoot>
    </GenericDialog>
  );
}

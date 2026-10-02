import { Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useState } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import DonorForestExplainerDialog from "./DonorForestExplainerDialog";

const ExplainerContainer = styled("div")(({ theme }) => ({
  background: theme.palette.primary.extraLight,
  padding: theme.spacing(3),
  paddingBottom: theme.spacing(2),
  paddingTop: theme.spacing(2),
  borderRadius: 15,
  width: 360,
  textAlign: "center",
  zIndex: 1,
}));

const Headline = styled(Typography)(({ theme }) => ({
  fontSize: 24,
  fontWeight: 700,
  marginBottom: theme.spacing(0.5),
}));

const ExplainerText = styled(Typography)({
  fontWeight: 600,
});

const DonateButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1.5),
  width: 220,
}));

const HowItWorksLink = styled(Typography)(({ theme }) => ({
  textDecoration: "underline",
  fontWeight: 600,
  marginTop: theme.spacing(1.5),
  cursor: "pointer",
}));

export default function DonorForestExplainer({
  className,
  possibleBadges,
}: {
  className?: string;
  possibleBadges: any;
}) {
  const [open, setOpen] = useState(false);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "donate", locale: locale });

  const handleOpenExplainerDialog = (e) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <ExplainerContainer className={className}>
      <Headline color="primary">{texts.forest_explainer_headline}</Headline>
      <ExplainerText>{texts.forest_explainer_text}</ExplainerText>
      <DonateButton variant="contained" color="primary" href={getLocalePrefix(locale) + "/donate"}>
        {texts.donate}
      </DonateButton>
      <HowItWorksLink onClick={handleOpenExplainerDialog}>{texts.how_it_works}</HowItWorksLink>
      <DonorForestExplainerDialog
        open={open}
        onClose={handleClose}
        possibleBadges={possibleBadges}
      />
    </ExplainerContainer>
  );
}

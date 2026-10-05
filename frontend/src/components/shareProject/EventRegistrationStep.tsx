import React, { useContext } from "react";
import { Container, FormControlLabel, Switch, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import NavigationButtons from "../general/NavigationButtons";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";
import { Project } from "../../types";

const Root = styled(Container)(({ theme }) => ({
  maxWidth: 700,
  margin: "0 auto",
  padding: theme.spacing(4),
  paddingTop: theme.spacing(2),
}));

const SwitchRow = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
  display: "flex",
  alignItems: "center",
}));

const HelpText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

type Props = {
  projectData: Project;
  handleSetProjectData: Function;
  goToNextStep: Function;
  goToPreviousStep: Function;
};

export default function EventRegistrationStep({
  projectData,
  handleSetProjectData,
  goToNextStep,
  goToPreviousStep,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });
  const theme = useTheme();
  const backgroundContrastColor = getBackgroundContrastColor(theme);

  const handleToggle = () => {
    const newEnabled = !projectData.registrationEnabled;
    if (!newEnabled) {
      // Clear registration fields when disabled
      handleSetProjectData({
        registrationEnabled: false,
        max_participants: null,
        registration_end_date: null,
      });
    } else {
      handleSetProjectData({ registrationEnabled: true });
    }
  };

  const handleClickNext = () => {
    goToNextStep();
  };

  return (
    <Root maxWidth="md">
      <SwitchRow>
        <FormControlLabel
          control={
            <Switch
              checked={!!projectData.registrationEnabled}
              onChange={handleToggle}
              color={backgroundContrastColor}
              inputProps={{ "aria-label": texts.allow_online_registration }}
            />
          }
          label={texts.allow_online_registration}
        />
      </SwitchRow>
      {projectData.registrationEnabled && (
        <HelpText variant="body2">{texts.registration_enabled_help_text}</HelpText>
      )}
      <NavigationButtons
        onClickPreviousStep={goToPreviousStep as React.MouseEventHandler<HTMLButtonElement>}
        onClickNextStep={handleClickNext as React.MouseEventHandler<HTMLButtonElement>}
        sticky
      />
    </Root>
  );
}

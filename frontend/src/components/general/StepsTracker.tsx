import React from "react";
import { styled, Theme } from "@mui/material/styles";
import {
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  Typography,
  stepConnectorClasses,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";

const ICON_OFFSET = 3; //offset required to center icons horizontally in px.

const GrayBackgroundRoot = styled("div", {
  shouldForwardProp: (prop) => prop !== "$grayBackground",
})<{ $grayBackground?: boolean }>(({ theme, $grayBackground }) =>
  $grayBackground
    ? {
        backgroundColor: "#F7F7F7",
        paddingTop: theme.spacing(10),
        paddingBottom: theme.spacing(6),
      }
    : {}
);

const StyledStepper = styled(Stepper, {
  shouldForwardProp: (prop) => prop !== "$grayBackground",
})<{ $grayBackground?: boolean }>(({ $grayBackground }) => ({
  maxWidth: 1000,
  margin: "0 auto",
  ...($grayBackground && { backgroundColor: "#F7F7F7" }),
}));

const stepTextStyles = (theme: Theme) => ({
  fontSize: 13,
  textTransform: "uppercase" as const,
  color: theme.palette.background.default_contrastText,
});

const StyledStepLabel = styled(StepLabel)(({ theme }) => stepTextStyles(theme));

const StepText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$completed",
})<{ $completed?: boolean }>(({ theme, $completed }) => ({
  ...stepTextStyles(theme),
  ...($completed && { color: "#a4b4b7" }),
}));

const iconBaseStyles = (theme: Theme) => ({
  backgroundColor: theme.palette.background.default_contrastText,
  display: "flex",
  height: 20,
  width: 20,
  borderRadius: 20,
  alignItems: "center",
  marginTop: ICON_OFFSET,
  zIndex: 10,
});

const CompletedIcon = styled(CheckIcon)(({ theme }) => ({
  ...iconBaseStyles(theme),
  backgroundColor: "#D7E2E4",
  height: 40,
  width: 40,
  border: "10px solid #D7E2E4",
  borderRadius: 20,
  marginTop: ICON_OFFSET - 10,
  fontSize: "bold",
}));

const InactiveIcon = styled("div")(({ theme }) => ({
  ...iconBaseStyles(theme),
  marginBottom: 10,
}));

const ActiveRing = styled("div")({
  height: 40,
  width: 40,
  border: "10px solid #D7E2E4",
  borderRadius: 20,
  marginTop: ICON_OFFSET - 10,
  marginLeft: -10,
  position: "absolute",
});

const CustomConnector = styled(StepConnector)(({ theme }) => ({
  left: "calc(-50%)",
  right: "calc(50%)",
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.background.default_contrastText,
    borderRadius: 1,
    margin: 0,
    zIndex: 9,
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundColor: "#bbced2",
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundColor: "#bbced2",
  },
}));

const CustomStepIcon = (props) => {
  const { active, completed } = props;
  if (completed) return <CompletedIcon />;
  else if (active)
    return (
      <>
        <InactiveIcon />
        <ActiveRing />
      </>
    );
  else return <InactiveIcon />;
};

export default function StepsTracker({
  steps,
  activeStep,
  grayBackground,
  onlyDisplayActiveStep,
}: any) {
  const activeStepIndex = steps.indexOf(steps.find((step) => step.key === activeStep));
  return (
    <GrayBackgroundRoot $grayBackground={!!grayBackground}>
      <StyledStepper
        activeStep={activeStepIndex}
        alternativeLabel
        connector={<CustomConnector />}
        $grayBackground={!!grayBackground}
      >
        {steps.map((step, index) => (
          <Step /*TODO(unused) className={classes.step}*/ key={index}>
            <StyledStepLabel StepIconComponent={CustomStepIcon}>
              <StepText $completed={index < activeStepIndex}>
                {(!onlyDisplayActiveStep || index === activeStepIndex) && step.text}
              </StepText>
            </StyledStepLabel>
          </Step>
        ))}
      </StyledStepper>
    </GrayBackgroundRoot>
  );
}

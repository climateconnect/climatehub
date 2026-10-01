import React from "react";
import makeStyles from "@mui/styles/makeStyles";
import { styled } from "@mui/material/styles";
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

const useStyles = makeStyles((theme) => {
  return {
    stepper: {
      maxWidth: 1000,
      margin: "0 auto",
    },
    grayBackgroundRoot: {
      backgroundColor: "#F7F7F7",
      paddingTop: theme.spacing(10),
      paddingBottom: theme.spacing(6),
    },
    grayBackground: {
      backgroundColor: "#F7F7F7",
    },
    customIcon: {
      backgroundColor: theme.palette.background.default_contrastText,
      display: "flex",
      height: 20,
      width: 20,
      borderRadius: 20,
      alignItems: "center",
      marginTop: ICON_OFFSET,
      zIndex: 10,
    },
    customIconMarginBottom: {
      marginBottom: 10,
    },
    stepText: {
      fontSize: 13,
      textTransform: "uppercase",
      color: theme.palette.background.default_contrastText,
    },
    active: {
      height: 40,
      width: 40,
      border: "10px solid #D7E2E4",
      borderRadius: 20,
      marginTop: ICON_OFFSET - 10,
      marginLeft: -10,
      position: "absolute",
    },
    completed: {
      backgroundColor: "#D7E2E4",
      height: 40,
      width: 40,
      border: "10px solid #D7E2E4",
      borderRadius: 20,
      marginTop: ICON_OFFSET - 10,
      fontSize: "bold",
    },
    completedText: {
      color: "#a4b4b7",
    },
    /*topDivActive: {
      content: '""',
      position: "absolute",
      top: -20,
      display: "block",
      margin: "0 auto",
      height: 40,
      width: 40,
      backgroundColor: "#D7E2E4",
      borderRadius: 20,
      fontSize: 100
    },
    progressTrack: {
      position: "absolute",
      top: 0,
      height: 2,
      width: "100%",
      background: theme.palette.primary.main,
      zIndex: 10
    }*/
  };
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
  const classes = useStyles();
  const { active, completed } = props;
  if (completed) return <CheckIcon className={`${classes.customIcon} ${classes.completed}`} />;
  else if (active)
    return (
      <>
        <div className={`${classes.customIcon} ${classes.customIconMarginBottom}`} />
        <div className={classes.active} />
      </>
    );
  else return <div className={`${classes.customIcon} ${classes.customIconMarginBottom}`} />;
};

export default function StepsTracker({
  steps,
  activeStep,
  grayBackground,
  onlyDisplayActiveStep,
}: any) {
  const classes = useStyles();
  const activeStepIndex = steps.indexOf(steps.find((step) => step.key === activeStep));
  return (
    <div className={`${grayBackground && classes.grayBackgroundRoot}`}>
      <Stepper
        activeStep={activeStepIndex}
        alternativeLabel
        connector={<CustomConnector />}
        className={`${classes.stepper} ${grayBackground && classes.grayBackground}`}
      >
        {steps.map((step, index) => (
          <Step /*TODO(unused) className={classes.step}*/ key={index}>
            <StepLabel StepIconComponent={CustomStepIcon} className={classes.stepText}>
              <Typography
                className={`${classes.stepText} ${
                  index < activeStepIndex && classes.completedText
                }`}
              >
                {(!onlyDisplayActiveStep || index === activeStepIndex) && step.text}
              </Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </div>
  );
}

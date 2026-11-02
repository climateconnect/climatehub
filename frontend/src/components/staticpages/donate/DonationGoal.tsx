import { Container, LinearProgress } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

const Root = styled("div", {
  shouldForwardProp: (prop) => prop !== "$embedded" && prop !== "$barOnly",
})<{ $embedded?: boolean; $barOnly?: boolean }>(({ theme, $embedded, $barOnly }) => ({
  paddingTop: $embedded || $barOnly ? 0 : theme.spacing(1),
  paddingBottom: $embedded || $barOnly ? 0 : theme.spacing(1.5),
  background: $embedded ? "transparent" : "#DFDFDF",
  position: $embedded ? undefined : "absolute",
  top: -90,
  zIndex: 3,
  left: 0,
  width: "100%",
  height: $embedded ? "auto" : 95,
  [theme.breakpoints.down("md")]: {
    position: $embedded ? undefined : "fixed",
    top: "auto",
    bottom: 42,
  },
}));

const GoalContainer = styled(Container)({
  position: "relative",
  paddingLeft: 0,
  paddingRight: 0,
});

const Progress = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== "$small" && prop !== "$isInWidget" && prop !== "$barColor",
})<{ $small?: boolean; $isInWidget?: boolean; $barColor?: string }>(
  ({ theme, $small, $isInWidget, $barColor }) => ({
    height: $small || $isInWidget ? 15 : 25,
    borderRadius: 15,
    backgroundColor: theme.palette.grey[theme.palette.mode === "light" ? 200 : 700],
    "& .MuiLinearProgress-bar": {
      borderRadius: 5,
      backgroundColor: $barColor ? $barColor : theme.palette.primary.main,
    },
  })
);

const BarText = styled("div")(({ theme }) => ({
  position: "absolute",
  top: "50%",
  transform: "translate(0, -50%)", // Center the text
  zIndex: 1000,
  color: theme.palette.primary.main,
  fontWeight: "bold",
  fontSize: 20,
}));

export default function DonationGoal({
  className,
  current,
  goal,
  embedded,
  barColor,
  barOnly,
  small,
  isInWidget,
}: any) {
  //const atTopOfPage = TopOfPage({ initTopOfPage: true, marginToTrigger: 95 });
  const textMarginLeft =
    current / goal < 0.9 ? `${(current / goal) * 100 + 1}%` : `${(current / goal) * 100 - 25}%`;
  return (
    <Root className={className} $embedded={embedded} $barOnly={barOnly}>
      <GoalContainer disableGutters>
        <Progress
          variant="determinate"
          value={current / goal < 100 ? (current / goal) * 100 : 100}
          $small={small}
          $isInWidget={isInWidget}
          $barColor={barColor}
        />
        <BarText style={{ left: textMarginLeft }}>
          {current}/{goal}
        </BarText>
      </GoalContainer>
    </Root>
  );
}

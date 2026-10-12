import { Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useState } from "react";
import BottomOfPage from "../../hooks/BottomOfPage";
import ElementOnScreen from "../../hooks/ElementOnScreen";
import ElementSpaceToTop from "../../hooks/ElementSpaceToTop";
import DonationGoal from "./DonationGoal";

const TwingleFrame = styled("iframe")({
  width: "100%",
  height: "100%",
  border: 0,
});

const TwingleContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$isFixed" && prop !== "$isAtBottom",
})<{ $isFixed?: boolean; $isAtBottom?: boolean }>(({ theme, $isFixed, $isAtBottom }) => ({
  position: "absolute",
  top: 110,
  right: theme.spacing(8),
  width: 400,
  height: 660,
  maxHeight: "95vh",
  [theme.breakpoints.down("lg")]: {
    right: theme.spacing(2),
  },
  zIndex: 2,
  ...($isFixed && {
    position: "fixed",
    bottom: 10,
    top: "auto",
  }),
  ...($isAtBottom && {
    position: "absolute",
    bottom: -20,
    top: "auto",
  }),
}));

export default function FloatingWidget({ goal_name, current_amount, goal_amount }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [isFixed, setIsFixed] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const trigger = ElementOnScreen({ el: el });
  const spaceToTop = ElementSpaceToTop({ /*initTopOfPage: true,*/ el });
  const atBottomOfPage = BottomOfPage({ initBottomOfPage: false, marginToTrigger: 363 });
  if (!isFixed && trigger && spaceToTop.page != null && spaceToTop.page > 215) setIsFixed(true);
  if (isFixed && spaceToTop.page != null && spaceToTop.page < 215) setIsFixed(false);
  if (atBottomOfPage && !isAtBottom) setIsAtBottom(true);
  if (!atBottomOfPage && isAtBottom) setIsAtBottom(false);
  return (
    <Container maxWidth="xl" /*TODO(undefined) className={classes.twingleWrapper}*/>
      <TwingleContainer
        $isFixed={isFixed}
        $isAtBottom={isAtBottom}
        ref={(node) => {
          if (node) {
            setEl(node);
          }
        }}
      >
        {goal_name && (
          <DonationGoal
            name={goal_name}
            current={current_amount}
            goal={goal_amount}
            /*TODO(undefined) className={classes.donationGoal}*/
            isInWidget
          />
        )}
        <TwingleFrame src="https://spenden.twingle.de/climate-connect-gug-haftungsbeschrankt/climate-connect/tw5ee1f393e9a58/widget" />
      </TwingleContainer>
    </Container>
  );
}

import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";
import DonationWigetDialog from "../../dialogs/DonationWigetDialog";
import DonationGoal from "./DonationGoal";

const Root = styled("div")({
  position: "fixed",
  bottom: 0,
  zIndex: 1,
  width: "100vw",
  display: "flex",
});

const DonateButton = styled(Button)(({ theme }) => ({
  width: "100%",
  borderRadius: 0,
  background: theme.palette.primary.light,
}));

export default function ToggleWidgetButton({
  overlayOpen,
  setOverlayOpen,
  goal_name,
  current_amount,
  goal_amount,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "donate", locale: locale });

  const handleDialogClose = () => {
    setOverlayOpen(false);
  };

  const handleClickDialogOpen = () => {
    setOverlayOpen(true);
  };

  return (
    <>
      <Root>
        <DonateButton size="large" variant="contained" onClick={handleClickDialogOpen}>
          {texts.donate_now}
        </DonateButton>
      </Root>
      {goal_name && (
        <DonationGoal
          name={goal_name}
          current={current_amount}
          goal={goal_amount}
          /*TODO(undefined) className={classes.donationGoal} */
        />
      )}
      <DonationWigetDialog open={overlayOpen} title="" onClose={handleDialogClose} />
    </>
  );
}

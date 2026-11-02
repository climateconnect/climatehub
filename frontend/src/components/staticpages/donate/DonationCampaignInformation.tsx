import { Button, IconButton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import React, { useContext, useState } from "react";
import Cookies from "universal-cookie";
import { getCookieProps } from "../../../../public/lib/cookieOperations";
import getTexts from "../../../../public/texts/texts";
import theme from "../../../themes/theme";
import UserContext from "../../context/UserContext";
import DonationGoal from "./DonationGoal";

const Root = styled("div")(({ theme }) => ({
  width: "100%",
  background: theme.palette.primary.main,
  color: "white",
  textAlign: "center",
  padding: theme.spacing(1),
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  position: "relative",
  borderTop: `1px solid ${theme.palette.primary.extraLight}`,
}));

const CallToActionText = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  paddingRight: theme.spacing(4),
  paddingLeft: theme.spacing(4),
  position: "relative",
  display: "inline-block",
  color: "white",
  marginTop: theme.spacing(2),
  fontSize: 20,
  [theme.breakpoints.down("sm")]: {
    fontSize: 15,
  },
}));

const CloseButton = styled(IconButton)({
  position: "absolute",
  right: 0,
  top: 0,
  color: "white",
});

const DonateButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1),
  borderRadius: "4px",
  backgroundColor: "hsla(176.25, 66.67%, 90.59%, 1.00)",
  color: theme.palette.primary.main,
  fontFamily: "'Open Sans', sans-serif",
  fontWeight: 600,
  textDecoration: "none",
  textTransform: "uppercase",
  transition: "opacity 200ms ease",
  "&:hover": {
    backgroundColor: "hsla(176.25, 66.67%, 85%, 1.00)",
    opacity: 0.9,
  },
  [theme.breakpoints.down("sm")]: {
    marginTop: theme.spacing(1),
  },
}));

const TextAndBarContainer = styled("div")({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-around",
  alignItems: "center",
  marginRight: "40px",
  marginLeft: "40px",
});

type Props = {
  hubUrl?: string;
};

//If we want to reuse this, this has to be translated!
export default function DonationCampaignInformation({ hubUrl }: Props) {
  const cookies = new Cookies();
  const [open, setOpen] = useState(!cookies.get("hideDonationCampaign"));
  const { CUSTOM_HUB_URLS, donationGoals, locale } = useContext(UserContext);
  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);
  const texts = getTexts({ page: "donate", locale: locale });
  const donationGoal =
    donationGoals?.find((goal) => goal.hub === hubUrl) || donationGoals?.find((goal) => !goal.hub);

  const handleClose = () => {
    const expiry = daysInFuture(3);
    const cookieProps = getCookieProps(expiry);
    cookies.set("hideDonationCampaign", true, cookieProps);
    setOpen(false);
  };

  if ((isCustomHub && !donationGoal?.hub) || !donationGoal?.goal_amount) return <></>;
  return (
    <>
      {open && (
        <Root>
          <CloseButton onClick={handleClose} size="large">
            <CloseIcon />
          </CloseButton>
          <div>
            <TextAndBarContainer>
              {donationGoal && (
                <DonationGoal
                  current={donationGoal?.current_amount}
                  goal={donationGoal?.goal_amount}
                  name={donationGoal?.goal_name}
                  embedded
                  barColor={theme.palette.yellow.main}
                />
              )}
              <CallToActionText>{donationGoal?.call_to_action_text}</CallToActionText>
              {donationGoal?.call_to_action_link && (
                <DonateButton variant="contained" href={donationGoal.call_to_action_link}>
                  {texts.donate_now}
                </DonateButton>
              )}
            </TextAndBarContainer>
          </div>
        </Root>
      )}
    </>
  );
}

const daysInFuture = (numberOfDays) => {
  const now = new Date();
  return new Date(now.getTime() + numberOfDays * 24 * 60 * 60 * 1000);
};

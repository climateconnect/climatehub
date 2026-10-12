import { styled } from "@mui/material/styles";
import React from "react";
import SmallCloud from "../../staticpages/SmallCloud";
import DonorForestExplainer from "./DonorForestExplainer";

const Root = styled("div")(({ theme }) => ({
  background: theme.palette.primary.main,
  width: "100%",
}));

const Transition = styled("div")(({ theme }) => ({
  height: 100,
  [theme.breakpoints.down("sm")]: {
    height: 40,
  },
}));

const MountainsContainer = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  position: "relative",
  [theme.breakpoints.down("sm")]: {
    justifyContent: "center",
  },
}));

const Mountains = styled("div")(({ theme }) => ({
  background: "url('/images/mountains.svg')",
  flexGrow: 1,
  height: 200,
  minWidth: 100,
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "bottom",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));

const Explainer = styled(DonorForestExplainer)(({ theme }) => ({
  marginBottom: theme.spacing(6),
}));

const SmallCloud1 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  top: -30,
  left: 150,
  width: 45,
  height: 30,
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));

const SmallCloud2 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 350,
  width: 39,
  height: 26,
  [theme.breakpoints.down("md")]: {
    left: 50,
    top: 50,
  },
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));

const SmallCloud3 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  top: 0,
  right: 350,
  width: 39,
  height: 26,
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));

const SmallCloud4 = styled(SmallCloud)({
  position: "absolute",
  top: 0,
  right: 150,
  width: 39,
  height: 26,
});

const Zepellin = styled("img")({
  position: "absolute",
  right: 80,
  top: 50,
  width: 70,
});

export default function DonorForestTransition({ possibleBadges }) {
  return (
    <Root>
      <Transition />
      <MountainsContainer>
        <Mountains />
        <SmallCloud1 show type={1} white />
        <SmallCloud2 reverse show type={2} white />
        <Explainer possibleBadges={possibleBadges} />
        <SmallCloud3 show reverse type={1} white />
        <SmallCloud4 show type={2} white />
        <Zepellin src="/icons/zepellin.svg" alt="zepellin" />
        <Mountains />
      </MountainsContainer>
    </Root>
  );
}

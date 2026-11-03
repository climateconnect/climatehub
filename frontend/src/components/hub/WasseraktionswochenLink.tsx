import React, { useContext } from "react";
import { Link } from "@mui/material";
import { styled } from "@mui/material/styles";
import UserContext from "../context/UserContext";
import { getWasseraktionswochenUrl } from "../../../public/data/wasseraktionswochen_config.js";

// Merges the former `wasseraktionsLink` + `wasseraktionsButton` classes (button rules came later
// in the original makeStyles object, so they win: color primary.main, padding spacing(0.75, 2)).
const WasseraktionsLink = styled(Link)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 600,
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  backgroundColor: "#D5F1FF",
  borderRadius: theme.spacing(3),
  padding: theme.spacing(0.75, 2),
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  columnGap: theme.spacing(1),
  "&:hover": {
    backgroundColor: "#C0E6FF",
    textDecoration: "none",
  },
}));

const WasseraktionsIcon = styled("img")({
  width: 20,
  height: 20,
  flexShrink: 0,
});

export default function WasseraktionswochenLink() {
  const { locale } = useContext(UserContext);
  const wasseraktionswochenUrl = getWasseraktionswochenUrl(locale);

  return (
    <WasseraktionsLink
      href={wasseraktionswochenUrl}
      underline="none"
      aria-label="Wasseraktionswochen campaign"
    >
      <WasseraktionsIcon src="/icons/actionswochenlogo-icon.png" alt="" role="presentation" />
      Wasseraktionswochen
    </WasseraktionsLink>
  );
}

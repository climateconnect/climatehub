import { List, ListItemButton, ListItemIcon, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import UserContext from "../../context/UserContext";
import ProfileBadge from "../../profile/ProfileBadge";

const BadgeList = styled(List)(({ theme }) => ({
  display: "grid",
  width: "100%",
  gridTemplateColumns: "repeat(2, 1fr)",
  gridColumnGap: 2,
  gridRowGap: 5,
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "repeat(1, 1fr)",
  },
}));

const BadgeListItemIcon = styled(ListItemIcon)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

const BadgeExplainerText = styled(Typography)({
  fontSize: 15.5,
});

export default function DonorBadgeExplainerList({ possibleBadges }) {
  return (
    <BadgeList>
      {possibleBadges
        .sort((a, b) => a.min_days_donated - b.min_days_donated)
        .map((b, i) => (
          <DonorBadgeListEntry badge={b} key={i} />
        ))}
    </BadgeList>
  );
}

const DonorBadgeListEntry = ({ badge }) => {
  const { locale } = useContext(UserContext);

  const badgeText = {
    en: `Donate ${badge.min_days_donated} days 
    ${
      badge.instantly_awarded_over_amount > 5
        ? `(Instant with >${badge.instantly_awarded_over_amount}€)`
        : ""
    }`,
    de: `Spende ${badge.min_days_donated} Tage
    ${
      badge.instantly_awarded_over_amount > 5
        ? `(Direkt bei >${badge.instantly_awarded_over_amount}€)`
        : ""
    }`,
  };
  return (
    <ListItemButton /* TODO(undefined) className={classes.listItem} */>
      <BadgeListItemIcon>
        <ProfileBadge contentOnly badge={badge} />
      </BadgeListItemIcon>
      <BadgeExplainerText>{badgeText[locale]}</BadgeExplainerText>
    </ListItemButton>
  );
};

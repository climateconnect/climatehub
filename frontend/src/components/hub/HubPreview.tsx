import { Card, CardMedia, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import AppLink from "../general/AppLink";

const NoUnderlineLink = styled(AppLink)({
  textDecoration: "inherit",
  "&:hover": {
    textDecoration: "inherit",
  },
});

const HubCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "$disableBoxShadow",
})<{ $disableBoxShadow?: boolean }>(({ $disableBoxShadow }) => ({
  boxShadow: $disableBoxShadow ? undefined : `3px 3px 3px #e0e0e0`,
  borderColor: "#e0e0e0",
}));

const PlaceholderImg = styled("img")({
  visibility: "hidden",
  width: "100%",
});

const CardContentWrapper = styled("div")(({ theme }) => ({
  height: 120,
  background: "#f8f8f8",
  padding: theme.spacing(1),
  paddingLeft: theme.spacing(2),
}));

const Title = styled(Typography)(({ theme }) => ({
  fontSize: 25,
  color: theme.palette.secondary.main,
  fontWeight: 600,
}));

export default function HubPreview({ hub, disableBoxShadow = false }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });

  return (
    <NoUnderlineLink href={`/hubs/${hub.url_slug}/browse`} underline="hover">
      <HubCard $disableBoxShadow={disableBoxShadow} variant="outlined">
        <CardMedia title={hub.name} image={getImageUrl(hub.thumbnail_image)}>
          <PlaceholderImg
            src={getImageUrl(hub.thumbnail_image)}
            alt={texts.image_for + " " + hub.name}
          />
        </CardMedia>
        <CardContentWrapper>
          <Title>{hub.name}</Title>
        </CardContentWrapper>
      </HubCard>
    </NoUnderlineLink>
  );
}

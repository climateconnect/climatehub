import { Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const HeartContainer = styled("div")(({ theme }) => ({
  height: 40,
  position: "relative",
  width: 47,
  marginLeft: theme.spacing(1.5),
}));

const HeartIconContainer = styled("div")({
  position: "absolute",
  left: 0,
  height: 40,
});

const HeartIcon = styled("img")({
  height: "100%",
  visibility: "hidden",
});

const ColoredHeartIconDisplayBox = styled("div")({
  background: "url('/images/planet-earth-heart.svg')",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% auto",
  backgroundPosition: "center bottom",
  width: "100%",
  position: "absolute",
  bottom: 0,
});

const GreyHeartIconDisplayBox = styled("div")({
  background: "url('/images/planet-earth-grey.svg')",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% auto",
  backgroundPosition: "center top",
  width: "100%",
  position: "absolute",
  top: 0,
});

export default function IdeaRatingIcon({ rating, number_of_ratings }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({
    page: "idea",
    locale: locale,
    idea: {
      rating: {
        rating_score: rating,
        number_of_ratings: number_of_ratings,
      },
    },
  });
  return (
    <Tooltip
      title={
        number_of_ratings > 0
          ? texts.x_people_rated_this_idea
          : texts.nobody_has_rated_this_idea_yet
      }
    >
      <HeartContainer>
        <HeartIconContainer>
          <GreyHeartIconDisplayBox style={{ height: `${100 - rating}%` }} />
          <HeartIcon src={"/images/planet-earth-grey.svg"} alt="planet grey icon" />
        </HeartIconContainer>
        <HeartIconContainer>
          <ColoredHeartIconDisplayBox style={{ height: `${rating}%` }} />
          <HeartIcon src={"/images/planet-earth-heart.svg"} alt="planet heart icon" />
        </HeartIconContainer>
      </HeartContainer>
    </Tooltip>
  );
}

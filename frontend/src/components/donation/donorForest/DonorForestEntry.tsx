import { Avatar, Link, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import { getLocalePrefix } from "../../../../public/lib/apiOperations";
import { durationFromMiliseconds } from "../../../../public/lib/dateOperations";
import { getImageUrl } from "../../../../public/lib/imageOperations";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";

const TreeImageContainer = styled("div", {
  shouldForwardProp: (prop) => typeof prop === "string" && !prop.startsWith("$"),
})<{ $width?: string }>(({ $width }) => ({
  width: $width,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "bottom",
}));

const TreeImage = styled("img")({
  visibility: "hidden",
});

const DonorAvatar = styled(Avatar)(({ theme }) => ({
  marginLeft: theme.spacing(4.5),
  marginTop: theme.spacing(-1),
  width: 50,
  height: 50,
  border: `2px solid ${theme.palette.primary.main}`,
}));

const getWidthFromStep = (step) => {
  const widths = {
    1: "65px",
    2: "70px",
    3: "75px",
    4: "80px",
    5: "95px",
    6: "100px",
  };
  if (widths[step]) return widths[step];
  return "65px";
};

export default function DonorForestEntry({ donor }) {
  const badge = donor.badges[0];
  const width = getWidthFromStep(badge.step ? badge.step : 1);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "donate", locale: locale });
  const now = new Date();
  const timeSinceFirstDonation = now.getTime() - new Date(donor.started_donating).getTime();
  return (
    <Tooltip
      title={`${donor.first_name} ${donor.last_name} ${
        texts.has_been_a_supporter_for
      } ${durationFromMiliseconds(timeSinceFirstDonation, texts)}`}
    >
      <div>
        <TreeImageContainer
          $width={width}
          style={{ backgroundImage: `url('${getImageUrl(badge.image)}')` }}
        >
          <TreeImage src={getImageUrl(badge.image)} alt="donor badge" />
        </TreeImageContainer>
        <Link
          href={`${getLocalePrefix(locale)}/profiles/${donor.url_slug}`}
          target="_blank"
          underline="hover"
        >
          <DonorAvatar
            /* TODO(unused) size="large" */
            src={getImageUrl(donor.thumbnail_image ?? donor.image)}
          />
        </Link>
      </div>
    </Tooltip>
  );
}

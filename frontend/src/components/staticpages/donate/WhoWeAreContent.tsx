import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../../public/texts/texts";
import UserContext from "../../context/UserContext";

const TeamRoot = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

const TeamImage = styled("img")({
  width: "100%",
});

export default function WhoWeAreContent() {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "donate", locale: locale });
  return (
    <TeamRoot>
      <div /*TODO(undefined) className={classes.imageContainer}*/>
        <div /*TODO(undefined) className={classes.imageWrapper}*/>
          <TeamImage src="/images/team.jpg" alt={texts.our_team_image_text} />
        </div>
      </div>
    </TeamRoot>
  );
}

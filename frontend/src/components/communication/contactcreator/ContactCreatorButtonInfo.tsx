import { Avatar, Card, CardHeader, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

const SlideInCard = styled(Card)({
  display: "flex",
  justifyContent: "center",
  backgroundColor: "#F8F8F8",
  cursor: "pointer",
  flexDirection: "column",
});

const StyledCardHeader = styled(CardHeader)({
  "&.MuiCardHeader-root": {
    textAlign: "left",
  },
  "& .MuiCardHeader-subheader": {
    color: "black",
  },
  "& .MuiCardHeader-title": {
    fontWeight: "bold",
  },
});

export default function ContactCreatorButtonInfo({
  creatorName,
  creatorImageURL,
  creatorsRoleInProject,
  customMessage,
}: any) {
  return (
    <SlideInCard variant="outlined">
      <StyledCardHeader
        avatar={<Avatar src={creatorImageURL} sx={{ height: 50, width: 50 }} />}
        title={creatorName}
        subheader={
          creatorsRoleInProject ? (
            creatorsRoleInProject
          ) : (
            /* eslint-disable-next-line react/no-unescaped-entities */
            <Typography sx={{ fontSize: 14, fontStyle: "italic" }}>"{customMessage}"</Typography>
          )
        }
      />
    </SlideInCard>
  );
}

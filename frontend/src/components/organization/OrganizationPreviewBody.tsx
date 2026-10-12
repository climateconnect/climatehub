import { Box, CardContent, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useState } from "react";
import LocationDisplay from "../project/LocationDisplay";

const ContentWrapper = styled(CardContent)({
  padding: 0,
  display: "flex",
  flexDirection: "column",
  flex: 1,
  overflow: "hidden",
});

const LocationBox = styled(Box)({
  margin: "0 auto",
});

// LocationDisplay only accepts class names for its text and icon, so they are targeted
// through descendant selectors of its root element.
const StyledLocationDisplay = styled(LocationDisplay)(({ theme }) => ({
  "& .MuiTypography-root": {
    display: "inline",
    fontSize: 14,
    marginLeft: theme.spacing(0.25),
  },
  "& .MuiSvgIcon-root": {
    verticalAlign: "bottom",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(-0.25),
    fontSize: "default",
    color: theme.palette.background.default_contrastText,
  },
}));

const SummaryBox = styled(Box)({
  overflow: "hidden",
});

const ShortenedSummary = styled(Typography)({
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  display: "-webkit-box",
  lineHeight: 1.25,
});

export default function OrganizationPreviewBody({ organization }) {
  // eslint-disable-next-line no-unused-vars
  const [linesOfText, setLinesOfText] = useState(5);

  return (
    <ContentWrapper>
      <LocationBox>
        {!!organization.info.location && (
          <StyledLocationDisplay location={organization?.info?.location} />
        )}
      </LocationBox>
      <SummaryBox
      /*TODO(unused) ref={(textBox) => {
          const linesEstimation = textBox?.clientHeight / 25;
          setLinesOfText(Math.floor(linesEstimation));
        }} */
      >
        <ShortenedSummary style={{ WebkitLineClamp: linesOfText }}>
          {organization.short_description ?? organization.description}
        </ShortenedSummary>
      </SummaryBox>
    </ContentWrapper>
  );
}

import React from "react";
import { Container } from "@mui/material";
import { styled } from "@mui/material/styles";
import Quote from "./Quote";

// Static classes handed to `Quote` (`textClassName`, `quoteIconClassName`) and styled from the root
const TEXT_CLASS = "quoteBoxText";
const QUOTE_ICON_CLASS = "quoteBoxQuoteIcon";

const Root = styled("div")(({ theme }) => ({
  background: theme.palette.primary.main,
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  [`& .${TEXT_CLASS}`]: {
    color: "white",
  },
  [`& .${QUOTE_ICON_CLASS}`]: {
    color: theme.palette.primary.light,
  },
}));

export default function QuoteBox({ text, className }) {
  return (
    <Root>
      <Container>
        <Quote
          className={className}
          text={text}
          textClassName={TEXT_CLASS}
          quoteIconClassName={QUOTE_ICON_CLASS}
          noPadding
        />
      </Container>
    </Root>
  );
}

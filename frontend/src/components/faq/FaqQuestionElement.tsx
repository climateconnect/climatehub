import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import React, { useState } from "react";

const Root = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
  borderLeft: `5px solid ${theme.palette.primary.main}`,
}));

const QuestionWrapper = styled("div")(({ theme }) => ({
  width: "100%",
  backgroundColor: "#2071781A",
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
}));

const QuestionText = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  fontSize: 19,
  width: "100%",
  [theme.breakpoints.down("sm")]: {
    fontSize: 16,
    fontWeight: "normal",
  },
})) as typeof Typography;

const AnswerWrapper = styled("div")(({ theme }) => ({
  width: "100%",
  backgroundColor: "#F2F2F2",
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  fontSize: 17,
  lineHeight: 1.5,
  [theme.breakpoints.down("sm")]: {
    fontSize: 16,
  },
}));

export default function FaqQuestionElement({
  questionObject,
  className,
  questionTextClassName,
}: any) {
  const [open, setOpen] = useState(false);

  return (
    <Root className={className}>
      <QuestionWrapper onClick={() => setOpen(!open)}>
        <QuestionText component="h3" className={questionTextClassName}>
          {questionObject.question}
        </QuestionText>
        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
      </QuestionWrapper>
      {open && <AnswerWrapper>{questionObject.answer}</AnswerWrapper>}
    </Root>
  );
}

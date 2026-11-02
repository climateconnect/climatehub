import { Button, Container, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import ContactSupportOutlinedIcon from "@mui/icons-material/ContactSupportOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import React, { useContext, useState } from "react";

import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import FaqQuestionElement from "../faq/FaqQuestionElement";

const Root = styled("div")(({ theme }) => ({
  background: theme.palette.primary.main,
  marginTop: theme.spacing(8),
  marginBottom: theme.spacing(8),
  paddingTop: theme.spacing(5),
  paddingBottom: theme.spacing(2),
  // class name is read by the faq texts (classes?.faqLink)
  "& .faqLink": {
    color: "inherit",
    textDecoration: "underline",
    fontWeight: 600,
    cursor: "pointer",
  },
}));

const ExplanationWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  maxWidth: 800,
  margin: "0 auto",
  marginBottom: theme.spacing(2),
}));

const IconWrapper = styled("div")(({ theme }) => ({
  marginRight: theme.spacing(4),
  [theme.breakpoints.down("sm")]: {
    position: "absolute",
    opacity: 0,
  },
}));

const StyledIcon = styled(ContactSupportOutlinedIcon)(({ theme }) => ({
  color: theme.palette.yellow.main,
  height: 120,
  width: 120,
}));

const ExplanationText = styled("div")({
  color: "white",
  zIndex: 1,
});

const Headline = styled(Typography)({
  color: "white",
  textAlign: "left",
}) as typeof Typography;

const TextBody = styled(Typography)({
  fontSize: 18,
});

const StyledFaqQuestion = styled(FaqQuestionElement)(({ theme }) => ({
  background: theme.palette.primary.light,
  borderLeft: `5px solid ${theme.palette.yellow.main} !important`,
  "& .faqQuestionText": {
    color: theme.palette.secondary.main,
    [theme.breakpoints.down("sm")]: {
      fontWeight: "bold",
    },
  },
}));

const ShowMoreButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginTop: theme.spacing(2),
}));

const ShowMoreButton = styled(Button)({
  color: "white",
});

export default function FaqSection({ headlineClass, questions }) {
  const { locale } = useContext(UserContext);

  const texts = getTexts({ page: "faq", locale: locale, classes: { faqLink: "faqLink" } });
  const [expanded, setExpanded] = useState(false);
  const handleToggleShowMore = (e) => {
    e.preventDefault();
    setExpanded(!expanded);
  };
  return (
    <Root>
      <Container>
        <ExplanationWrapper>
          <IconWrapper>
            <StyledIcon />
          </IconWrapper>
          <ExplanationText>
            <Headline component="h3" className={headlineClass}>
              {texts.got_a_question}
            </Headline>
            <TextBody>{texts.find_all_commonly_asked_questions_on_the_faq_page}</TextBody>
          </ExplanationText>
        </ExplanationWrapper>
        <div>
          {questions &&
            questions.map(
              (q, index) =>
                (index <= 1 || expanded) && (
                  <StyledFaqQuestion
                    /*TODO(undefined) answerClassName={classes.faqAnswer} */
                    key={index}
                    questionObject={q}
                    questionTextClassName="faqQuestionText"
                  />
                )
            )}
        </div>
        <ShowMoreButtonContainer>
          <ShowMoreButton onClick={handleToggleShowMore}>
            <Typography>{expanded ? texts.show_less : texts.show_more}</Typography>
            {expanded ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
          </ShowMoreButton>
        </ShowMoreButtonContainer>
      </Container>
    </Root>
  );
}

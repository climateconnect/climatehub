import { Container, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Cookies from "next-cookies";
import React, { useContext, useState } from "react";

import { apiRequest } from "../public/lib/apiOperations";
import getTexts from "../public/texts/texts";
import UserContext from "../src/components/context/UserContext";
import FilteredFaqContent from "../src/components/faq/FilteredFaqContent";
import UnfilteredFaqContent from "../src/components/faq/UnfilteredFaqContent";
import FilterSearchBar from "../src/components/filter/FilterSearchBar";
import WideLayout from "../src/components/layouts/WideLayout";
import HeaderImage from "../src/components/staticpages/HeaderImage";

// HeaderImage spreads `className` onto its root but types it as required, so widen the prop type
const StyledHeaderImage = styled(
  HeaderImage as React.ComponentType<{
    src: string;
    children: React.ReactNode;
    className?: string;
  }>
)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  [theme.breakpoints.down("lg")]: {
    marginBottom: theme.spacing(2),
  },
}));

const HeaderTextContainer = styled("div")(({ theme }) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "rgba(255, 255, 255, 0.6)",
  width: "100%",
  height: "100%",
  [theme.breakpoints.down("lg")]: {
    background: "rgba(255, 255, 255, 0.8)",
  },
}));

const HeaderTextInnerContainer = styled("div")(({ theme }) => ({
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(4),
}));

const HeaderTextBig = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  fontWeight: "bold",
  fontSize: 80,
  [theme.breakpoints.down("lg")]: {
    fontSize: 60,
  },
  [theme.breakpoints.down("sm")]: {
    fontSize: 40,
  },
  textAlign: "center",
}));

const HeaderTextSmall = styled(Typography)(({ theme }) => ({
  color: "white",
  fontWeight: "bold",
  textAlign: "left",
  [theme.breakpoints.down("lg")]: {
    fontSize: 40,
  },
  [theme.breakpoints.down("sm")]: {
    fontSize: 25,
  },
  textShadow: "3px 3px 3px #484848C2",
}));

const TopText = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  fontWeight: "bold",
  fontSize: 19,
  textAlign: "center",
  [theme.breakpoints.down("lg")]: {
    fontSize: 14,
    fontWeight: "normal",
  },
}));

const SearchBarContainer = styled("div")(({ theme }) => ({
  flexGrow: 100,
  marginTop: theme.spacing(3),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledFilterSearchBar = styled(FilterSearchBar)({
  width: "100%",
  maxWidth: 780,
  margin: "0 auto",
});

export async function getServerSideProps(ctx) {
  const { auth_token } = Cookies(ctx);

  // Fetch list of FAQ questions from the database
  const questions = await getQuestionsWithAnswers(auth_token, ctx.locale);

  return {
    props: {
      questionsBySection: questions!.by_section,
      questions: questions!.all,
    },
  };
}

export default function Faq({ questionsBySection, questions }) {
  // The first section should be the initial tab value
  const [searchValue, setSearchValue] = useState("");
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "faq", locale: locale });

  const handleSearchBarChange = (event) => {
    setSearchValue(event?.target?.value);
  };
  return (
    <div>
      <WideLayout title={texts.faq} isStaticPage>
        <StyledHeaderImage src="/images/supportusheader.jpg">
          <HeaderTextContainer>
            <HeaderTextInnerContainer>
              <div>
                <HeaderTextBig color="primary" component="h1" variant="h1">
                  {texts.faq}
                </HeaderTextBig>
                <HeaderTextSmall variant="h1">{texts.find_your_answers_here}</HeaderTextSmall>
              </div>
            </HeaderTextInnerContainer>
          </HeaderTextContainer>
        </StyledHeaderImage>
        <Container>
          <TopText component="h1">{texts.cant_find_the_answer_to_your_question_contact}</TopText>
          <SearchBarContainer>
            <StyledFilterSearchBar
              label={texts.search_for_keywords}
              onChange={handleSearchBarChange}
              value={searchValue}
            />
          </SearchBarContainer>
          {searchValue ? (
            <FilteredFaqContent searchValue={searchValue} questions={questions} />
          ) : (
            <UnfilteredFaqContent questionsBySection={questionsBySection} />
          )}
        </Container>
      </WideLayout>
    </div>
  );
}

const getQuestionsWithAnswers = async (token, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/list_faq/",
      token: token,
      locale: locale,
    });

    if (resp.data.length === 0) {
      return null;
    }

    return {
      by_section: sortBySection(resp.data.results),
      all: resp.data.results,
    };
  } catch (err: any) {
    if (err.response && err.response.data) {
      console.log(err.response.data);
    } else console.log(err);
    return null;
  }
};

const sortBySection = (questions) => {
  return questions.reduce((obj, question) => {
    if (!obj[question.section]) obj[question.section] = [question];
    else obj[question.section].push(question);
    return obj;
  }, {});
};

import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import FaqQuestionElement from "./FaqQuestionElement";

const Root = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

// Note: the previous makeStyles rule contained a misspelled `marginBottm`
// property, which had no effect and is intentionally not carried over.
const Header = styled(Typography)({
  textAlign: "center",
  fontWeight: "bold",
}) as typeof Typography;

export default function FilteredFaqContent({ searchValue, questions }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "faq", locale: locale });
  return (
    <Root>
      <Header>
        {texts.search_results_for}
        <Header component="span" color="primary">
          {' "' + searchValue + '"'}
        </Header>
      </Header>
      {questions
        .filter((q) => q.question.toLowerCase().includes(searchValue.toLowerCase()))
        .map((q, index) => (
          <FaqQuestionElement key={index} questionObject={q} />
        ))}
    </Root>
  );
}

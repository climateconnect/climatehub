import React, { useState } from "react";
import { Tabs, Tab, Divider } from "@mui/material";
import { styled } from "@mui/material/styles";

import FaqQuestionElement from "./FaqQuestionElement";

const StyledTabs = styled(Tabs)(({ theme }) => ({
  width: "100%",
  marginTop: theme.spacing(2),
}));

const StyledDivider = styled(Divider)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

export default function UnfilteredFaqContent({ questionsBySection }) {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  function TabContent({ value, index, children }) {
    return <div hidden={value !== index}>{children}</div>;
  }

  return (
    <>
      <StyledTabs
        indicatorColor="primary"
        onChange={handleTabChange}
        textColor="primary"
        value={tabValue}
      >
        {Object.keys(questionsBySection).map((key, index) => (
          <Tab
            /*TODO(undefined) className={classes.tab} */
            key={`${key}-${index}-tab`}
            label={Object.keys(questionsBySection)[index].toUpperCase()}
          />
        ))}
      </StyledTabs>
      <StyledDivider />
      {Object.keys(questionsBySection).map((key, index) => (
        <TabContent value={tabValue} index={index} key={key}>
          {questionsBySection[key].map((q) => (
            <FaqQuestionElement key={key + "-" + q.question} questionObject={q} />
          ))}
        </TabContent>
      ))}
    </>
  );
}

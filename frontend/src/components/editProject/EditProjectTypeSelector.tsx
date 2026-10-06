import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import SelectField from "../general/SelectField";
import { styled } from "@mui/material/styles";

const StyledSelectField = styled(SelectField)(({ theme }) => ({
  width: 200,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}));

export function EditProjectTypeSelector({ project, onChangeProjectType, projectTypeOptions }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const onChange = (e) => {
    const newType = projectTypeOptions.find((p) => p.name === e.target.value);
    onChangeProjectType(newType);
  };
  return (
    <StyledSelectField
      controlled
      controlledValue={project.project_type}
      options={projectTypeOptions}
      label={texts.project_type}
      onChange={onChange}
    />
  );
}

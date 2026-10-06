import React, { useContext } from "react";
import { TextField } from "@mui/material";
import getTexts from "../../../public/texts/texts";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import UserContext from "../context/UserContext";
import { styled, useTheme } from "@mui/material/styles";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";

const Root = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(5),
  display: "flex",
  justifyContent: "center",
}));

const NameField = styled(TextField)({
  width: "100%",
  maxWidth: 800,
  "& .MuiInputBase-input": {
    fontSize: 20,
    fontWeight: 600,
  },
  "& .MuiInputLabel-root:not(.MuiInputLabel-shrink)": {
    fontSize: 20,
  },
});

export default function ProjectNameSection({ projectData, handleSetProjectData }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const theme = useTheme();

  const onChangeName = (e) => {
    handleSetProjectData({
      name: e.target.value,
    });
  };

  const color = getBackgroundContrastColor(theme);

  return (
    <Root>
      <NameField
        label={projectTypeTexts.name[projectData.project_type?.type_id]}
        required
        color={color}
        value={projectData.name}
        onChange={onChangeName}
      />
    </Root>
  );
}

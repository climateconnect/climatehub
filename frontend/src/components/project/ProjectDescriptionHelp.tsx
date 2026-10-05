import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import UserContext from "../context/UserContext";

const Root = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

type Props = {
  typeId?: string;
};

export default function ProjectDescriptionHelp({ typeId }: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const type = typeId || "project";
  return (
    <Root>
      <Typography>{projectTypeTexts.videoDescription[type]}</Typography>
    </Root>
  );
}

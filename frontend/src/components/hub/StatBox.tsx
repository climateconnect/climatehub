import { Link, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";

import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import Stat from "./Stat";

const Root = styled("div")(({ theme }) => ({
  width: 310,
  background: "#EBEBEB",
  padding: theme.spacing(2),
}));

const Heading = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 600,
  fontSize: 21,
  marginBottom: theme.spacing(1),
  textAlign: "center",
}));

const SourceLink = styled(Link)({
  cursor: "pointer",
});

const Source = styled(Typography)({
  fontSize: 14,
  textAlign: "center",
});

export default function StatBox({ title, stats }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });

  return (
    <Root>
      <Heading component="h2">{title}</Heading>
      {stats?.length > 0 && stats.map((s) => <Stat key={s.name} statData={s} />)}
      <Source>
        {texts.source}:{" "}
        <SourceLink target="_blank" href={stats[0]?.source_link} underline="hover">
          {stats[0]?.source_name}
        </SourceLink>
      </Source>
    </Root>
  );
}

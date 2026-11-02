import React from "react";
import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import theme from "../../themes/theme";
import { PieChart } from "react-minimal-pie-chart";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const PieChartContainer = styled("div")(({ theme }) => ({
  display: "flex",
  marginBottom: theme.spacing(2),
}));

const ChartInfo = styled("div")(({ theme }) => ({
  marginLeft: theme.spacing(2),
}));

const ChartInfoHeadline = styled(Typography)({
  fontWeight: "bold",
  fontSize: 25,
});

const StyledPieChart = styled(PieChart)({
  maxWidth: 100,
});

const ChartInfoDescription = styled(Typography)({
  fontSize: 16,
});

const Footnote = styled(Typography)({
  fontSize: 14,
});

const StyledInfoIcon = styled(InfoOutlinedIcon)(({ theme }) => ({
  fontSize: 19,
  marginBottom: -4,
  marginRight: theme.spacing(0.25),
}));

export default function Stat({ statData }) {
  const data = [
    { value: parseInt(statData.value), title: statData.name, color: theme.palette.primary.main },
    { value: 100 - parseInt(statData.value), title: "Rest", color: "#D6D6D6" },
  ];
  return (
    <div>
      <PieChartContainer>
        <StyledPieChart data={data} lineWidth={30} startAngle={270} />
        <ChartInfo>
          <ChartInfoHeadline color="primary">{statData.value}</ChartInfoHeadline>
          <div>
            <ChartInfoDescription>{statData.value_description}</ChartInfoDescription>
          </div>
        </ChartInfo>
      </PieChartContainer>
      {statData.description && (
        <Footnote>
          <StyledInfoIcon />
          {`${statData.description}`}
        </Footnote>
      )}
    </div>
  );
}

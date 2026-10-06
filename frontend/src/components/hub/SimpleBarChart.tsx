import React, { Fragment } from "react";
import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

const Title = styled(Typography)(({ theme }) => ({
  color: theme.palette.secondary.main,
  fontWeight: 700,
}));

const ChartContainer = styled("div")({
  display: "flex",
});

const Labels = styled("div")({
  height: 40,
});

const Bars = styled("div")({
  flexGrow: 100,
});

const BarContainer = styled("div")({
  height: 40,
  display: "flex",
  alignItems: "center",
});

const BarFill = styled("div")(({ theme }) => ({
  height: 25,
  background: theme.palette.primary.main,
  display: "flex",
  justifyContent: "flex-end",
}));

const Label = styled(Typography)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  height: 40,
  marginRight: theme.spacing(2),
  color: theme.palette.primary.main,
  justifyContent: "flex-end",
  fontWeight: 600,
}));

const Unit = styled(Typography)(({ theme }) => ({
  color: "white",
  marginRight: theme.spacing(1),
}));

const UnitOutsideBar = styled(Typography)(({ theme }) => ({
  color: theme.palette.secondary.main,
  marginLeft: theme.spacing(1),
  fontWeight: 600,
}));

export default function SimpleBarChart({ config, className, labelsOutSideBar, title }) {
  const data = config.data;
  const biggestValue = Math.max.apply(
    Math,
    data.map((d) => parseFloat(d.value))
  );
  const maxValue = labelsOutSideBar ? biggestValue * 1.3 : biggestValue * 1.1;
  return (
    <div className={className}>
      <Title>{title}</Title>
      <ChartContainer>
        <Labels>
          {data.map((dp, index) => (
            <Label key={index}>{dp.label}</Label>
          ))}
        </Labels>
        <Bars>
          {data.map((dp, index) => {
            return (
              <Fragment key={index}>
                <Bar
                  value={dp.value}
                  unit={config.unit}
                  maxValue={maxValue}
                  labelsOutSideBar={labelsOutSideBar}
                />
              </Fragment>
            );
          })}
        </Bars>
      </ChartContainer>
    </div>
  );
}

const Bar = ({ value, unit, maxValue, labelsOutSideBar }) => {
  const barWidth = (value / maxValue) * 100;
  return (
    <BarContainer>
      <BarFill style={{ width: `${barWidth}%` }}>
        {!labelsOutSideBar && <Unit>{`${value} ${unit}`}</Unit>}
      </BarFill>
      {labelsOutSideBar && <UnitOutsideBar>{`${value} ${unit}`}</UnitOutsideBar>}
    </BarContainer>
  );
};

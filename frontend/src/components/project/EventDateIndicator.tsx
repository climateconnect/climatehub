import React, { useContext } from "react";
import { Tooltip, Typography } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";
import { getDateAndTime, getDayAndMonth, getTime } from "../../../public/lib/dateOperations";
import UserContext from "../context/UserContext";

type IndicatorProps = { $isInPast: boolean; $isCustomHub: boolean };

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

const Indicator = styled("div", { shouldForwardProp })<IndicatorProps>(
  ({ theme, $isInPast, $isCustomHub }) => ({
    position: "absolute",
    top: 0,
    right: 20,
    background: $isInPast
      ? $isCustomHub
        ? theme.palette.grey.light
        : theme.palette.secondary.extraLight
      : $isCustomHub
      ? theme.palette.primary.main
      : theme.palette.yellow.main,
    zIndex: 9,
    borderRadius: "0px 0px 8px 8px",
    padding: theme.spacing(1),
    boxShadow: `2px 3px 7px -2px ${theme.palette.text.primary}`,
  })
);

const textColor = (theme: Theme, { $isInPast, $isCustomHub }: IndicatorProps) =>
  $isInPast
    ? $isCustomHub
      ? theme.palette.text.primary
      : theme.palette.secondary.main
    : theme.palette.background.default_contrastText;

const DateText = styled(Typography, { shouldForwardProp })<IndicatorProps>(
  ({ theme, $isInPast, $isCustomHub }) => ({
    fontWeight: 700,
    fontSize: 21,
    lineHeight: 1,
    textAlign: "center",
    color: textColor(theme, { $isInPast, $isCustomHub }),
  })
);

const TimeText = styled(Typography, { shouldForwardProp })<IndicatorProps>(
  ({ theme, $isInPast, $isCustomHub }) => ({
    fontWeight: 600,
    textAlign: "center",
    lineHeight: 1,
    color: textColor(theme, { $isInPast, $isCustomHub }),
  })
);

export default function EventDateIndicator({ project, hubUrl }) {
  const { CUSTOM_HUB_URLS } = useContext(UserContext);
  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);
  const start_date = new Date(project.start_date);
  const end_date = new Date(project.end_date);
  const styleProps = { $isInPast: new Date() > end_date, $isCustomHub: isCustomHub };
  const ONE_DAY_IN_MILISECONDS = 1000 * 60 * 60 * 24;
  const event_duration = end_date.getTime() - start_date.getTime();
  const isMultiDayEvent =
    start_date.getDate() !== start_date.getDate() || event_duration > ONE_DAY_IN_MILISECONDS;

  return (
    <Tooltip title={`${getDateAndTime(start_date)} - ${getDateAndTime(end_date)}`}>
      <Indicator {...styleProps}>
        {isMultiDayEvent ? (
          <DateText {...styleProps}>{`${getDayAndMonth(start_date)} - ${getDayAndMonth(
            end_date
          )}`}</DateText>
        ) : (
          <>
            <DateText {...styleProps}>{getDayAndMonth(start_date)}</DateText>
            <TimeText {...styleProps}>{getTime(start_date)}</TimeText>
          </>
        )}
      </Indicator>
    </Tooltip>
  );
}

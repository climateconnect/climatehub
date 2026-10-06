import React, { useContext } from "react";
import "date-fns";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import "dayjs/locale/de";
import "dayjs/locale/en";
import dayjs, { Dayjs } from "dayjs";

import { DatePicker as DatePickerComponent } from "@mui/x-date-pickers/DatePicker";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import UserContext from "../context/UserContext";
import { ThemeProvider } from "@mui/material";
import { useTheme } from "@mui/material/styles";

type Props = {
  label?: string;
  date?: Date | null | Dayjs;
  handleChange: Function;
  className?: string;
  minDate?: Date | Dayjs | null;
  maxDate?: Date | Dayjs | null;
  enableTime?: boolean;
  error?: "string";
  required?: boolean;
};
export default function DatePicker({
  label,
  date,
  handleChange,
  className,
  minDate,
  maxDate,
  enableTime,
  error,
  required,
}: Props) {
  const { locale } = useContext(UserContext);
  const theme = useTheme();
  const dateValue: Dayjs | null = date ? dayjs(date) : null;
  const minDayjsDate: Dayjs | undefined = minDate ? dayjs(minDate) : undefined;
  const maxDayjsDate: Dayjs | undefined = maxDate ? dayjs(maxDate) : undefined;

  const handleDateChange = (value) => {
    handleChange(value);
  };

  const commonArgs = {
    className: className,
    label: label,
    onChange: handleDateChange,
    slotProps: {
      textField: {
        helperText: error,
        error: !!error,
        required: required,
      },
    },
  };

  const datePickerArgs = {
    ...commonArgs,
    value: dateValue,
    maxDate: maxDayjsDate,
    minDate: minDayjsDate,
  };

  const dateTimePickerArgs = {
    ...commonArgs,
    value: dateValue,
    minDateTime: minDayjsDate,
  };

  const helperTheme = {
    ...theme,
    palette: {
      ...theme.palette,
      primary: {
        ...theme.palette.primary,
        main: theme.palette.background.default_contrastText,
      },
    },
  };

  //Using helper theme because date picker component always uses primary color
  return (
    <LocalizationProvider adapterLocale={locale} dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={helperTheme}>
        {enableTime ? (
          <DateTimePicker {...dateTimePickerArgs} />
        ) : (
          <DatePickerComponent {...datePickerArgs} />
        )}
      </ThemeProvider>
    </LocalizationProvider>
  );
}

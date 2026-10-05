import React, { useContext } from "react";
import { Box, FormHelperText, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { RegistrationField } from "../../types";
import { formatTimeRange } from "../../utils/resolveRegistrationFieldAnswer";
import UserContext from "../context/UserContext";

const Root = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  paddingLeft: 0,
}));

const Label = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(1),
}));

const RequiredMark = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  marginLeft: theme.spacing(0.5),
}));

const Description = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
  fontSize: "0.875rem",
}));

const ErrorText = styled(FormHelperText)(({ theme }) => ({
  color: theme.palette.error.main,
}));

type Props = {
  field: RegistrationField;
  optionId: number | undefined;
  onChange: (_optionId: number) => void;
  error?: string;
  texts: {
    please_select_time_slot: string;
    seats_available: string;
  };
};

export default function RegistrationTimeSlotField({
  field,
  optionId,
  onChange,
  error,
  texts,
}: Props) {
  const { locale } = useContext(UserContext);
  const title = field.settings.title ?? "";
  const description = field.settings.description ?? "";
  const sortedOptions = [...(field.options ?? [])].sort((a, b) => a.order - b.order);

  const handleSelectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    if (val === "") return;
    onChange(Number(val));
  };

  return (
    <Root>
      <Label component="div" variant="body1">
        {title}
        {field.is_required && <RequiredMark aria-hidden="true">{" *"}</RequiredMark>}
      </Label>
      {description && <Description variant="body2">{description}</Description>}
      <TextField
        select
        fullWidth
        size="small"
        value={optionId ?? ""}
        onChange={handleSelectChange}
        required={field.is_required}
        SelectProps={{ native: true }}
      >
        <option value="">{texts.please_select_time_slot}</option>
        {sortedOptions.map((opt) => {
          const isDisabled = opt.remaining_amount === 0;
          const hasStartEnd = opt.start_time && opt.end_time;
          const timeLabel = hasStartEnd
            ? formatTimeRange(opt.start_time!, opt.end_time!, locale)
            : opt.title;
          const capacityLabel =
            opt.remaining_amount != null
              ? ` (${opt.remaining_amount} ${texts.seats_available})`
              : "";
          return (
            <option key={opt.id} value={opt.id} disabled={isDisabled}>
              {timeLabel}
              {hasStartEnd ? capacityLabel : ""}
            </option>
          );
        })}
      </TextField>
      {error && <ErrorText>{error}</ErrorText>}
    </Root>
  );
}

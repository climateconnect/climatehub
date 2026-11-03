import React from "react";
import { Box, FormHelperText, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { RegistrationField } from "../../types";

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

const ErrorText = styled(FormHelperText)(({ theme }) => ({
  color: theme.palette.error.main,
}));

type Props = {
  field: RegistrationField;
  value: number | undefined;
  onChange: (_optionId: number) => void;
  error?: string;
  texts: {
    please_select_an_option: string;
  };
};

export default function RegistrationOptionSelectField({
  field,
  value,
  onChange,
  error,
  texts,
}: Props) {
  const title = field.settings.title ?? "";
  const sortedOptions = [...(field.options ?? [])].sort((a, b) => a.order - b.order);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    if (val === "") return;
    const optionId = Number(val);
    if (!isNaN(optionId)) {
      onChange(optionId);
    }
  };

  return (
    <Root>
      <Label component="div" variant="body1">
        {title}
        {field.is_required && <RequiredMark aria-hidden="true">{" *"}</RequiredMark>}
      </Label>
      <TextField
        select
        fullWidth
        size="small"
        value={value ?? ""}
        onChange={handleChange}
        required={field.is_required}
        SelectProps={{ native: true }}
      >
        <option value="">{texts.please_select_an_option}</option>
        {sortedOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </TextField>
      {error && <ErrorText>{error}</ErrorText>}
    </Root>
  );
}

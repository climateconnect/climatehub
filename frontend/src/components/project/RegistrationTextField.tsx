import React, { useContext } from "react";
import { Box, FormHelperText, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import getTexts from "../../../public/texts/texts";
import { RegistrationField } from "../../types";
import UserContext from "../context/UserContext";

const MAX_LENGTH = 300;

const Root = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const RequiredMark = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  marginLeft: theme.spacing(0.5),
}));

const Description = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

const ErrorText = styled(FormHelperText)(({ theme }) => ({
  color: theme.palette.error.main,
}));

const Counter = styled(Typography)({
  textAlign: "right",
});

type Props = {
  field: RegistrationField;
  value: string;
  onChange: (_value: string) => void;
  error?: string;
};

export default function RegistrationTextField({ field, value, onChange, error }: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });

  const title = field.settings.title ?? "";
  const description = field.settings.description ?? "";
  const isMultiline = field.settings.is_multiline ?? false;
  const currentLength = value.length;

  return (
    <Root>
      <Typography variant="body1" gutterBottom>
        {title}
        {field.is_required && <RequiredMark aria-hidden="true">{"*"}</RequiredMark>}
      </Typography>
      {description && <Description variant="body2">{description}</Description>}
      <TextField
        fullWidth
        size="small"
        multiline={isMultiline}
        minRows={isMultiline ? 3 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={texts.registration_text_field_placeholder}
        inputProps={{ maxLength: MAX_LENGTH }}
        error={!!error}
      />
      {isMultiline && (
        <Counter variant="caption" color={currentLength >= MAX_LENGTH ? "error" : "textSecondary"}>
          {currentLength} / {MAX_LENGTH}
        </Counter>
      )}
      {error && <ErrorText error>{error}</ErrorText>}
    </Root>
  );
}

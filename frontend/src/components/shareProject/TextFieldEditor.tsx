import React, { useContext } from "react";
import { Box, Switch, TextField, FormControlLabel, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const FieldGroup = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
}));

type Props = {
  title: string;
  description: string;
  isMultiline: boolean;
  onChange: (_update: { title: string; description: string; is_multiline: boolean }) => void;
  titleDisabled?: boolean;
  isDraft?: boolean;
  fieldError?: string;
};

export default function TextFieldEditor({
  title,
  description,
  isMultiline,
  onChange,
  titleDisabled,
  isDraft,
  fieldError,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });

  return (
    <FieldGroup>
      <Box>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {texts.registration_text_field_title_label}
          {!isDraft && !titleDisabled && " *"}
        </Typography>
        {fieldError && (
          <Typography variant="caption" color="error" display="block" sx={{ mb: 0.5 }}>
            {fieldError}
          </Typography>
        )}
        <TextField
          fullWidth
          size="small"
          value={title}
          onChange={(e) =>
            onChange({ title: e.target.value, description, is_multiline: isMultiline })
          }
          disabled={titleDisabled}
          placeholder={texts.registration_text_field_title_label}
          inputProps={{ maxLength: 200 }}
          required
        />
      </Box>
      <Box>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {texts.registration_text_field_description_label}
        </Typography>
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          maxRows={4}
          value={description}
          onChange={(e) =>
            onChange({ title, description: e.target.value, is_multiline: isMultiline })
          }
          placeholder={texts.registration_text_field_description_label}
          inputProps={{ maxLength: 500 }}
        />
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={isMultiline}
            onChange={(e) => onChange({ title, description, is_multiline: e.target.checked })}
            color="primary"
            size="small"
          />
        }
        label={texts.registration_text_field_multiline_label}
      />
    </FieldGroup>
  );
}

import React from "react";
import { Box, Checkbox, FormHelperText, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { RegistrationField } from "../../types";

const Root = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const StyledCheckbox = styled(Checkbox)(({ theme }) => ({
  marginLeft: theme.spacing(-0.15),
  paddingLeft: 0,
}));

const Content = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1),
}));

const TextBlock = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  paddingTop: theme.spacing(1.125),
}));

const RequiredMark = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  marginLeft: theme.spacing(0.5),
}));

const DescriptionHtml = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  color: theme.palette.text.secondary,
  "& a": {
    color: theme.palette.primary.main,
  },
  "& p": {
    margin: 0,
    display: "inline",
  },
}));

const ErrorText = styled(FormHelperText)(({ theme }) => ({
  color: theme.palette.error.main,
}));

type Props = {
  field: RegistrationField;
  value: boolean;
  onChange: (_checked: boolean) => void;
  error?: string;
};

export default function RegistrationCheckboxField({ field, value, onChange, error }: Props) {
  const description = field.settings.description ?? "";

  return (
    <Root>
      <Content>
        <StyledCheckbox
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          color="primary"
        />
        <TextBlock>
          <DescriptionHtml component="div" variant="body2">
            {/* Render sanitized rich-text description stored by the organiser. */}
            <div dangerouslySetInnerHTML={{ __html: description }} style={{ display: "inline" }} />
            {field.is_required && <RequiredMark aria-hidden="true">{"*"}</RequiredMark>}
          </DescriptionHtml>
        </TextBlock>
      </Content>
      {error && <ErrorText error>{error}</ErrorText>}
    </Root>
  );
}

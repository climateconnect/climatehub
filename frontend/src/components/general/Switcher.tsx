import { Switch, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";

const FlexBlock = styled("div", {
  shouldForwardProp: (prop) => prop !== "$disabled",
})<{ $disabled?: boolean }>(({ theme, $disabled }) => ({
  display: "flex",
  justifyContent: "flex-start",
  gap: theme.spacing(2),
  ...($disabled && {
    opacity: 0.5,
    pointerEvents: "none",
  }),
}));

const SwitchTextContainer = styled("span")({
  display: "flex",
  alignItems: "center",
});

const SwitchText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active?: boolean }>(({ theme, $active }) => ({
  textAlign: "center",
  position: "relative",
  ...($active && {
    fontWeight: "bold",
    color: theme.palette.background.default_contrastText,
  }),
}));

export default function Switcher({
  trueLabel,
  falseLabel,
  value,
  required,
  handleChangeValue,
  color,
  disabled,
}: any) {
  const handleValueChange = (event) => {
    handleChangeValue(event.target.value);
  };
  return (
    <FlexBlock $disabled={!!disabled}>
      <SwitchTextContainer>
        <SwitchText $active={!value}>{falseLabel}</SwitchText>
      </SwitchTextContainer>
      <Switch
        checked={value}
        required={required}
        color={color ? color : "primary"}
        name="checkedA"
        inputProps={{ "aria-label": "secondary checkbox" }}
        onChange={handleValueChange}
        disabled={disabled}
      />
      <SwitchTextContainer>
        <SwitchText $active={!!value}>{trueLabel}</SwitchText>
      </SwitchTextContainer>
    </FlexBlock>
  );
}

import React, { useState } from "react";
import { RadioGroup, Radio, FormControlLabel } from "@mui/material";
import { styled } from "@mui/material/styles";

const RadioIcon = styled("span")({
  borderRadius: "50%",
  width: 16,
  height: 16,
  boxShadow: "inset 0 0 0 1px rgba(16,22,26,.2), inset 0 -1px 0 rgba(16,22,26,.1)",
  backgroundColor: "#f5f8fa",
  backgroundImage: "linear-gradient(180deg,hsla(0,0%,100%,.8),hsla(0,0%,100%,0))",
  // was "$root.Mui-focusVisible &" in JSS: the Radio root carries Mui-focusVisible
  ".Mui-focusVisible &": {
    outline: "2px auto rgba(19,124,189,.6)",
    outlineOffset: 2,
  },
  "input:hover ~ &": {
    backgroundColor: "#ebf1f5",
  },
  "input:disabled ~ &": {
    boxShadow: "none",
    background: "rgba(206,217,224,.5)",
  },
});

const CheckedRadioIcon = styled(RadioIcon)({
  backgroundColor: "#137cbd",
  backgroundImage: "linear-gradient(180deg,hsla(0,0%,100%,.1),hsla(0,0%,100%,0))",
  "&:before": {
    display: "block",
    width: 16,
    height: 16,
    backgroundImage: "radial-gradient(#fff,#fff 28%,transparent 32%)",
    content: '""',
  },
  "input:hover ~ &": {
    backgroundColor: "#106ba3",
  },
});

const RootRadio = styled(Radio)({
  "&:hover": {
    backgroundColor: "transparent",
  },
});

function StyledRadio(props) {
  return (
    <RootRadio
      disableRipple
      color="default"
      checkedIcon={<CheckedRadioIcon />}
      icon={<RadioIcon />}
      {...props}
    />
  );
}

// TODO: dead code?
export default function RadioButtons({ values, defaultValue, value, className, onChange }: any) {
  const [checkedValue, setCheckedValue] = useState(value ? value : defaultValue);

  const handleCheckedValueChange = (event) => {
    setCheckedValue(event.target.value);
    onChange(event.target.value);
  };

  return (
    <RadioGroup
      className={className}
      value={checkedValue}
      onChange={handleCheckedValueChange}
      aria-label="project status" //TODO: fix
      name="customized-radios"
    >
      {values.map((value) => (
        <FormControlLabel
          value={value.key}
          key={value.key}
          control={<StyledRadio />}
          label={value.label ? value.label : value.name}
        />
      ))}
    </RadioGroup>
  );
}

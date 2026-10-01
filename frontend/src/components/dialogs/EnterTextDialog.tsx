import { TextField } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { func, string, bool, number } from "prop-types";
import React, { useContext, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import GenericDialog from "./GenericDialog";
import { useTheme } from "@mui/material/styles";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";

const useStyles = makeStyles({
  textField: {
    width: "100%",
  },
});

type Props = {
  onClose: any;
  open: boolean;
  title: any;
  inputLabel: any;
  applyText: any;
  applyIcon?: any;
  maxLength: any;
  className: any;
};

export default function EnterTextDialog({
  onClose,
  open,
  title,
  inputLabel,
  applyText,
  applyIcon,
  maxLength,
  className,
}: Props) {
  const classes = useStyles();
  const [element, setElement] = useState(null);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });
  const theme = useTheme();
  const backgroundContrastColor = getBackgroundContrastColor(theme);

  const handleClose = () => {
    onClose();
    setElement(null);
  };

  const applyElement = () => {
    onClose(element);
    setElement(null);
  };

  const handleChange = (event) => {
    setElement(event.target.value);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") applyElement();
  };

  return (
    <GenericDialog
      onClose={handleClose}
      open={open}
      title={title}
      useApplyButton={true}
      applyIcon={applyIcon}
      onApply={applyElement}
      applyText={applyText ? applyText : texts.apply}
    >
      <div className={className}>
        <TextField
          color={backgroundContrastColor}
          className={classes.textField}
          label={inputLabel}
          autoFocus={true}
          variant="outlined"
          onChange={handleChange}
          defaultValue={element}
          inputProps={{ maxLength: maxLength }}
          onKeyPress={handleKeyPress}
        />
      </div>
    </GenericDialog>
  );
}

EnterTextDialog.propTypes = {
  onClose: func.isRequired,
  open: bool.isRequired,
  title: string.isRequired,
  inputLabel: string.isRequired,
  applyText: string.isRequired,
  maxLength: number,
  className: string,
};

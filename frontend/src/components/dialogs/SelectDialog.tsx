import { Button, TextField } from "@mui/material";
import { styled } from "@mui/material/styles";
import { array, string, func, bool } from "prop-types";
import React, { useContext, useState } from "react";

import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import SelectField from "./../general/SelectField";
import GenericDialog from "./GenericDialog";

const StyledSelectField = styled(SelectField)({
  width: "100%",
});

const AdditionalInfoField = styled(TextField)(({ theme }) => ({
  width: "100%",
  marginTop: theme.spacing(2),
}));

const ApplyButton = styled(Button)(({ theme }) => ({
  position: "absolute",
  right: theme.spacing(2),
  top: theme.spacing(1.5),
}));

/*
@values: the possible options of the select field. [{key:String, name:String, additionalInfo: Array}]
@supportAdditionalInfo: declares whether it should be possible to ask the user for additional info when he chooses an option
If @supportAdditionalInfo is true, you can optionally add an 'additionalInfo' property to each element of @values
*/
export default function SelectDialog({
  onClose,
  open,
  title,
  label,
  values,
  supportAdditionalInfo,
  className,
}) {
  const [element, setElement] = useState<any>(null);
  const [additionalInfo, setAdditionalInfo] = useState<any[]>([]);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });

  const handleClose = () => {
    onClose();
  };

  const applyElement = (event) => {
    event.preventDefault();
    onClose(element, additionalInfo);
  };

  const handleSelectChange = (event) => {
    const type = values.filter((x) => x.name === event.target.value)[0];
    const typeAsRequired = {
      key: type.key,
      hide_get_involved: type.hide_get_involved,
    };
    setElement(typeAsRequired);
    if (supportAdditionalInfo) {
      const value = values.filter((val) => val.name === event.target.value)[0];

      if (value.additionalInfo.length > 0) {
        setAdditionalInfo(
          value.additionalInfo.map((x) => {
            return { ...x, value: "" };
          })
        );
      } else {
        setAdditionalInfo([]);
      }
    }
  };

  const handleAdditionalInfoChange = (key, event) => {
    const tempAdditionalInfo = [...additionalInfo];
    tempAdditionalInfo.filter((x) => x.key === key)[0].value = event.target.value;
    setAdditionalInfo(tempAdditionalInfo);
  };

  return (
    <GenericDialog onClose={handleClose} open={open} title={title}>
      <form className={className} onSubmit={applyElement}>
        <StyledSelectField
          required
          color="contrast"
          onChange={handleSelectChange}
          label={label}
          options={values}
        />
        {supportAdditionalInfo &&
          additionalInfo.length > 0 &&
          additionalInfo.map((e, i) => (
            <AdditionalInfoField
              required
              variant="outlined"
              type="text"
              key={i}
              placeholder={additionalInfo[i].name}
              onChange={(e) => handleAdditionalInfoChange(additionalInfo[i].key, e)}
            >
              {additionalInfo[i].value}
            </AdditionalInfoField>
          ))}
        <ApplyButton variant="contained" color="primary" type="submit">
          {texts.add}
        </ApplyButton>
      </form>
    </GenericDialog>
  );
}

SelectDialog.propTypes = {
  onClose: func.isRequired,
  open: bool.isRequired,
  title: string.isRequired,
  label: string.isRequired,
  values: array.isRequired,
  supportAdditionalInfo: bool.isRequired,
  className: string,
};

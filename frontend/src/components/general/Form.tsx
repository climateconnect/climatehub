import {
  Button,
  Checkbox,
  Container,
  IconButton,
  LinearProgress,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { styled, Theme } from "@mui/material/styles";
import KeyboardBackspaceIcon from "@mui/icons-material/KeyboardBackspace";
import Link from "next/link";
import React, { Fragment, ReactElement, useState } from "react";

// Relative imports
import AutoCompleteSearchBar from "../search/AutoCompleteSearchBar";
import LocationSearchBar from "../search/LocationSearchBar";
import RequiredFieldsNotice from "./RequiredFieldsNotice";
import SelectField from "./SelectField";

const blockElementStyles = (theme: Theme) => ({
  display: "block",
  maxWidth: 700,
  height: 56,
  margin: "0 auto",
  marginTop: theme.spacing(2),
});

const Root = styled("div", {
  shouldForwardProp: (prop) => prop !== "$hasCustomClass",
})<{ $hasCustomClass?: boolean }>(({ $hasCustomClass }) =>
  $hasCustomClass
    ? {}
    : {
        maxWidth: 700,
        margin: "0 auto",
      }
);

const BlockRequiredFieldsNotice = styled(RequiredFieldsNotice)(({ theme }) => ({
  ...blockElementStyles(theme),
  height: "auto",
  marginBottom: theme.spacing(1),
  marginTop: 0,
}));

const BlockSelectField = styled(SelectField)(({ theme }) => blockElementStyles(theme));

const BlockLocationSearchBar = styled(LocationSearchBar)(({ theme }) => blockElementStyles(theme));

const BlockTextField = styled(TextField)(({ theme }) => blockElementStyles(theme));

const SubmitButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "$alignRight",
})<{ $alignRight?: boolean }>(({ theme, $alignRight }) =>
  $alignRight
    ? {
        float: "right",
        marginTop: theme.spacing(4),
      }
    : blockElementStyles(theme)
);

const CheckboxWrapper = styled("div")(({ theme }) => ({
  display: "block",
  margin: "0 auto",
  marginTop: theme.spacing(1),
  fontSize: 13,
}));

const CheckboxLabel = styled("label")({
  display: "inline",
});

const FlexBlock = styled("div")({
  display: "flex",
  justifyContent: "space-around",
});

const SwitchTextContainer = styled("span")({
  display: "flex",
  alignItems: "center",
});

const SwitchText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$bold",
})<{ $bold?: boolean }>(({ $bold }) => ({
  textAlign: "center",
  position: "relative",
  ...($bold && { fontWeight: "bold" }),
}));

const BottomMessage = styled("div")({
  textAlign: "center",
  display: "block",
});

const BottomLink = styled(Link)(({ theme }) => ({
  textAlign: "center",
  display: "block",
  color: theme.palette.background.default_contrastText,
}));

//TODO throw error if "label" isn't unique

type Props = {
  fields: {
    required?: boolean;
    label?: string | ReactElement;
    type?: any;
    progressOnFill?: number;
    select?: any;
    key: string;
    multiselect?: any;
    value?: any;
    selectedValues?: any;
    checked?: boolean;
    onlyShowIfChecked?: string;
    bottomLink?: any;
    maxOptions?: number;
    multiple?: boolean;
    multiSelectProps?: any;
    falseLabel?: string;
    trueLabel?: string;
    autoCompleteProps?: any;
    ref?: any;
    handleSetLocationOptionsOpen?: any;
    locationOptionsOpen?: any;
  }[];
  select?: { selectValues: { label: string; value: string }[] };
  messages: {
    submitMessage: string | ReactElement;
    headerMessage?: string | ReactElement;
    bottomMessage?: string | ReactElement;
  };
  bottomLink?: { text: string; href: string };
  formAction?: { href: string; method: string; action?: any };
  usePercentage?: boolean;
  percentage?: number;
  // eslint-disable-next-line no-unused-vars
  onSubmit: (...args: any[]) => void;
  errorMessage?: ReactElement | string | null;
  className?: string;
  alignButtonsRight?: boolean;
  fieldClassName?: string;
  // eslint-disable-next-line no-unused-vars
  onGoBack?: (...args: any[]) => void;
  autocomplete?: string;
};
export default function Form({
  fields,
  messages,
  bottomLink,
  formAction,
  usePercentage,
  percentage,
  onSubmit,
  errorMessage,
  onGoBack,
  alignButtonsRight,
  className,
  fieldClassName,
  autocomplete,
}: Props) {
  const hasRequiredFields = fields.some((field) => !!field.required);
  const [curPercentage, setCurPercentage] = useState(percentage);
  const [values, setValues] = useState(
    fields.reduce((obj, field) => {
      if (field.select) obj[field.key] = field.select.defaultValue ? field.select.defaultValue : "";
      else if (field.multiselect) obj[field.key] = field.selectedValues ? field.selectedValues : [];
      else if (field.value) obj[field.key] = field.value;
      else if (field.type === "checkbox" || field.type === "switch")
        obj[field.key] = field.checked ? field.checked : false;
      else obj[field.key] = "";
      return obj;
    }, {})
  );

  function updatePercentage(customValues?) {
    const filledFields =
      customValues && typeof customValues === "object"
        ? fields.filter((field) => !!customValues[field.key])
        : fields.filter((field) => !!values[field.key]);
    if (filledFields.length) {
      const totalValue = filledFields.reduce((accumulator, curField) => {
        return accumulator + curField.progressOnFill!;
      }, 0);
      setCurPercentage(percentage! + totalValue);
    }
  }

  function handleValueChange(event, key, type, updateInstantly = false) {
    const newValues = {
      ...values,
      [key]: type === "checkbox" || type === "switch" ? event.target.checked : event.target.value,
    };
    if (type === "checkbox" || type === "switch") {
      const dependentFields = fields.filter(
        (f) => f.onlyShowIfChecked && f.onlyShowIfChecked === key
      );
      if (dependentFields.length) dependentFields.map((f) => (newValues[f.key] = ""));
    }
    setValues(newValues);
    //setValues doesn't apply instantly, so we pass the new values to the updatePercentage function
    if (updateInstantly) updatePercentage(newValues);
  }

  function handleLocationChange(newLocation, key) {
    setValues({ ...values, [key]: newLocation });
  }

  function handleBlur() {
    updatePercentage();
  }

  return (
    <Root className={className} $hasCustomClass={!!className}>
      {messages.headerMessage ? (
        <Typography component="h2" variant="subtitle1" sx={{ textAlign: "center" }}>
          {onGoBack && (
            <IconButton
              size="small"
              sx={{ float: "left" }}
              onClick={(event) => onGoBack(event, values)}
            >
              <KeyboardBackspaceIcon />
            </IconButton>
          )}
          {messages.headerMessage}
        </Typography>
      ) : (
        <></>
      )}
      {usePercentage ? (
        <LinearProgress
          value={curPercentage}
          variant="determinate"
          sx={(theme) => ({
            height: 5,
            marginBottom: theme.spacing(3),
            marginTop: theme.spacing(1),
          })}
        />
      ) : (
        <></>
      )}
      <form
        action={formAction && formAction.action}
        method={formAction && formAction.method}
        onSubmit={() => onSubmit(event, values)}
        autoComplete={autocomplete}
      >
        {errorMessage && (
          <Typography component="div" color="error">
            {errorMessage}
          </Typography>
        )}
        {hasRequiredFields && <BlockRequiredFieldsNotice />}
        {fields.map((field) => {
          if (
            (!field.onlyShowIfChecked || values[field.onlyShowIfChecked] === true) &&
            field.select
          ) {
            let options = field.select.values;
            if (field.select.addEmptyValue) options = ["", ...options];
            return (
              <Fragment key={field.key}>
                <BlockSelectField
                  controlledValue={{ name: values[field.key] }}
                  controlled
                  // @ts-ignore - contrast is a custom color defined in theme
                  color="contrast"
                  required={field.required}
                  options={options}
                  label={field.label}
                  className={fieldClassName}
                  key={String(field.label) + fields.indexOf(field)}
                  onChange={() => handleValueChange(event, field.key, field.type, true)}
                />
                {field.bottomLink && field.bottomLink}
              </Fragment>
            );
          } else if (field.multiselect) {
            const options = field.multiselect.values;
            return (
              <Fragment key={field.key}>
                <BlockSelectField
                  disabled={field.selectedValues.length === field.maxOptions}
                  multiple={field.multiple}
                  required={field.required}
                  options={options}
                  color="contrast"
                  label={field.label}
                  className={fieldClassName}
                  key={String(field.label) + fields.indexOf(field)}
                  onChange={(event) => {
                    // we first check if we are reached limit of selected values
                    if (field.selectedValues.length === field.maxOptions) {
                      const isUnselectingValue =
                        field.selectedValues.length >= event.target.value.length;
                      // if we are at limit but want to make a change by removing an item we need to allow user to unselect

                      if (isUnselectingValue) field.multiSelectProps.onChange(event.target.value);
                      // otherwise we just return and don't allow changes to the selectedValues
                      return;
                    }
                    // make changes as usual when user is not at limit
                    field.multiSelectProps.onChange(event.target.value);
                  }}
                  values={field.selectedValues}
                />
                {field.bottomLink && field.bottomLink}
              </Fragment>
            );
          } else if (field.type === "checkbox") {
            return (
              <CheckboxWrapper key={field.key}>
                <Checkbox
                  id={"checkbox" + field.key}
                  checked={values[field.key]}
                  required={field.required}
                  sx={{ display: "inline-block" }}
                  size="small"
                  onBlur={handleBlur}
                  onChange={(event) => handleValueChange(event, field.key, field.type)}
                  // @ts-ignore - contrast is a custom color defined in theme
                  color="contrast"
                />
                <CheckboxLabel htmlFor={"checkbox" + field.key}>{field.label}</CheckboxLabel>
              </CheckboxWrapper>
            );
          } else if (field.type === "switch") {
            return (
              <FlexBlock key={field.key}>
                <SwitchTextContainer>
                  <SwitchText
                    $bold={!values[field.key]}
                    color={values[field.key] ? "secondary" : "contrast"}
                  >
                    {field.falseLabel}
                  </SwitchText>
                </SwitchTextContainer>
                <Switch
                  id={"checkbox" + field.key}
                  checked={values[field.key]}
                  required={field.required}
                  // @ts-ignore - contrast is a custom color defined in theme
                  color="contrast"
                  name="checkedA"
                  inputProps={{ "aria-label": "secondary checkbox" }}
                  onChange={(event) => handleValueChange(event, field.key, field.type)}
                />
                <SwitchTextContainer>
                  <SwitchText
                    $bold={!!values[field.key]}
                    color={values[field.key] ? "constrast" : "secondary"}
                  >
                    {field.trueLabel}
                  </SwitchText>
                </SwitchTextContainer>
              </FlexBlock>
            );
          } else if (field.type === "location") {
            return (
              <BlockLocationSearchBar
                key={field.key}
                label={field.label}
                required={field.required}
                onSelect={(value) => handleLocationChange(value, field.key)}
                onChange={(value) => handleLocationChange(value, field.key)}
                initialValue={field.value}
                locationInputRef={field.ref}
                handleSetOpen={field.handleSetLocationOptionsOpen}
                open={field.locationOptionsOpen}
                className={fieldClassName}
              />
            );
          } else if (
            (!field.onlyShowIfChecked || values[field.onlyShowIfChecked] === true) &&
            field.type === "autocomplete"
          ) {
            return (
              <AutoCompleteSearchBar
                /*TODO(unused) required={field.required} */
                /*TODO(unused) autoFocus={field === fields[0]} */
                label={field.autoCompleteProps.label}
                key={field.key}
                color="contrast"
                freeSolo={field.autoCompleteProps.freeSolo}
                baseUrl={field.autoCompleteProps.baseUrl}
                clearOnSelect={field.autoCompleteProps.clearOnSelect}
                onSelect={field.autoCompleteProps.onSelect}
                renderOption={field.autoCompleteProps.renderOption}
                getOptionLabel={field.autoCompleteProps.getOptionLabel}
                filterOut={field.autoCompleteProps.filterOut}
                helperText={field.autoCompleteProps.helperText}
                onUnselect={field.autoCompleteProps.onUnselect}
              />
            );
          } else if (!field.onlyShowIfChecked || values[field.onlyShowIfChecked] === true) {
            return (
              <Fragment key={field.key}>
                <BlockTextField
                  required={field.required}
                  fullWidth
                  autoFocus={field === fields[0]}
                  label={field.label}
                  type={field.type}
                  variant="outlined"
                  value={values[field.key]}
                  className={fieldClassName}
                  onBlur={handleBlur}
                  onChange={() => handleValueChange(event, field.key, field.type)}
                  // @ts-ignore - contrast is a custom color defined in theme
                  color="contrast"
                />
                {field.bottomLink && field.bottomLink}
              </Fragment>
            );
          }
        })}
        <SubmitButton
          fullWidth={!alignButtonsRight}
          variant="contained"
          type="submit"
          color="primary"
          $alignRight={alignButtonsRight}
        >
          {messages.submitMessage}
        </SubmitButton>
      </form>
      {messages.bottomMessage || bottomLink ? (
        <Container sx={(theme) => ({ marginTop: theme.spacing(2) })}>
          {messages.bottomMessage ? <BottomMessage>{messages.bottomMessage}</BottomMessage> : <></>}
          {bottomLink ? <BottomLink href={bottomLink.href}>{bottomLink.text}</BottomLink> : <></>}
        </Container>
      ) : (
        <></>
      )}
    </Root>
  );
}

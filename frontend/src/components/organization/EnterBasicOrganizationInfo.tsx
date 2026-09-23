import { IconButton, Chip, Tooltip } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import React, { useContext, useState } from "react";
import { getLocationFields } from "../../../public/lib/locationOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import Form from "./../general/Form";

const renderSearchOption = ({ key, ...props }, option) => {
  return (
    <li key={key} {...props}>
      <IconButton size="large">
        <AddCircleOutlineIcon />
      </IconButton>
      {option.name}
    </li>
  );
};

const useStyles = makeStyles((theme) => ({
  selectedTypes: {
    marginTop: theme.spacing(1),
    display: "flex",
    justifyContent: "space-evenly",

    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      marginTop: theme.spacing(0),
      alignItems: "center",
    },
  },
  formWrapper: {
    marginTop: theme.spacing(8),
    padding: theme.spacing(2),
  },
  chip: {
    height: 30,
    width: "100%",

    [theme.breakpoints.down("md")]: {
      marginTop: theme.spacing(1),
    },
  },
  lastChip: {
    height: 30,
    width: "100%",
    marginLeft: theme.spacing(0.5),
    [theme.breakpoints.down("md")]: {
      marginTop: theme.spacing(1),
    },
  },
}));

export default function EnterBasicOrganizationInfo({
  errorMessage,
  handleSubmit,
  organizationInfo,
  locationInputRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
  tagOptions,
  handleSaveAsDraft,
  loadingSubmitDraft,
}) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "organization", locale: locale });
  const [parentOrganization, setParentOrganization] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState([]);

  const handleChangeTypes = (newValue) => {
    setSelectedTypes(newValue);
  };
  const handleRemoveType = (item) => {
    setSelectedTypes(selectedTypes.filter((value) => value !== item));
  };
  const onUnselect = () => {
    if (parentOrganization) setParentOrganization(null);
  };
  const getOptionLabel = (option) => option.name;
  const fields = [
    {
      required: true,
      label: texts.organization_name,
      key: "organizationname",
      type: "text",
      value: organizationInfo["name"],
    },
    {
      label: texts.we_are_a_sub_organization_of_a_larger_organization,
      key: "hasparentorganization",
      type: "checkbox",
      checked: false,
      value: organizationInfo["hasparentorganization"],
    },
    {
      required: true,
      label: texts.parent_organization_name,
      key: "parentorganizationname",
      type: "autocomplete",
      autoCompleteProps: {
        label: texts.search_for_your_parent_organization,
        baseUrl: process.env.API_URL + "/api/organizations/?search=",
        onSelect: setParentOrganization,
        renderOption: renderSearchOption,
        getOptionLabel: getOptionLabel,
        helperText: texts.type_the_name_of_your_parent_organization,
        onUnselect: onUnselect,
        filterOut: [],
      },
      onlyShowIfChecked: "hasparentorganization",
      value: organizationInfo["parentorganizationname"],
    },
    ...getLocationFields({
      locationInputRef: locationInputRef,
      locationOptionsOpen: locationOptionsOpen,
      handleSetLocationOptionsOpen: handleSetLocationOptionsOpen,
      values: organizationInfo,
      locationKey: "location",
      texts: texts,
    }),
    {
      required: true,
      label: texts.add_up_to_two_types,
      multiselect: {
        values: tagOptions,
      },
      selectedValues: selectedTypes,
      multiSelectProps: {
        onChange: handleChangeTypes,
        renderValue: "",
      },
      maxOptions: 2,
      multiple: true,
      key: "orgtypes",
      bottomLink: (
        <div className={classes.selectedTypes}>
          {selectedTypes.map((selectedType, index) => (
            <Tooltip placement="top" arrow title={selectedType} key={index}>
              <Chip
                className={index === 1 ? classes.lastChip : classes.chip}
                label={selectedType}
                color="secondary"
                onDelete={() => handleRemoveType(selectedType)}
                key={index}
              />
            </Tooltip>
          ))}
        </div>
      ),
    },
    {
      required: true,
      label: texts.i_verify_that_i_am_an_authorized_representative_of_this_organization,
      key: "verified",
      type: "checkbox",
      value: organizationInfo["verified"],
    },
  ];

  const messages = {
    submitMessage: texts.next_step,
    secondarySubmitMessage: texts.save_as_draft,
  };

  return (
    <div className={classes.formWrapper}>
      <Form
        fields={fields}
        messages={messages}
        usePercentage={false}
        onSubmit={(event, account) =>
          handleSubmit(event, {
            ...account,
            parentOrganization: parentOrganization,
            types: convertTypeNamesToObject(selectedTypes, tagOptions),
          })
        }
        onSecondarySubmit={
          handleSaveAsDraft &&
          ((values) =>
            handleSaveAsDraft({
              ...values,
              parentOrganization: parentOrganization,
              types: convertTypeNamesToObject(selectedTypes, tagOptions),
            }))
        }
        loadingSecondarySubmit={loadingSubmitDraft}
        secondarySubmitEnabledField="organizationname"
        errorMessage={errorMessage}
      />
    </div>
  );
}

function convertTypeNamesToObject(selectedTypesArr, types) {
  const intersectingTypes = types.filter((type) => selectedTypesArr.includes(type.name));
  const convertedList = intersectingTypes.map((type) => ({
    key: type.key,
    hide_get_involved: type.hide_get_involved,
  }));
  return convertedList;
}

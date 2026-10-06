import { IconButton, Chip, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
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

const SelectedTypes = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(1),
  display: "flex",
  justifyContent: "space-evenly",

  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    marginTop: theme.spacing(0),
    alignItems: "center",
  },
}));

const FormWrapper = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(8),
  padding: theme.spacing(2),
}));

const TypeChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "$isLast",
})<{ $isLast?: boolean }>(({ theme, $isLast }) => ({
  height: 30,
  width: "100%",
  ...($isLast && { marginLeft: theme.spacing(0.5) }),

  [theme.breakpoints.down("md")]: {
    marginTop: theme.spacing(1),
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
}) {
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
        <SelectedTypes>
          {selectedTypes.map((selectedType, index) => (
            <Tooltip placement="top" arrow title={selectedType} key={index}>
              <TypeChip
                $isLast={index === 1}
                label={selectedType}
                color="secondary"
                onDelete={() => handleRemoveType(selectedType)}
                key={index}
              />
            </Tooltip>
          ))}
        </SelectedTypes>
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
  };

  return (
    <FormWrapper>
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
        errorMessage={errorMessage}
      />
    </FormWrapper>
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

import { Button, TextField, Theme, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useState, Fragment } from "react";
import getRadiusFilterOptions from "../../../public/data/radiusFilterOptions";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { FilterContext } from "../context/FilterContext";
import MultiLevelSelectDialog from "../dialogs/MultiLevelSelectDialog";
import SelectField from "../general/SelectField";
import LocationSearchBar from "../search/LocationSearchBar";
import FilterSearchBar from "../filter/FilterSearchBar";
import LocationSearchingIcon from "@mui/icons-material/LocationSearching";

const shouldForwardProp = (prop: PropertyKey) => typeof prop !== "string" || !prop.startsWith("$");

const IconLabelContainer = styled("div")({
  display: "flex",
  alignItems: "center",
});

const IconLabelText = styled("span")(({ theme }) => ({
  marginLeft: theme.spacing(0.5),
}));

const FilterTextField = styled(TextField, { shouldForwardProp })<{
  $isInOverlay?: boolean;
  $hasValue?: boolean;
}>(({ theme, $isInOverlay, $hasValue }) => ({
  display: "flex",
  width: 190,
  minWidth: 220,
  minHeight: 40,
  ...($isInOverlay && {
    marginBottom: theme.spacing(2),
    width: "100%",
  }),
  ...($hasValue && {
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.primary.main,
      borderWidth: 2,
    },
  }),
}));

const FilterSelectField = styled(SelectField, { shouldForwardProp })<{
  $isInOverlay?: boolean;
  $hasValue?: boolean;
}>(({ theme, $isInOverlay, $hasValue }) => ({
  display: "flex",
  width: 190,
  minWidth: 220,
  minHeight: 40,
  ...($isInOverlay && {
    marginBottom: theme.spacing(2),
    width: "100%",
  }),
  ...($hasValue && {
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.primary.main,
      borderWidth: 2,
    },
  }),
}));

const OpenMultiSelectButton = styled(Button, { shouldForwardProp })<{
  $isInOverlay?: boolean;
}>(({ theme, $isInOverlay }) => ({
  border: `1px solid ${theme.palette.grey[500]} !important`,
  minHeight: 40,
  ...($isInOverlay && {
    marginBottom: theme.spacing(2),
    width: "100%",
  }),
}));

const LocationFieldWrapper = styled("div", { shouldForwardProp })<{
  $isInOverlay?: boolean;
}>(({ theme, $isInOverlay }) => ({
  display: "flex",
  borderRadius: 0,
  ...($isInOverlay && {
    marginBottom: theme.spacing(2),
    width: "100%",
  }),
  // Autocomplete root (formerly inputClassName)
  "& .MuiAutocomplete-root": $isInOverlay
    ? { flexGrow: 1 }
    : {
        display: "flex",
        width: 330,
        minWidth: 220,
      },
  // Location input root (formerly textFieldClassName)
  "& .MuiAutocomplete-root .MuiOutlinedInput-root": {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRight: 0,
  },
}));

const LocationContainer = styled(LocationSearchBar)({
  display: "contents",
});

const RadiusField = styled(SelectField, { shouldForwardProp })<{
  $isMobileScreen?: boolean;
}>(({ $isMobileScreen }) => ({
  ...(!$isMobileScreen && { width: "100px" }),
  flex: $isMobileScreen ? "0 0 33%" : "initial",
  "& .MuiOutlinedInput-root": {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: 0,
  },
}));

const SearchFirstLine = styled("div")(({ theme }) => ({
  display: "flex",
  marginBottom: theme.spacing(0.5),
  maxWidth: 650,
  justifyContent: "center",
}));

const SearchWrapper = styled("div")({
  display: "flex",
  maxWidth: 650,
  width: 230,
});

const ErrorMessageWrapper = styled("div")(({ theme }) => ({
  textAlign: "center",
  marginBottom: theme.spacing(1),
}));

const FlexContainer = styled("div", { shouldForwardProp })<{
  $justifyContent?: string;
  $isInOverlay?: boolean;
}>(({ theme, $justifyContent, $isInOverlay }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "16px 8px",
  justifyContent: $justifyContent,
  alignItems: "flex-start",
  ...($isInOverlay && {
    flexDirection: "column",
    marginTop: theme.spacing(2),
  }),
}));

// Helper component for icon labels
const IconLabel = ({ Icon, title }) => {
  return (
    <IconLabelContainer>
      <Icon fontSize="inherit" />
      <IconLabelText>{title}</IconLabelText>
    </IconLabelContainer>
  );
};

// Text filter component
const TextFilter = ({ filter, value, onChange, isInOverlay }) => {
  return (
    <FilterTextField
      label={<IconLabel Icon={filter.icon} title={filter.title} />}
      type="text"
      value={value}
      $isInOverlay={isInOverlay}
      $hasValue={!!value}
      variant="outlined"
      size="small"
      onChange={(event) => onChange(filter.key, event.target.value)}
    />
  );
};

// Select/Multiselect filter component
const SelectFilter = ({ filter, value, onChange, isInOverlay }) => {
  const isMultiselect = filter.type === "multiselect";
  return (
    <FilterSelectField
      options={filter.options}
      $isInOverlay={isInOverlay}
      $hasValue={!!(value && value.length)}
      multiple={isMultiselect}
      values={isMultiselect && value}
      controlled={!isMultiselect}
      controlledValue={!isMultiselect && value}
      label={<IconLabel Icon={filter.icon} title={filter.title} />}
      size="small"
      isInOverlay={isInOverlay}
      onChange={(event) => onChange(filter.key, event.target.value)}
    />
  );
};

// Multi-level select dialog button component
const MultiSelectDialogFilter = ({
  filter,
  selectedItems,
  setSelectedItems,
  open,
  handleClickDialogOpen,
  handleClickDialogClose,
  handleClickDialogSave,
  isInOverlay,
  texts,
}) => {
  const curSelectedItems = selectedItems[filter.key];

  const handleSetSelectedItems = (newSelectedItems) => {
    setSelectedItems({
      ...selectedItems,
      [filter.key]: newSelectedItems,
    });
  };

  return (
    <>
      <OpenMultiSelectButton
        variant="outlined"
        color="grey"
        $isInOverlay={isInOverlay}
        onClick={() => handleClickDialogOpen(filter.key)}
      >
        {filter.title}
      </OpenMultiSelectButton>
      <MultiLevelSelectDialog
        options={filter.options}
        onClose={() => handleClickDialogClose(filter.key)}
        onSave={(selectedItems) => handleClickDialogSave(filter.key, selectedItems)}
        open={open[filter.key] || false}
        selectedItems={curSelectedItems}
        setSelectedItems={handleSetSelectedItems}
        type={filter.itemType}
        title={texts["add_" + filter.itemType.replace(" ", "_")]}
      />
    </>
  );
};

// Location filter component
const LocationFilter = ({
  isMobileScreen,
  filter,
  value,
  radiusValue,
  onChange,
  isInOverlay,
  locationInputRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
}) => {
  const radiusFilterOptions = getRadiusFilterOptions();

  return (
    <LocationFieldWrapper $isInOverlay={isInOverlay}>
      <LocationContainer
        smallInput
        onSelect={(location) => onChange(filter.key, location)}
        value={value}
        onChange={(value) => onChange(filter.key, value)}
        locationInputRef={locationInputRef}
        open={locationOptionsOpen}
        handleSetOpen={handleSetLocationOptionsOpen}
        filterMode
        label={<IconLabel Icon={filter.icon} title={filter.title} />}
      />
      <RadiusField
        $isMobileScreen={isMobileScreen}
        label={<LocationSearchingIcon fontSize="inherit" />}
        options={radiusFilterOptions}
        controlled
        controlledValue={{ name: radiusValue }}
        size="small"
        onChange={(event) => onChange("radius", event.target.value)}
        sx={{
          "& .MuiSelect-select": {
            paddingRight: "10px !important",
          },
          "& .MuiNativeSelect-select": {
            paddingRight: "10px !important",
          },
        }}
      />
    </LocationFieldWrapper>
  );
};

//Search e.g Projects, Organizations and members name on Browse page
const SearchSectionFilter = ({ label, onSubmit, value, onChange, isMobileScreen, type }) => {
  const isMediumScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.between("md", 1187));
  const SearchContainer = isMediumScreen ? SearchFirstLine : SearchWrapper;
  // Don't render on narrow screens
  if (isMobileScreen) {
    return null;
  }
  return (
    <SearchContainer>
      <FilterSearchBar
        label={label}
        onSubmit={onSubmit}
        type={type}
        value={value}
        onChange={onChange}
      />
    </SearchContainer>
  );
};
// Main component
export default function Filters({
  errorMessage,
  handleClickDialogClose,
  handleClickDialogOpen,
  handleClickDialogSave,
  handleSetLocationOptionsOpen,
  handleValueChange,
  isInOverlay,
  justifyContent,
  locationInputRef,
  locationOptionsOpen,
  open,
  possibleFilters,
  selectedItems,
  setSelectedItems,
  searchSubmit,
  searchType,
}: any) {
  const { locale } = useContext(UserContext);
  const isMobileScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));

  const { filters: currentFilters } = useContext(FilterContext);
  const texts = getTexts({ page: "filter_and_search", locale: locale, filterType: searchType });
  const [searchValue, setSearchValue] = useState(currentFilters.search || "");
  const shouldShowFilter = (filter) => {
    if (!filter.showIf) return true;
    return currentFilters[filter.showIf.key] === filter.showIf.value;
  };
  const handleSearchValueChange = (e) => {
    e.preventDefault();
    setSearchValue(e.target.value);
  };
  const renderFilter = (filter) => {
    const currentFilterValue = currentFilters[filter.key];

    let component;

    switch (filter.type) {
      case "text":
        component = (
          <TextFilter
            filter={filter}
            value={currentFilterValue}
            onChange={handleValueChange}
            isInOverlay={isInOverlay}
          />
        );
        break;

      case "select":
      case "multiselect":
        component = (
          <SelectFilter
            filter={filter}
            value={currentFilterValue}
            onChange={handleValueChange}
            isInOverlay={isInOverlay}
          />
        );
        break;

      case "openMultiSelectDialogButton":
        if (!shouldShowFilter(filter)) return null;

        component = (
          <MultiSelectDialogFilter
            filter={filter}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            open={open}
            handleClickDialogOpen={handleClickDialogOpen}
            handleClickDialogClose={handleClickDialogClose}
            handleClickDialogSave={handleClickDialogSave}
            isInOverlay={isInOverlay}
            texts={texts}
          />
        );
        break;

      case "location":
        component = (
          <LocationFilter
            filter={filter}
            value={currentFilterValue}
            radiusValue={currentFilters.radius}
            onChange={handleValueChange}
            isInOverlay={isInOverlay}
            isMobileScreen={isMobileScreen}
            locationInputRef={locationInputRef}
            locationOptionsOpen={locationOptionsOpen}
            handleSetLocationOptionsOpen={handleSetLocationOptionsOpen}
          />
        );
        break;
      case "search":
        component = (
          <SearchSectionFilter
            label={texts.search_label}
            onSubmit={searchSubmit}
            value={searchValue}
            onChange={handleSearchValueChange}
            isMobileScreen={isMobileScreen}
            type={searchType}
          />
        );
        break;
      default:
        return null;
    }

    if (filter.tooltipText) {
      return (
        <Tooltip arrow placement="top" title={filter.tooltipText} key={filter.key}>
          <span>{component}</span>
        </Tooltip>
      );
    }

    return <Fragment key={filter.key}>{component}</Fragment>;
  };

  return (
    <>
      {errorMessage && (
        <ErrorMessageWrapper>
          <Typography color="error">{errorMessage}</Typography>
        </ErrorMessageWrapper>
      )}

      <FlexContainer $justifyContent={justifyContent || "space-around"} $isInOverlay={isInOverlay}>
        {possibleFilters.map(renderFilter)}
      </FlexContainer>
    </>
  );
}

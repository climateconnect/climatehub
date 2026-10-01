import { Chip, Tooltip } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import { getLocationFilterKeys } from "../../../public/data/locationFilters";

const SelectedBlock = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  marginBottom: theme.spacing(1),
  marginTop: theme.spacing(1),
  flexWrap: "wrap",
}));

const SelectedChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(1),
  "&:first-child": {
    marginLeft: 0,
  },
}));

const SelectedChipIcon = styled("img")({
  width: 20,
  height: 20,
});

export default function SelectedFilter({
  filterKey,
  currentFilters,
  possibleFilters,
  handleUnselectFilter,
}) {
  let currentFilterValues = currentFilters[filterKey];
  const locationFilterKeys = getLocationFilterKeys();
  const possibleFilterKeys = possibleFilters.map((entry) => entry.key);
  // Get the metadata associated with the filter (e.g. what type it is, like "Category")
  const filterMetadata = possibleFilters.find((f) => f.key === filterKey);
  //When the location is a string the filter is not submitted yet (the user is just typing)
  //Therefore only show location as a selected filter if it's an object
  if (filterMetadata?.type === "location") {
    if (typeof currentFilterValues !== "object" || locationFilterKeys.includes(filterKey)) {
      return <></>;
    }
  }
  if (filterMetadata?.type === "select") {
    return <></>;
  }
  if (filterKey === "search") {
    return <></>;
  }
  if (
    !currentFilterValues ||
    (typeof currentFilterValues !== "object" && !currentFilterValues.length)
  ) {
    return <></>;
  }

  if (!Array.isArray(currentFilterValues)) {
    currentFilterValues = [currentFilterValues];
  }
  return (
    <SelectedBlock key={filterKey}>
      {/* Handle strings like "Energy" as being selected too */}
      {possibleFilterKeys.includes(filterKey) &&
        currentFilterValues.map((filter) => {
          /*the location filter either has the 'name' or 'simple_name' prop set
          depending on whether it was caught as the initial location or not*/
          const filterName =
            typeof filter === "object" ? (filter.name ? filter.name : filter.simple_name) : filter;

          // Find matching metadata by original_name or name
          const matchedOption = filterMetadata?.options?.find(
            (opt) => opt.original_name === filterName || opt.name === filterName
          );
          const iconUrl = matchedOption ? matchedOption?.icon : null;
          return (
            <Tooltip title={filterMetadata.title} key={filterName}>
              <SelectedChip
                icon={
                  iconUrl ? (
                    <SelectedChipIcon src={iconUrl} alt={`${filterName} icon`} />
                  ) : (
                    <filterMetadata.icon name={filterMetadata.iconName} />
                  )
                }
                label={filterName}
                color="secondary"
                onDelete={() => handleUnselectFilter(filter, filterMetadata.key)}
              />
            </Tooltip>
          );
        })}
    </SelectedBlock>
  );
}

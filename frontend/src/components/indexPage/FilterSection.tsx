import { Badge, Button, useMediaQuery, Theme } from "@mui/material";
import { styled } from "@mui/material/styles";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import TuneIcon from "@mui/icons-material/Tune";
import React, { useContext, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import FilterSearchBar from "../filter/FilterSearchBar";
import { BrowseEntity } from "../../types";
import { FilterContext } from "../context/FilterContext";

type StyleProps = {
  $applyBackgroundColor?: boolean;
};

const shouldForwardProp = (prop: PropertyKey) => typeof prop !== "string" || !prop.startsWith("$");

const FilterButton = styled(Button, { shouldForwardProp })<StyleProps>(
  ({ $applyBackgroundColor }) => ({
    borderColor: "#707070",
    height: 40,
    ...($applyBackgroundColor && { background: "rgba(255, 255, 255, 0.9)" }),
  })
);

const FilterSectionFirstLine = styled("div")(({ theme }) => ({
  display: "flex",
  marginBottom: theme.spacing(2),
  maxWidth: 650,
  margin: "0 auto",
  justifyContent: "center",
}));

const SearchBarContainer = styled("div")({
  display: "flex",
  flexGrow: 1,
  alignItems: "center",
  justifyContent: "center",
});

const StyledFilterSearchBar = styled(FilterSearchBar, { shouldForwardProp })<StyleProps>(
  ({ theme, $applyBackgroundColor }) => ({
    width: "100%",
    maxWidth: 650,
    margin: "0 auto",
    marginRight: theme.spacing(2),
    borderColor: "#000",
    ...($applyBackgroundColor && { background: "rgba(255, 255, 255, 0.9)" }),
    "& .MuiOutlinedInput-root, & .MuiInputLabel-root, & .MuiOutlinedInput-notchedOutline": {
      color: "black !important",
      borderColor: "black !important",
    },
  })
);

type Props = {
  filtersExpanded: boolean;
  onSubmit: Function;
  setFiltersExpanded: Function;
  type: BrowseEntity;
  customSearchBarLabels?: Record<BrowseEntity, string>;
  applyBackgroundColor?: boolean;
  activeFilterCount?: number;
};

export default function FilterSection({
  filtersExpanded,
  onSubmit,
  setFiltersExpanded,
  type,
  customSearchBarLabels,
  applyBackgroundColor = false,
  activeFilterCount = 0,
}: Props) {
  const { locale } = useContext(UserContext);
  const { filters } = useContext(FilterContext);
  const [value, setValue] = useState(filters.search || "");
  const texts = getTexts({ page: "filter_and_search", locale: locale });
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const defaultSearchBarLabels = {
    projects: texts.search_projects,
    organizations: texts.search_organizations,
    members: texts.search_active_people,
  };

  const searchBarLabel = customSearchBarLabels?.[type] ?? defaultSearchBarLabels[type];

  const handleToggleFilters = () => {
    setFiltersExpanded(!filtersExpanded);
  };

  const handleChangeValue = (e) => {
    e.preventDefault();
    setValue(e.target.value);
  };
  const FilterIcon = filtersExpanded ? HighlightOffIcon : TuneIcon;

  return (
    <>
      <FilterSectionFirstLine>
        <SearchBarContainer>
          <StyledFilterSearchBar
            $applyBackgroundColor={applyBackgroundColor}
            label={searchBarLabel}
            onSubmit={onSubmit}
            type={type}
            value={value}
            onChange={handleChangeValue}
          />
        </SearchBarContainer>
        {isNarrowScreen && (
          <Badge
            badgeContent={activeFilterCount > 0 ? activeFilterCount : null}
            color="secondary"
            max={9}
            aria-label={activeFilterCount > 0 ? `${activeFilterCount} active filters` : undefined}
          >
            <FilterButton
              variant="outlined"
              color="grey"
              $applyBackgroundColor={applyBackgroundColor}
              onClick={handleToggleFilters}
              startIcon={
                <FilterIcon
                  sx={(theme) => ({ color: theme.palette.background.default_contrastText })}
                />
              }
            >
              Filter
            </FilterButton>
          </Badge>
        )}
      </FilterSectionFirstLine>
    </>
  );
}

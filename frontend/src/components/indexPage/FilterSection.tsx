import { Badge, Button, useMediaQuery, Theme } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import TuneIcon from "@mui/icons-material/Tune";
import React, { useContext, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import FilterSearchBar from "../filter/FilterSearchBar";
import { BrowseEntity } from "../../types";
import { FilterContext } from "../context/FilterContext";

type MakeStylesProps = {
  applyBackgroundColor?: boolean;
};

const useStyles = makeStyles((theme) => {
  return {
    filterButton: (props: MakeStylesProps) => ({
      borderColor: "#707070",
      height: 40,
      background: props.applyBackgroundColor ? "rgba(255, 255, 255, 0.9)" : "default",
    }),
    filterSectionFirstLine: {
      display: "flex",
      marginBottom: theme.spacing(2),
      maxWidth: 650,
      margin: "0 auto",
      justifyContent: "center",
    },
    searchBarContainer: {
      display: "flex",
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    filterSearchbar: (props: MakeStylesProps) => ({
      marginRight: theme.spacing(2),
      width: "100%",
      maxWidth: 650,
      margin: "0 auto",
      borderColor: "#000",
      background: props.applyBackgroundColor ? "rgba(255, 255, 255, 0.9)" : "default",
    }),
    inputLabel: {
      color: "black !important",
      borderColor: "black !important",
    },
    icon: {
      color: theme.palette.background.default_contrastText,
    },
  };
});

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
  const classes = useStyles({
    applyBackgroundColor: applyBackgroundColor,
  });
  const defaultSearchBarLabels = {
    projects: texts.search_projects,
    organizations: texts.search_organizations,
    members: texts.search_active_people,
  };

  const searchBarLabel = customSearchBarLabels?.[type] ?? defaultSearchBarLabels[type];

  const InputLabelClasses = {
    root: classes.inputLabel,
    notchedOutline: classes.inputLabel,
  };

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
      <div className={classes.filterSectionFirstLine}>
        <div className={classes.searchBarContainer}>
          <FilterSearchBar
            className={classes.filterSearchbar}
            InputLabelClasses={InputLabelClasses}
            label={searchBarLabel}
            onSubmit={onSubmit}
            type={type}
            value={value}
            onChange={handleChangeValue}
          />
        </div>
        {isNarrowScreen && (
          <Badge
            badgeContent={activeFilterCount > 0 ? activeFilterCount : null}
            color="secondary"
            max={9}
            aria-label={activeFilterCount > 0 ? `${activeFilterCount} active filters` : undefined}
          >
            <Button
              variant="outlined"
              color="grey"
              className={classes.filterButton}
              onClick={handleToggleFilters}
              startIcon={<FilterIcon className={classes.icon} />}
            >
              Filter
            </Button>
          </Badge>
        )}
      </div>
    </>
  );
}

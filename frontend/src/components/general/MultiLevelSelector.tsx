import {
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Theme,
  Typography,
} from "@mui/material";
import { styled, SxProps } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import React, { Fragment, useContext, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import FilterSearchBar from "../filter/FilterSearchBar";

const transientProps = (prop: PropertyKey) => typeof prop !== "string" || !prop.startsWith("$");

const Wrapper = styled("div", { shouldForwardProp: transientProps })<{
  $flexWrapper?: boolean;
  $marginTop?: boolean;
}>(({ theme, $flexWrapper, $marginTop }) => ({
  margin: "0 auto",
  display: $flexWrapper ? "flex" : "block",
  marginTop: $marginTop ? theme.spacing(8) : 0,
  [theme.breakpoints.down("md")]: {
    marginTop: theme.spacing(4),
    display: "block",
  },
}));

const StyledDivider = styled(Divider)(({ theme }) => ({
  borderColor: "black",
  marginBottom: theme.spacing(1),
}));

const SelectedWrapper = styled("div", { shouldForwardProp: transientProps })<{
  $narrow?: boolean;
}>(({ theme, $narrow }) => ({
  display: "inline-block",
  verticalAlign: "top",
  marginLeft: theme.spacing(16),
  [theme.breakpoints.down("lg")]: {
    marginLeft: theme.spacing(2),
  },
  ...($narrow && {
    marginLeft: theme.spacing(2),
    display: "block",
    margin: "0 auto",
    textAlign: "center",
  }),
}));

const StyledFilterSearchBar = styled(FilterSearchBar)({
  display: "block",
  width: "100%",
});

// Shared by the selectable list items and the selected items
const listItemStyles = (theme: Theme) => ({
  border: "1px solid black",
  borderTop: 0,
  height: theme.spacing(8),
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(1),
});

const SelectedItemButton = styled(ListItemButton)(({ theme }) => ({
  ...listItemStyles(theme),
  background: theme.palette.background.default_contrastText,
  color: "white",
  marginBottom: theme.spacing(1),
  borderTop: "1px solid black",
  "&:hover": {
    backgroundColor: theme.palette.background.default_contrastText,
    color: "white",
  },
}));

const SelectedItemIcon = styled(ListItemIcon)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  color: "white",
}));

type ListRootKind = "list" | "subList" | "narrowSubList" | "hidden";

const ListRoot = styled(List, { shouldForwardProp: transientProps })<{
  $kind: ListRootKind | false;
  $offset?: number;
  $narrowWrapper?: boolean;
}>(({ theme, $kind, $offset, $narrowWrapper }) => ({
  ...($kind === "list" && {
    display: "inline-block",
    [theme.breakpoints.down("lg")]: {
      marginLeft: theme.spacing(0),
    },
  }),
  ...($kind === "subList" && {
    display: "inline-block",
    marginTop: theme.spacing(($offset ?? 0) * 8),
    verticalAlign: "top",
    maxWidth: "50%",
  }),
  ...($kind === "narrowSubList" && {
    display: "block",
    padding: 0,
    width: "90%",
    marginLeft: "10%",
  }),
  ...($kind === "hidden" && {
    display: "none",
  }),
  ...($narrowWrapper && {
    maxWidth: `650 - ${theme.spacing(8)}`,
    width: "auto",
    display: "block",
    margin: "0 auto",
  }),
}));

const ChooseListItemButton = styled(ListItemButton, { shouldForwardProp: transientProps })<{
  $first?: boolean;
  $isSubList?: boolean;
  $narrowSubList?: boolean;
  $borderLeft?: boolean;
  $lastSubItem?: "final" | "last" | false;
  $underExpandedSubList?: boolean;
}>(
  ({
    theme,
    $first,
    $isSubList,
    $narrowSubList,
    $borderLeft,
    $lastSubItem,
    $underExpandedSubList,
  }) => ({
    ...listItemStyles(theme),
    ...($isSubList && { borderLeft: 0 }),
    ...($first && { borderTop: "1px solid black" }),
    ...($narrowSubList && {
      borderLeft: "1px solid black",
      borderTop: 0,
    }),
    ...($borderLeft && { borderLeft: "1px solid black" }),
    ...($lastSubItem === "last" && { borderBottom: 0 }),
    // Ensure there's border on the last sublist item,
    // on the last parent list item. See GitHub issue #312
    ...($lastSubItem === "final" && { borderBottom: "1px solid black" }),
    ...($underExpandedSubList && { borderTop: "1px solid black" }),
    "&.Mui-selected": {
      color: theme.palette.secondary.main,
    },
  })
);

const getIconSx = (isExpanded: boolean): SxProps<Theme> => [
  { margin: "0 auto" },
  (theme: Theme) => (isExpanded ? { color: theme.palette.secondary.main } : {}),
];

export default function MultiLevelSelector({
  isInPopup,
  itemNamePlural,
  itemsToSelectFrom,
  maxSelections,
  selected,
  setSelected,
}: any) {
  const [expanded, setExpanded] = useState(null);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "filter_and_search", locale: locale });

  const onClickExpand = (key) => {
    if (expanded === key) setExpanded(null);
    else setExpanded(key);
  };

  const onClickSelect = (item) => {
    if (selected.length >= maxSelections) {
      alert(texts.point_out_max_selections + " " + maxSelections + " " + itemNamePlural);
    } else {
      setSelected([...selected, item]);
    }
  };

  const onClickUnselect = (item) => {
    // When dismissing a selected filter chip, we also want to update the
    // window state to reflect the currently active filters, and fetch
    // the updated data from the server.
    setSelected(
      selected
        .slice(0, selected.indexOf(item))
        .concat(selected.slice(selected.indexOf(item) + 1, selected.length))
    );
  };

  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  return (
    <>
      <Wrapper $flexWrapper={!isInPopup} $marginTop={!isInPopup}>
        {(isNarrowScreen || isInPopup) && (
          <>
            <SelectedList
              selected={selected}
              itemNamePlural={itemNamePlural}
              maxSelections={maxSelections}
              onClickUnselect={onClickUnselect}
              narrow
              texts={texts}
            />
            {selected.length > 0 && <StyledDivider />}
          </>
        )}

        <ListToChooseWrapper
          itemsToSelectFrom={itemsToSelectFrom}
          onClickExpand={onClickExpand}
          expanded={expanded}
          onClickSelect={onClickSelect}
          selected={selected}
          isNarrowScreen={isNarrowScreen}
          isInPopup={isInPopup}
          //TODO(unused) className={classes.listWrapper}
          texts={texts}
        />

        {!(isNarrowScreen || isInPopup) && (
          <SelectedList
            selected={selected}
            itemNamePlural={itemNamePlural}
            maxSelections={maxSelections}
            onClickUnselect={onClickUnselect}
            texts={texts}
          />
        )}
      </Wrapper>
    </>
  );
}

function ListToChooseWrapper({
  itemsToSelectFrom,
  onClickExpand,
  expanded,
  onClickSelect,
  selected,
  isInPopup,
  isNarrowScreen,
  texts,
}) {
  // The first section should be the initial tab value
  const [searchValue, setSearchValue] = useState("");
  const handleSearchBarChange = (event) => setSearchValue(event?.target?.value);

  function filteredLists({ searchValue, itemsToSelectFrom }) {
    if (searchValue == "" || searchValue == null) {
      return itemsToSelectFrom;
    }
    return (
      itemsToSelectFrom
        // remove all inner items that do not match the search query
        .map((item) => {
          const itemCopy = Object.assign({}, item);
          itemCopy.subcategories = item.subcategories.filter((innerItem) => {
            return innerItem.name.toLowerCase().includes(searchValue.toLowerCase());
          });
          return itemCopy;
        })
        // remove all items who do not match the search, or have no inner matches
        .filter((item) => {
          return (
            item.name.toLowerCase().includes(searchValue.toLowerCase()) ||
            item.subcategories.length > 0
          );
        })
    );
  }

  return (
    <Container>
      <div /*TODO(undefined) className={classes.searchBarContainer} */>
        <StyledFilterSearchBar
          label={texts.search_for_keywords}
          onChange={handleSearchBarChange}
          value={searchValue}
        />
        <ListToChooseFrom
          itemsToSelectFrom={filteredLists({ searchValue, itemsToSelectFrom })}
          onClickExpand={onClickExpand}
          expanded={expanded}
          onClickSelect={onClickSelect}
          selected={selected}
          narrowWrapper={isNarrowScreen || isInPopup}
          isInPopup={isInPopup}
          isNarrowScreen={isNarrowScreen}
        />
      </div>
    </Container>
  );
}

function SelectedList({
  narrow = false,
  itemNamePlural,
  maxSelections,
  onClickUnselect,
  selected,
  texts,
}) {
  return (
    <SelectedWrapper $narrow={narrow}>
      {selected && Array.isArray(selected) && (
        <Typography
          component="h2"
          variant="h5"
          sx={(theme) => ({
            fontWeight: "bold",
            fontSize: "16px",
            color: theme.palette.background.default_contrastText,
          })}
        >
          {selected.length > 0
            ? texts.selected + " " + itemNamePlural
            : texts.choose_between_on_and + maxSelections + " " + itemNamePlural + "!"}
        </Typography>
      )}
      {/* Shows the list of selected items. For example on /browse when you select "Categories" */}
      <List sx={{ maxWidth: 350, margin: "0 auto" }}>
        {selected &&
          Array.isArray(selected) &&
          selected?.map((item, index) => (
            // Only show the item if it's valid
            <SelectedItemButton key={index} onClick={() => onClickUnselect(item)} disableRipple>
              {/* If the .name property is undefined, render the item text directly */}
              <ListItemText>{item.name || item}</ListItemText>
              <SelectedItemIcon>
                <CloseIcon />
              </SelectedItemIcon>
            </SelectedItemButton>
          ))}
      </List>
    </SelectedWrapper>
  );
}

function ListToChooseFrom({
  narrowWrapper,
  expanded,
  isInPopup,
  isNarrowScreen,
  isSubList,
  itemsToSelectFrom,
  onClickExpand,
  onClickSelect,
  parentEl,
  parentList,
  selected,
}: any) {
  const index = isSubList ? parentList.indexOf(parentEl) : 0;
  const subListHeightCorrection = isSubList
    ? Math.min(index, Math.max(0, itemsToSelectFrom.length - parentList.length + index))
    : 0;

  const offset = isNarrowScreen || isInPopup ? 0 : index - subListHeightCorrection;
  return (
    <>
      <ListRoot
        $kind={
          isSubList
            ? expanded === parentEl.key
              ? isNarrowScreen || isInPopup
                ? "narrowSubList"
                : "subList"
              : "hidden"
            : "list"
        }
        $offset={offset}
        $narrowWrapper={narrowWrapper}
      >
        {/* Map over all potential items; for example this could be the list
        of skills in the skills dialog */}
        {itemsToSelectFrom.map((item, index) => {
          // If current last item, is the last subcategory item
          // in the last item in the outer list, then ignore our
          // normal border styling, and paint the 1px bottom border.
          let isFinalListItem = false;
          if (index === itemsToSelectFrom.length - 1) {
            const lastParentListItem = parentList && parentList[parentList.length - 1];
            const lastParentListItemSubcategories = lastParentListItem?.subcategories;
            const finalItem =
              lastParentListItemSubcategories &&
              lastParentListItemSubcategories[lastParentListItemSubcategories.length - 1];

            // Does the current item match its parent's last item?
            if (item.name === finalItem?.name) {
              isFinalListItem = true;
            }
          }

          // We need to keep the key property in tact with the list
          // item properties. OR we just check to see if the "name"s
          // match, in which case they should already be selected.

          // convert selected to an Array if not
          selected = Array.isArray(selected) ? selected : [selected];

          const isDisabled =
            selected.filter(
              // If the item is a raw string, we also accept that if it matches
              // the name of the selected item. For example, the array could be
              // ["Crafts"].
              (selectedItem) => selectedItem.name === item.name || selectedItem === item.name
            ).length === 1;

          return (
            <Fragment key={item.key}>
              <ChooseListItemButton
                disabled={isDisabled}
                $first={index == 0}
                $isSubList={isSubList}
                $narrowSubList={isSubList && (isNarrowScreen || isInPopup)}
                // If the list item is the absolute last
                // item in a nested list, then still paint
                // its bottom border.
                $lastSubItem={
                  isSubList &&
                  index === itemsToSelectFrom.length - 1 &&
                  (isNarrowScreen || isInPopup) &&
                  (isFinalListItem ? "final" : "last")
                }
                $underExpandedSubList={
                  !isSubList &&
                  itemsToSelectFrom[index - 1] &&
                  expanded === itemsToSelectFrom[index - 1].key &&
                  (isNarrowScreen || isInPopup)
                }
                $borderLeft={isSubList && index >= parentList.length}
                selected={expanded === item.key}
                onClick={() => {
                  if (item.subcategories && item.subcategories.length) {
                    return onClickExpand(item.key);
                  }

                  return onClickSelect(item);
                }}
                disableRipple
              >
                <ListItemText primary={item.name} />
                {item.subcategories && item.subcategories.length ? (
                  <ListItemIcon>
                    {isNarrowScreen || isInPopup ? (
                      expanded === item.key ? (
                        <ExpandLessIcon sx={getIconSx(expanded === item.key)} />
                      ) : (
                        <ExpandMoreIcon sx={getIconSx(expanded === item.key)} />
                      )
                    ) : (
                      <ArrowForwardIosIcon sx={getIconSx(expanded === item.key)} />
                    )}
                  </ListItemIcon>
                ) : (
                  ""
                )}
              </ChooseListItemButton>
              {/* Render the inner list items, if an outer list item has subcategories associated */}
              {(isNarrowScreen || isInPopup) && item.subcategories && item.subcategories.length ? (
                <ListToChooseFrom
                  expanded={expanded}
                  isInPopup={isInPopup}
                  isNarrowScreen={isNarrowScreen}
                  isSubList
                  itemsToSelectFrom={item.subcategories}
                  key={item.key + "innersublist"}
                  onClickExpand={onClickExpand}
                  onClickSelect={onClickSelect}
                  parentEl={item}
                  parentList={itemsToSelectFrom}
                  selected={selected}
                />
              ) : (
                <></>
              )}
            </Fragment>
          );
        })}
      </ListRoot>
      {/* Render the inner list items differently if not a narrow screen, or in a popup */}
      {!(isNarrowScreen || isInPopup) &&
        itemsToSelectFrom.map((item) => {
          return item.subcategories && item.subcategories.length ? (
            <ListToChooseFrom
              isSubList
              parentEl={item}
              parentList={itemsToSelectFrom}
              itemsToSelectFrom={item.subcategories}
              key={item.key + "outersublist"}
              expanded={expanded}
              onClickExpand={onClickExpand}
              selected={selected}
              onClickSelect={onClickSelect}
            />
          ) : null;
        })}
    </>
  );
}

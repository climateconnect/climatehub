import { IconButton, InputAdornment } from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import React, { useContext } from "react";
import { isSelectedFilterLocation } from "../../../public/lib/locationOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { LocationFilter } from "../filter/Filters";

// LocationFilter in overlay mode fills the available width, but also adds a
// bottom margin meant for the browse filter overlay. The calendar panel
// already spaces its children, so drop that margin here.
// In the narrow calendar panel, let the place input shrink instead of the
// radius box, so the radius keeps its browse width (100px).
const Wrapper = styled("div")({
  width: "100%",
  "& > div": {
    marginBottom: 0,
  },
  "& .MuiAutocomplete-root": {
    minWidth: 0,
  },
  "& > div > .MuiTextField-root:last-child": {
    flexShrink: 0,
  },
});

type Props = {
  /**
   * Either the selected location object (from the autocomplete or resolved
   * server-side), the text the user is currently typing, or null/"".
   * Only a selected location object filters events.
   */
  location: any;
  /** Radius as used by the browse pages, e.g. "25km" or "" (= place boundary). */
  radius: string;
  onLocationChange: (_location: any) => void;
  onRadiusChange: (_radius: string) => void;
  onClear: () => void;
  /** Narrow layout (mobile filter dialog): the radius takes a third of the row, as on browse. */
  isMobileScreen?: boolean;
};

/**
 * Location + radius filter for the event calendar. Renders the browse page's
 * LocationFilter so both look and behave the same, plus a clear ("×") button.
 * Spec: doc/spec/20261116_1005_event_calendar_location_filter.md
 */
export default function EventCalendarLocationFilter({
  location,
  radius,
  onLocationChange,
  onRadiusChange,
  onClear,
  isMobileScreen = false,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "filter_and_search", locale: locale });
  const hasSelectedLocation = isSelectedFilterLocation(location);

  const handleChange = (key: string, value: any) => {
    if (key === "radius") {
      onRadiusChange(value);
    } else if (value !== undefined) {
      // Typing yields a string, picking an option yields the location object.
      onLocationChange(value);
    }
  };

  return (
    <Wrapper data-testid="event-calendar-location-filter">
      <LocationFilter
        isInOverlay
        isMobileScreen={isMobileScreen}
        filter={{
          key: "location",
          icon: LocationOnOutlinedIcon,
          title: texts.location ?? "Location",
        }}
        value={location ?? ""}
        radiusValue={radius ?? ""}
        onChange={handleChange}
        endAdornment={
          hasSelectedLocation ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label={texts.remove_location ?? "Remove location"}
                onClick={onClear}
                edge="end"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null
        }
      />
    </Wrapper>
  );
}

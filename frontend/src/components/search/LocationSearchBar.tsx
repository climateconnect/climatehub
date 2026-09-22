import { TextField, TextFieldProps } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import makeStyles from "@mui/styles/makeStyles";
import axios from "axios";
import { debounce } from "lodash";
import React, { Fragment, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../public/lib/apiOperations";
import {
  getDisplayLocationFromLocation,
  getDisplayLocationFromExactLocation,
  isExactLocation,
} from "../../../public/lib/locationOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { useFeatureToggles } from "../featureToggle";
import { getLocaleHeader } from "../../utils/locationUtils";

// Fast-first, then backing-off poll schedule (ms) for GET /api/location_autocomplete/
// while it's returning 202 (pending). Keeps the common, uncontended case snappy
// (first re-poll at 250ms) while not hammering the server if a lookup is queued.
// Sums to ~6.75s of waiting between requests before giving up; see
// doc/spec/20260720_1400_locationiq_rate_limited_queue_design.md.
const AUTOCOMPLETE_POLL_SCHEDULE_MS = [250, 500, 1000, 1000, 1000, 1000, 1000, 1000];

// Input debounce, per provider path. The two are deliberately different.
//
// Through the backend proxy, a keystroke is cheap: hot prefixes are answered
// from the Redis cache, identical in-flight queries are coalesced onto one
// sentinel, and whatever is left is rate-limited before it reaches an upstream
// API. 400ms is what makes the suggestions feel live.
//
// Calling Nominatim directly from the browser has none of that — every
// debounced keystroke is a real request to OSM, whose usage policy is 1 req/s.
// So the toggle-off path keeps master's 1000ms rather than inheriting a value
// that was only safe because of infrastructure it doesn't go through.
const PROXY_DEBOUNCE_MS = 400;
const DIRECT_NOMINATIM_DEBOUNCE_MS = 1000;

const useStyles = makeStyles((theme) => ({
  additionalInfos: {
    width: "100%",
    marginTop: theme.spacing(2),
  },
}));

type Props = {
  label?: any;
  required?: boolean;
  helperText?: string;
  error?: boolean;
  inputClassName?;
  smallInput?;
  onSelect?;
  className?;
  value?;
  initialValue?;
  onChange?;
  open?;
  handleSetOpen?;
  locationInputRef?;
  textFieldClassName?;
  disabled?;
  enableExactLocation?: boolean;
  additionalInfoText?: string;
  onChangeAdditionalInfoText?;
  enableAdditionalInfo?: boolean;
  hideHelperText?: boolean;
  filterMode?: boolean;
  color?: TextFieldProps["color"];
};

export default function LocationSearchBar({
  label,
  required,
  helperText,
  error,
  inputClassName,
  smallInput,
  onSelect,
  className,
  value,
  initialValue,
  onChange,
  open,
  handleSetOpen,
  locationInputRef,
  textFieldClassName,
  disabled,
  enableExactLocation,
  additionalInfoText,
  onChangeAdditionalInfoText,
  enableAdditionalInfo,
  hideHelperText,
  filterMode = false, //Are we filtering any content by this location?
  color,
}: Props) {
  const { locale, hubUrl } = useContext(UserContext);
  const { isEnabled, isLoading: togglesLoading } = useFeatureToggles();
  // Fallback false: the backend proxy path (Redis cache + Celery lookup queue +
  // LocationIQ) is opt-in. If the toggle can't be read we use the direct
  // Nominatim call that ran on master for years.
  // See doc/spec/20260804_1202_locationiq_feature_toggle_and_result_caching.md.
  const useAutocompleteProxy = isEnabled("LOCATIONIQ_AUTOCOMPLETE", false);
  const classes = useStyles({ hideHelperText: hideHelperText });
  const texts = getTexts({ page: "filter_and_search", locale: locale });
  const getValue = (newValue, inputValue) => {
    if (!newValue) {
      return inputValue ? inputValue : "";
    } else if (typeof newValue === "object") {
      if (enableExactLocation) {
        return getDisplayLocationFromExactLocation(newValue).name ?? "";
      } else {
        return newValue.simple_name ?? newValue.name ?? "";
      }
    } else {
      return newValue;
    }
  };

  const [options, setOptions] = useState<{ simple_name: string }[]>([]);
  // If no 'open' prop is passed to the component, the component handles its 'open' state with this internal state
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [inputValue, setInputValue] = useState(getValue(value ? value : initialValue, ""));
  useEffect(
    function () {
      if (inputValue?.length > 0 && value?.length === 0) {
        setInputValue("");
        setSearchValue("");
        setOptions([]);
      }
    },
    [value]
  );
  const [loading, setLoading] = useState(false);
  const debounceMs = useAutocompleteProxy ? PROXY_DEBOUNCE_MS : DIRECT_NOMINATIM_DEBOUNCE_MS;
  const setSearchValueDebounced = useMemo(
    () => debounce((value: string) => setSearchValue(value), debounceMs),
    [debounceMs]
  );
  // Cancel the outgoing debounced call when the wait changes (the toggle
  // resolved) and on unmount, so a pending timer can't fire against a stale
  // interval or after the component is gone. In practice the toggle resolves at
  // app mount, before anyone has typed three characters.
  useEffect(() => () => setSearchValueDebounced.cancel(), [setSearchValueDebounced]);
  const HUB_COUNTRY_RESTRICTIONS = {
    perth: "gb",
  };
  //For some locations the official name differs from the "word of mouth name".
  //If people type in the "word of mouth name" we will instead look for the official name
  const ALIAS_FOR_SEARCH = {
    perthshire: "Perth and Kinross",
  };

  useEffect(() => {
    let active = true;
    let pollTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        pollTimeoutId = setTimeout(resolve, ms);
      });

    const processResponseData = (rawData) => {
      if (!active) return;
      const bannedClasses = [
        "tourism",
        "railway",
        "waterway",
        "natural",
        "shop",
        "leisure",
        "amenity",
        "highway",
        "aeroway",
        "historic",
      ];
      const additionalOptions = [
        {
          simple_name: "Global",
          name: "Global",
          type: "global",
          added_manually: "true",
          city: "",
          country: "Global",
          state: "",
          place_id: 1,
          osm_id: -1,
          osm_type: "relation",
          class: "global",
          osm_class: "global",
          osm_class_type: "global",
          lon: -1,
          lat: -1,
        },
      ];
      const bannedTypes = [
        "claimed_administrative",
        "isolated_dwelling",
        "croft",
        "construction",
        "postcode",
      ];
      const minimumImportance = {
        exactAddresses: 0.25,
        places: 0.5,
      };
      const filteredData = rawData.filter((o) => {
        return (
          (isExactLocation(o)
            ? o.importance > minimumImportance.exactAddresses
            : o.importance > minimumImportance.places) &&
          (enableExactLocation || !bannedClasses.includes(o.class)) &&
          !bannedTypes.includes(o.type)
        );
      });
      const data =
        filteredData.length > 0
          ? filteredData
          : rawData.slice(0, 2).filter((o) => {
              if (filterMode && o.type === "postcode") {
                return false;
              } else {
                return enableExactLocation || !bannedClasses.includes(o.class);
              }
            });
      for (const option of additionalOptions) {
        if (option.simple_name.toLowerCase().includes(searchValue.toLowerCase())) {
          data.push(option);
        }
      }

      const getSimpleName = (location, enableExactLocation: boolean = false): string => {
        if (!enableExactLocation) {
          return getDisplayLocationFromLocation(location).name;
        }

        return getDisplayLocationFromExactLocation(location).name;
      };

      const options = data.map((option) => ({
        ...option,
        // Nominatim returns "class" but our app uses "osm_class" consistently.
        // Same with "type" and "osm_class_type".
        osm_class: option.osm_class ?? option.class,
        osm_class_type: option.osm_class_type ?? option.type,
        simple_name: getSimpleName(option, enableExactLocation),
        key: `${option.osm_id || "na"}-${option.osm_type}-${
          option.osm_class ?? option.class ?? "na"
        }`,
      }));
      setOptions(getOptionsWithoutRedundancies(options));
      setLoading(false);
    };

    // Both provider paths resolve the same search term, so the alias lookup and
    // the hub country restriction live here rather than being duplicated.
    const getSearchParam = () =>
      ALIAS_FOR_SEARCH[searchValue.toLowerCase()]
        ? ALIAS_FOR_SEARCH[searchValue.toLowerCase()]
        : searchValue;

    const getCountryRestriction = () =>
      Object.keys(HUB_COUNTRY_RESTRICTIONS).includes(hubUrl)
        ? HUB_COUNTRY_RESTRICTIONS[hubUrl]
        : undefined;

    /**
     * LOCATIONIQ_AUTOCOMPLETE off: call Nominatim straight from the browser,
     * exactly as master does. Requests come from each user's own IP rather than
     * being funnelled through one server address, which is what OSM's usage
     * policy expects.
     */
    const fetchDirectFromNominatim = async () => {
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        getSearchParam()
      )}&format=json&addressdetails=1&polygon_geojson=1&polygon_threshold=0.001`;
      const countrycodes = getCountryRestriction();
      if (countrycodes) {
        url += "&countrycodes=" + countrycodes;
      }
      try {
        const response = await axios.get(url, { headers: getLocaleHeader(locale) });
        // Fire-and-forget: count this Nominatim request for rate monitoring.
        // Placed after the call so we only track successful API usage, and
        // deliberately *before* the `active` check: a fast typist supersedes
        // several in-flight requests per word, and every one of them really
        // did hit Nominatim. Skipping those would under-report the upstream
        // volume this whole migration is being judged on.
        apiRequest({ method: "post", url: "/api/autocomplete_request_count/" }).catch(() => {});
        // processResponseData checks `active` itself before touching state.
        processResponseData(response.data);
      } catch {
        if (active) setLoading(false);
      }
    };

    /**
     * LOCATIONIQ_AUTOCOMPLETE on: go through the backend proxy, which answers
     * from its Redis cache or queues a rate-limited LocationIQ lookup and
     * replies 202 until the result is ready.
     */
    const fetchViaProxy = async () => {
      let url = `/api/location_autocomplete/?q=${encodeURIComponent(getSearchParam())}`;
      const countrycodes = getCountryRestriction();
      if (countrycodes) {
        url += "&countrycodes=" + countrycodes;
      }

      let attempt = 0;
      while (active) {
        try {
          const response = await apiRequest({ method: "get", url, locale });
          if (!active) return;
          if (response.status === 202) {
            if (attempt >= AUTOCOMPLETE_POLL_SCHEDULE_MS.length) {
              // Gave up waiting — leave whatever's currently shown (likely
              // nothing, since options were cleared on this keystroke) and
              // stop the spinner rather than hanging indefinitely.
              setLoading(false);
              return;
            }
            await sleep(AUTOCOMPLETE_POLL_SCHEDULE_MS[attempt]);
            attempt += 1;
            continue;
          }
          processResponseData(response.data);
          return;
        } catch (error: any) {
          const responseStatus = error?.response?.status;
          if (responseStatus === 429 || responseStatus === 503) {
            // Transient "busy, try again" signal — not a real failure, so
            // don't surface an error to the user, just stop this attempt.
            if (active) setLoading(false);
            return;
          }
          if (active) setLoading(false);
          return;
        }
      }
    };

    // While the toggles are still loading we fire nothing and keep the spinner:
    // they resolve at app mount and the input is debounced, so this is
    // near-unreachable, but sending the very first query to the wrong provider
    // would be worse than waiting one more render.
    if (!searchValue) {
      setOptions([]);
    } else if (!togglesLoading) {
      if (useAutocompleteProxy) {
        fetchViaProxy();
      } else {
        fetchDirectFromNominatim();
      }
    }

    return () => {
      active = false;
      if (pollTimeoutId) clearTimeout(pollTimeoutId);
    };
  }, [searchValue, locale, hubUrl, useAutocompleteProxy, togglesLoading]);

  const getOptionsWithoutRedundancies = (options) => {
    //For the classes_without_hierarchy we simply return the first element if there is a redundancy
    const classes_without_hierarchy = ["highway"];
    //If any of these types apply we want the types to trump each other in this order instead of just taking the first element
    const type_hierarchy = ["administrative", "county", "political"];
    //e.g. don't display both a city and a county if their names are identical
    return options.filter((cur) => {
      for (const o of options) {
        if (cur !== o && cur.simple_name === o.simple_name) {
          //if the elements are both a class without hierarchy, filter out every element but the first one
          if (
            classes_without_hierarchy.includes(cur.class) &&
            o.class === cur.class &&
            o !== options.find((e) => e.class === cur.class)
          ) {
            return false;
          }
          //if the elements are part of the type hierarchy, filter out every element but the strongest
          if (
            type_hierarchy.indexOf(cur.type) > -1 &&
            type_hierarchy.indexOf(o.type) < type_hierarchy.indexOf(cur.type)
          ) {
            return false;
          }
        }
      }
      return true;
    });
  };

  const handleClose = () => {
    setOpen(false);
  };

  const setOpen = (newOpenValue) => {
    if (open === undefined) setUncontrolledOpen(newOpenValue);
    else handleSetOpen(newOpenValue);
  };

  const renderSearchOption = (props, option) => {
    const { key, ...optionProps } = props;
    return (
      <li key={key} {...optionProps}>
        {option}
      </li>
    );
  };

  const handleInputChange = (event) => {
    if (!loading) setLoading(true);
    if (options?.length > 0) setOptions([]);
    if ((event.target.value || event.target.value === "") && onChange) {
      onChange(event.target.value);
    }
    setInputValue(event.target.value);
    if (event.target.value.length >= 3) {
      setSearchValueDebounced(event.target.value);
    } else {
      setSearchValueDebounced.cancel();
      setOptions([]);
      setLoading(false);
    }
  };

  const handleChange = (event, value, reason) => {
    if (reason === "selectOption") {
      setInputValue(value);
      if (onSelect) {
        onSelect(options.filter((o) => o.simple_name === value)[0]);
      }
    }
  };

  const handleGetOptionDisabled = (/*option*/) => {
    return false;
  };

  const handleFilterOptions = (options) => {
    return options;
  };

  const handleChangeAdditionalInfoText = (e) => {
    onChangeAdditionalInfoText(e.target.value);
  };

  return (
    <div className={className}>
      <Autocomplete
        className={inputClassName}
        open={open === undefined ? uncontrolledOpen : open}
        onOpen={() => {
          setOpen(true);
        }}
        handleHomeEndKeys
        disableClearable
        loading={loading}
        onClose={handleClose}
        onChange={handleChange}
        options={options.map((o) => o.simple_name)}
        inputValue={getValue(value, inputValue)}
        filterOptions={handleFilterOptions}
        getOptionDisabled={handleGetOptionDisabled}
        renderOption={renderSearchOption}
        disabled={disabled}
        noOptionsText={!searchValue && !inputValue ? texts.start_typing + "..." : texts.no_options}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required={required}
            error={error}
            variant="outlined"
            onChange={handleInputChange}
            helperText={helperText}
            size={smallInput && "small"}
            inputRef={locationInputRef}
            // @ts-ignore - contrast is a custom color defined in theme
            color={color || "contrast"}
            InputProps={{
              ...params.InputProps,
              endAdornment: <Fragment>{params.InputProps.endAdornment}</Fragment>,
              className: `${textFieldClassName}`,
            }}
          />
        )}
      />
      {enableAdditionalInfo && (
        <TextField
          label={texts.additional_infos_for_location}
          // @ts-ignore - contrast is a custom color defined in theme
          color={color || "contrast"}
          className={classes.additionalInfos}
          value={additionalInfoText ?? ""}
          onChange={handleChangeAdditionalInfoText}
        />
      )}
    </div>
  );
}

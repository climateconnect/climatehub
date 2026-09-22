import {
  Box,
  ClickAwayListener,
  Divider,
  Grow,
  Link,
  MenuList,
  Paper,
  Theme,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import { getLogoSrc } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";

const useStyles = makeStyles<Theme, { darkBackground?: boolean }>((theme) => ({
  root: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },
  trigger: (props) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    background: "transparent",
    border: `1px solid ${
      props.darkBackground
        ? "rgba(255,255,255,0.35)"
        : theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.16)"
        : "rgba(0,0,0,0.10)"
    }`,
    padding: theme.spacing(0.5, 1),
    marginLeft: theme.spacing(1),
    borderRadius: 999,
    cursor: "pointer",
    transition: "background-color 160ms ease, border-color 160ms ease",
    color: "inherit",
    minHeight: 36,
    "&:hover": {
      backgroundColor: props.darkBackground
        ? "rgba(255,255,255,0.10)"
        : theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)",
    },
    "&:active": {
      backgroundColor: props.darkBackground
        ? "rgba(255,255,255,0.16)"
        : theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.10)"
        : "rgba(0,0,0,0.08)",
    },
    "&:focus-visible": {
      outline: `2px solid ${
        props.darkBackground ? "rgba(255,255,255,0.9)" : theme.palette.primary.main
      }`,
      outlineOffset: 2,
    },
  }),
  triggerOpen: (props) => ({
    backgroundColor: props.darkBackground
      ? "rgba(255,255,255,0.14)"
      : theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.10)"
      : "rgba(0,0,0,0.06)",
    borderColor: props.darkBackground
      ? "rgba(255,255,255,0.55)"
      : theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.24)"
      : "rgba(0,0,0,0.18)",
  }),
  triggerIcon: (props) => ({
    color: props.darkBackground ? "inherit" : theme.palette.primary.main,
    flexShrink: 0,
  }),
  triggerChevron: {
    color: "inherit",
    opacity: 0.7,
    transition: "transform 200ms ease",
  },
  triggerChevronOpen: {
    transform: "rotate(180deg)",
    opacity: 1,
  },
  paper: {
    width: 320,
    maxWidth: "calc(100vw - 16px)",
    maxHeight: "70vh",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  scroll: {
    overflowY: "auto",
    flex: 1,
    position: "relative",
  },
  fade: {
    position: "sticky",
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
    marginTop: -24,
    pointerEvents: "none",
    background: "linear-gradient(to bottom, rgba(255,255,255,0), #fff)",
    [theme.breakpoints.down("md")]: {
      background: "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.96))",
    },
  },
  menuList: {
    padding: 0,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 700,
    color: "rgba(0,0,0,0.55)",
    padding: theme.spacing(1.5, 1.5, 0.75),
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    minHeight: 44,
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    position: "relative",
    transition: "background-color 120ms ease",
    "&:hover": {
      backgroundColor: "rgba(0,0,0,0.04)",
    },
  },
  menuItemActive: {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: theme.palette.primary.main,
  },
  hubLogoSlot: {
    height: 20,
    width: 84,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  hubLogo: {
    height: 20,
    width: "auto",
    maxWidth: "100%",
    objectFit: "contain",
    display: "block",
  },
  hubLogoFallback: {
    height: 20,
    width: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.primary.main,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.2,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  labelActive: {
    fontWeight: 700,
  },
  checkSlot: {
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  sectionDivider: {
    margin: theme.spacing(0.5, 0),
  },
}));

function getHubLogoSrc(hub: any, isCustomHub: boolean) {
  if (!hub?.url_slug) return null;
  if (isCustomHub) return `/images/hub_logos/ch_${hub.url_slug}_logo.svg`;
  if (isLocationHubLikeHub(hub.hub_type)) {
    return `/images/hub_logos/ch_${hub.url_slug.toLowerCase()}_logo.svg`;
  }
  return null;
}

export default function HubLogoMenu({ darkBackground = false }: { darkBackground?: boolean }) {
  const classes = useStyles({ darkBackground });
  const router = useRouter();
  const { locale, user, startLoading, CUSTOM_HUB_URLS } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  const { hubs, hubUrl } = useContext(HubContext);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const isEventsPage = router.pathname?.includes("events");

  const { locationHubs, customHubs, activeHub } = useMemo(() => {
    if (!hubs || hubs.length === 0) {
      return { locationHubs: [], customHubs: [], activeHub: null };
    }
    // The frontend's custom hub list (CUSTOM_HUB_URLS) is the source of truth
    // for custom hubs; the API may still classify some of them as location
    // hubs (e.g. perth).
    const isCustomHub = (h: any) =>
      CUSTOM_HUB_URLS?.includes(h.url_slug) || h.hub_type === "custom hub";
    const locationHubs = hubs
      .filter((h) => !isCustomHub(h) && h.hub_type === "location hub")
      .sort((a, b) => a.name.localeCompare(b.name));
    const customHubs = hubs.filter(isCustomHub).sort((a, b) => a.name.localeCompare(b.name));
    const allSwitchable = [...locationHubs, ...customHubs];
    const activeHub = allSwitchable.find((h) => h.url_slug === hubUrl) || null;
    return { locationHubs, customHubs, activeHub };
  }, [hubs, hubUrl, CUSTOM_HUB_URLS]);

  const buildHref = (slug?: string) => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const prefix = getLocalePrefix(locale);
    if (!slug) {
      return `${prefix}${isEventsPage ? "/events" : `/browse${hash}`}`;
    }
    if (isEventsPage) return `${prefix}/hubs/${slug}/events`;
    const hub = [...locationHubs, ...customHubs].find((h) => h.url_slug === slug);
    if (!user && hub?.landing_page_component) return `${prefix}/hubs/${slug}`;
    return `${prefix}/hubs/${slug}/browse${hash}`;
  };

  // The menu is positioned fixed in the viewport, clamped to the screen
  // edges, so it also fits on small phones where anchoring it to the
  // trigger would overflow the viewport.
  const handleToggle = () => {
    if (!open && triggerRef.current && typeof window !== "undefined") {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      setMenuAnchor({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 8 - width)),
      });
    }
    setOpen((v) => !v);
  };
  const handleClose = () => setOpen(false);
  const handleClickItem = () => {
    startLoading?.();
    handleClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [open]);

  const hasMultipleHubs = locationHubs.length + customHubs.length > 1;

  const renderRow = (item: {
    key: string;
    label: string;
    href: string;
    logoSrc: string | null;
    isActive: boolean;
  }) => {
    const rowClass = `${classes.menuItem} ${item.isActive ? classes.menuItemActive : ""}`;
    return (
      <Link
        key={item.key}
        href={item.href}
        underline="none"
        onClick={handleClickItem}
        className={rowClass}
        aria-current={item.isActive ? "page" : undefined}
      >
        {item.isActive && <span className={classes.activeBar} aria-hidden="true" />}
        <span className={classes.hubLogoSlot}>
          {item.logoSrc ? (
            <img src={item.logoSrc} alt="" className={classes.hubLogo} loading="lazy" />
          ) : (
            <span className={classes.hubLogoFallback}>
              <PlaceOutlinedIcon fontSize="small" />
            </span>
          )}
        </span>
        <span className={`${classes.label} ${item.isActive ? classes.labelActive : ""}`}>
          {item.label}
        </span>
        {item.isActive && <CheckIcon fontSize="small" className={classes.checkSlot} />}
      </Link>
    );
  };

  if (!hasMultipleHubs) {
    return null;
  }

  return (
    <ClickAwayListener onClickAway={handleClose} mouseEvent="onMouseDown" touchEvent="onTouchStart">
      <Box className={classes.root}>
        <button
          type="button"
          ref={triggerRef}
          onClick={handleToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={texts.switch_hub}
          className={`${classes.trigger} ${open ? classes.triggerOpen : ""}`}
        >
          <PlaceOutlinedIcon fontSize="small" className={classes.triggerIcon} />
          <ExpandMoreIcon
            fontSize="small"
            className={`${classes.triggerChevron} ${open ? classes.triggerChevronOpen : ""}`}
          />
        </button>
        {open && (
          <Grow in={open} timeout={160} style={{ transformOrigin: "0 0 0" }}>
            <Paper
              elevation={6}
              className={classes.paper}
              sx={{
                position: "fixed",
                top: menuAnchor ? menuAnchor.top : undefined,
                left: menuAnchor ? menuAnchor.left : undefined,
                zIndex: 1300,
              }}
            >
              <Box className={classes.scroll}>
                <MenuList className={classes.menuList}>
                  {[
                    renderRow({
                      key: "__all__",
                      label: texts.all_places,
                      href: buildHref(undefined),
                      logoSrc: getLogoSrc("normal", locale),
                      isActive: !activeHub,
                    }),
                    ...(locationHubs.length > 0
                      ? [
                          <Typography key="section-locations" className={classes.sectionLabel}>
                            {texts.locations}
                          </Typography>,
                          ...locationHubs.map((h) =>
                            renderRow({
                              key: h.url_slug,
                              label: h.name,
                              href: buildHref(h.url_slug),
                              logoSrc: getHubLogoSrc(h, false),
                              isActive: activeHub?.url_slug === h.url_slug,
                            })
                          ),
                        ]
                      : []),
                    ...(customHubs.length > 0
                      ? [
                          <Divider key="section-custom" className={classes.sectionDivider} />,
                          ...customHubs.map((h) =>
                            renderRow({
                              key: h.url_slug,
                              label: h.name,
                              href: buildHref(h.url_slug),
                              logoSrc: getHubLogoSrc(h, true),
                              isActive: activeHub?.url_slug === h.url_slug,
                            })
                          ),
                        ]
                      : []),
                  ]}
                </MenuList>
                <Box className={classes.fade} aria-hidden="true" />
              </Box>
            </Paper>
          </Grow>
        )}
      </Box>
    </ClickAwayListener>
  );
}

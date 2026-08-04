import {
  Box,
  ClickAwayListener,
  Divider,
  Grow,
  Link,
  MenuList,
  Paper,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import React, { useContext, useMemo, useState } from "react";
import { useRouter } from "next/router";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";

const useStyles = makeStyles((theme) => ({
  root: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  },
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    background: "transparent",
    border: `1px solid ${
      theme.palette.mode === "dark" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.10)"
    }`,
    padding: theme.spacing(0.5, 1),
    marginLeft: theme.spacing(1),
    borderRadius: 999,
    cursor: "pointer",
    transition: "background-color 160ms ease, border-color 160ms ease",
    color: "inherit",
    minHeight: 36,
    "&:hover": {
      backgroundColor:
        theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    },
    "&:active": {
      backgroundColor:
        theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  triggerOpen: {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
    borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.18)",
  },
  triggerIcon: {
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  triggerChevron: {
    color: "inherit",
    opacity: 0.7,
    transition: "transform 200ms ease",
  },
  triggerChevronOpen: {
    transform: "rotate(180deg)",
    opacity: 1,
  },
  triggerLabel: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.2,
    lineHeight: 1,
    maxWidth: 110,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  paper: {
    marginTop: theme.spacing(0.5),
    width: 296,
    maxWidth: "calc(100vw - 32px)",
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
    padding: theme.spacing(1.5, 2, 0.75),
  },
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 2),
    minHeight: 48,
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
  hubLogo: {
    height: 32,
    width: "auto",
    maxWidth: 80,
    flexShrink: 0,
    objectFit: "contain",
    display: "block",
  },
  hubLogoWide: {
    maxWidth: 92,
  },
  hubLogoFallback: {
    height: 32,
    width: 48,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.primary.main,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.2,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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

function getHubLogoSrc(hub: any) {
  if (!hub?.url_slug) return null;
  if (hub.hub_type === "custom hub") return `/images/hub_logos/ch_${hub.url_slug}_logo.svg`;
  if (isLocationHubLikeHub(hub.hub_type)) {
    return `/images/hub_logos/ch_${hub.url_slug.toLowerCase()}_logo.svg`;
  }
  return null;
}

export default function HubLogoMenu() {
  const classes = useStyles();
  const router = useRouter();
  const { locale, user, startLoading } = useContext(UserContext);
  const { hubs, hubUrl } = useContext(HubContext);
  const [open, setOpen] = useState(false);
  const isEventsPage = router.pathname?.includes("events");

  const urlHubSlug = useMemo(() => {
    if (typeof window === "undefined") return null;
    const match = window.location.pathname.match(/^\/[^/]+\/hubs\/([^/]+)/);
    return match ? match[1] : null;
  }, [router.asPath]);

  const { locationHubs, customHubs, activeHub } = useMemo(() => {
    if (!hubs || hubs.length === 0) {
      return { locationHubs: [], customHubs: [], activeHub: null };
    }
    const locationHubs = hubs
      .filter((h) => h.hub_type === "location hub")
      .sort((a, b) => a.name.localeCompare(b.name));
    const customHubs = hubs
      .filter((h) => h.hub_type === "custom hub")
      .sort((a, b) => a.name.localeCompare(b.name));
    const allSwitchable = [...locationHubs, ...customHubs];
    const activeSlug = hubUrl || urlHubSlug;
    const activeHub = allSwitchable.find((h) => h.url_slug === activeSlug) || null;
    return { locationHubs, customHubs, activeHub };
  }, [hubs, hubUrl, urlHubSlug]);

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

  const handleToggle = () => setOpen((v) => !v);
  const handleClose = () => setOpen(false);
  const handleClickItem = () => {
    startLoading?.();
    handleClose();
  };

  const triggerLabel = activeHub ? activeHub.name : "All places";
  const hasMultipleHubs = locationHubs.length + customHubs.length > 1;

  const renderRow = (item: {
    key: string;
    label: string;
    href: string;
    logoSrc: string | null;
    isWide?: boolean;
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
        {item.logoSrc ? (
          <img
            src={item.logoSrc}
            alt=""
            className={`${classes.hubLogo} ${item.isWide ? classes.hubLogoWide : ""}`}
            loading="lazy"
          />
        ) : (
          <span className={classes.hubLogoFallback}>
            <PlaceOutlinedIcon fontSize="small" />
          </span>
        )}
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
          onClick={handleToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Switch hub"
          className={`${classes.trigger} ${open ? classes.triggerOpen : ""}`}
        >
          <PlaceOutlinedIcon fontSize="small" className={classes.triggerIcon} />
          <span className={classes.triggerLabel}>{triggerLabel}</span>
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
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: "auto",
                zIndex: 1300,
              }}
            >
              <Box className={classes.scroll}>
                <MenuList className={classes.menuList}>
                  {locationHubs.length > 0 && (
                    <>
                      <Typography className={classes.sectionLabel}>Standorte</Typography>
                      {locationHubs.map((h) =>
                        renderRow({
                          key: h.url_slug,
                          label: h.name,
                          href: buildHref(h.url_slug),
                          logoSrc: getHubLogoSrc(h),
                          isActive: activeHub?.url_slug === h.url_slug,
                        })
                      )}
                    </>
                  )}
                  {customHubs.length > 0 && (
                    <>
                      <Divider className={classes.sectionDivider} />
                      <Typography className={classes.sectionLabel}>ClimateHub</Typography>
                      {customHubs.map((h) =>
                        renderRow({
                          key: h.url_slug,
                          label: h.name,
                          href: buildHref(h.url_slug),
                          logoSrc: getHubLogoSrc(h),
                          isActive: activeHub?.url_slug === h.url_slug,
                        })
                      )}
                    </>
                  )}
                  <Divider className={classes.sectionDivider} />
                  <Typography className={classes.sectionLabel}>Netzwerk</Typography>
                  {renderRow({
                    key: "__all__",
                    label: "All places",
                    href: buildHref(undefined),
                    logoSrc: "/images/logo.svg",
                    isWide: true,
                    isActive: !activeHub,
                  })}
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

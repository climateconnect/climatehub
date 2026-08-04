import {
  Box,
  ClickAwayListener,
  Divider,
  Grow,
  Link,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import React, { useContext, useMemo, useState } from "react";
import { useRouter } from "next/router";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import isLocationHubLikeHub from "../../../public/lib/isLocationHubLikeHub";
import getTexts from "../../../public/texts/texts";

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
    border: 0,
    padding: theme.spacing(0.5, 0.75),
    marginLeft: theme.spacing(-0.75),
    borderRadius: 8,
    cursor: "pointer",
    transition: "background-color 160ms ease",
    color: "inherit",
    "&:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.04)",
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  triggerOpen: {
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
  logoImage: (props) => ({
    height: props.isLocationHub || props.isCustomHub ? 35 : 32,
    width: "auto",
    maxWidth: 180,
    display: "block",
  }),
  chevron: {
    color: "inherit",
    opacity: 0.7,
    transition: "transform 200ms ease",
  },
  chevronOpen: {
    transform: "rotate(180deg)",
    opacity: 1,
  },
  popper: {
    zIndex: 1300,
  },
  paper: {
    marginTop: theme.spacing(0.5),
    minWidth: 280,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "70vh",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: theme.spacing(1.5, 2, 1),
  },
  overline: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: 700,
    opacity: 0.6,
  },
  activeHub: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.3,
    marginTop: 2,
  },
  scroll: {
    overflowY: "auto",
    flex: 1,
    paddingBottom: theme.spacing(0.5),
  },
  menuList: {
    padding: 0,
  },
  menuItem: {
    padding: theme.spacing(1, 2),
    minHeight: 56,
    gap: theme.spacing(2),
  },
  hubLogo: {
    height: 36,
    width: "auto",
    maxWidth: 80,
    flexShrink: 0,
    objectFit: "contain",
    display: "block",
  },
  hubLogoTall: {
    height: 32,
    maxWidth: 90,
  },
  hubLogoFallback: {
    height: 36,
    width: 56,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.primary.main,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.2,
  },
  labelActive: {
    fontWeight: 700,
  },
  checkSlot: {
    marginLeft: "auto",
    color: theme.palette.primary.main,
  },
}));

type HubLogoMenuProps = {
  isLocationHub: boolean;
  isCustomHub: boolean;
  hubUrl: string;
  logo: string;
  logoLink: string;
  logoAlt: string;
};

function getHubLogoSrc(hub: any) {
  if (hub?.url_slug && hub?.hub_type === "custom hub") {
    return `/images/hub_logos/ch_${hub.url_slug}_logo.svg`;
  }
  if (hub?.url_slug && isLocationHubLikeHub(hub.hub_type)) {
    return `/images/hub_logos/ch_${hub.url_slug.toLowerCase()}_logo.svg`;
  }
  return null;
}

export default function HubLogoMenu({
  isLocationHub,
  isCustomHub,
  hubUrl,
  logo,
  logoAlt,
}: HubLogoMenuProps) {
  const classes = useStyles({ isLocationHub, isCustomHub });
  const router = useRouter();
  const { locale, user, startLoading } = useContext(UserContext);
  const { hubs } = useContext(HubContext);
  const texts = getTexts({ page: "navigation", locale });
  const [open, setOpen] = useState(false);
  const isEventsPage = router.pathname?.includes("events");

  const activeHubs = useMemo(() => {
    if (!hubs || hubs.length === 0) return [];
    return hubs.filter((h) => isLocationHubLikeHub(h.hub_type));
  }, [hubs]);

  const activeHub = useMemo(() => activeHubs.find((h) => h.url_slug === hubUrl) || null, [
    activeHubs,
    hubUrl,
  ]);

  const buildHref = (slug?: string) => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!slug) {
      return `${getLocalePrefix(locale)}${isEventsPage ? "/events" : `/browse${hash}`}`;
    }
    if (isEventsPage) return `${getLocalePrefix(locale)}/hubs/${slug}/events`;
    const hub = activeHubs.find((h) => h.url_slug === slug);
    if (!user && hub?.landing_page_component) return `${getLocalePrefix(locale)}/hubs/${slug}`;
    return `${getLocalePrefix(locale)}/hubs/${slug}/browse${hash}`;
  };

  const items = useMemo(() => {
    const list = activeHubs.map((h) => ({
      key: h.url_slug,
      label: h.name,
      href: buildHref(h.url_slug),
      logoSrc: getHubLogoSrc(h),
      isActive: h.url_slug === hubUrl,
    }));
    list.push({
      key: "__all__",
      label: texts?.all_locations || "All places",
      href: buildHref(undefined),
      logoSrc: "/images/logo.svg",
      isActive: !hubUrl,
    });
    return list;
  }, [activeHubs, hubUrl, user, locale]);

  const handleToggle = () => setOpen((v) => !v);
  const handleClose = () => setOpen(false);
  const handleClickItem = () => {
    startLoading?.();
    handleClose();
  };

  return (
    <ClickAwayListener onClickAway={handleClose} mouseEvent="onMouseDown" touchEvent="onTouchStart">
      <Box className={classes.root}>
        <button
          type="button"
          onClick={handleToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={texts?.switch_hub || "Switch hub"}
          className={`${classes.trigger} ${open ? classes.triggerOpen : ""}`}
        >
          <img src={logo} alt={logoAlt} className={classes.logoImage} />
          <ArrowDropDownIcon
            fontSize="small"
            className={`${classes.chevron} ${open ? classes.chevronOpen : ""}`}
          />
        </button>
        {open && (
          <Grow in={open} timeout={160} style={{ transformOrigin: "0 0 0" }}>
            <Paper
              elevation={6}
              className={`${classes.popper} ${classes.paper}`}
              sx={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: "auto",
              }}
            >
              <Box className={classes.header}>
                <Typography className={classes.overline}>
                  {texts?.switch_hub || "Switch hub"}
                </Typography>
                <Typography className={classes.activeHub} noWrap>
                  {activeHub?.name || texts?.all_locations || "All places"}
                </Typography>
              </Box>
              <Divider />
              <Box className={classes.scroll}>
                <MenuList className={classes.menuList}>
                  {items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      underline="none"
                      onClick={handleClickItem}
                      sx={{ color: "inherit", display: "block" }}
                    >
                      <MenuItem
                        component="div"
                        className={classes.menuItem}
                        selected={item.isActive}
                      >
                        <ListItemIcon
                          className={item.logoSrc ? classes.hubLogo : classes.hubLogoFallback}
                          sx={{ minWidth: "auto" }}
                        >
                          {item.logoSrc ? (
                            <img
                              src={item.logoSrc}
                              alt=""
                              className={
                                item.key === "__all__"
                                  ? `${classes.hubLogo} ${classes.hubLogoTall}`
                                  : classes.hubLogo
                              }
                              loading="lazy"
                            />
                          ) : (
                            <PlaceOutlinedIcon fontSize="small" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            className: `${classes.label} ${
                              item.isActive ? classes.labelActive : ""
                            }`,
                          }}
                        />
                        {item.isActive && (
                          <CheckIcon fontSize="small" className={classes.checkSlot} />
                        )}
                      </MenuItem>
                    </Link>
                  ))}
                </MenuList>
              </Box>
            </Paper>
          </Grow>
        )}
      </Box>
    </ClickAwayListener>
  );
}

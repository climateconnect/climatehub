import {
  Avatar,
  Badge,
  Box,
  Button,
  ClickAwayListener,
  Container,
  Divider,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  SwipeableDrawer,
  Typography,
} from "@mui/material";
import { Theme, useTheme } from "@mui/material/styles";
import makeStyles from "@mui/styles/makeStyles";
import useMediaQuery from "@mui/material/useMediaQuery";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import MenuIcon from "@mui/icons-material/Menu";
import noop from "lodash/noop";
import React, { Fragment, useEffect, useContext, useRef, useState } from "react";
import { getStaticPageLinks } from "../../../public/data/getStaticPageLinks"; // Relative imports
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { appHref } from "../../../public/lib/appLink";
import { getImageUrl, getLogoSrc } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import Notification from "../communication/notifications/Notification";
import NotificationsBox from "../communication/notifications/NotificationsBox";
import UserContext from "../context/UserContext";
import ProfileBadge from "../profile/ProfileBadge";
import DropDownButton from "./DropDownButton";
import LanguageSelect from "./LanguageSelect";
import StaticPageLinks from "./StaticPageLinks";
import { HeaderProps } from "./types";
import { getLinks, getLoggedInLinks, getStaticLinkFromItem } from "../../../public/lib/headerLinks";

type StyleProps = {
  transparentHeader?: boolean;
  fixedHeader?: boolean;
  background?: string;
  isStaticPage?: boolean;
  isHubPage?: boolean;
  isLocationHub?: boolean;
  isCustomHub?: boolean;
  isLoggedInUser?: boolean;
  isLandingPage?: boolean;
};

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => {
  function getHeaderColor(isCustomHub, transparent, isLandingPage, customTheme) {
    if (transparent || isLandingPage) return "white";
    return isCustomHub ? customTheme.palette.primary.contrastText : theme.palette.primary.main;
  }

  function getHeaderBackground(background, transparent, isLandingPage) {
    if (background) return background;
    if (transparent) return "";
    return isLandingPage ? theme.palette.primary.main : "white";
  }

  return {
    root: (props) => {
      return {
        zIndex: props.fixedHeader ? 1000 : "auto",
        borderBottom:
          props.transparentHeader || props.isStaticPage || props.isHubPage
            ? 0
            : `1px solid ${theme.palette.grey[300]}`,
        position: props.fixedHeader ? "fixed" : ("auto" as "inherit"),
        width: props.fixedHeader ? "100%" : "auto",
        top: props.fixedHeader ? 0 : "auto",
        //Use custom background if the header is fixed and not transparent (landing page) or if it's a custom hub
        background: getHeaderBackground(
          props.background,
          props.transparentHeader,
          props.isLandingPage
        ),
        color: getHeaderColor(
          props.isCustomHub,
          props.transparentHeader,
          props.isLandingPage,
          theme
        ),
        textDecoration: "inherit",
        transition: "all 0.25s linear", // use all instead of transform since the background color too is changing at some point. It'll be nice to have a smooth transition.
      };
    },
    spacingBottom: {
      marginBottom: theme.spacing(2),
    },
    container: {
      padding: theme.spacing(2),
      paddingRight: "auto",
      paddingLeft: "auto",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      [theme.breakpoints.down("lg")]: {
        padding: theme.spacing(2),
      },
      [theme.breakpoints.down("md")]: {
        padding: `${theme.spacing(0.8)} ${theme.spacing(2)}`,
      },
    },
    logoLink: {
      [theme.breakpoints.down("md")]: {
        flex: `0 1 auto`,
        // width: "calc(1.1vw + 1.3em)",
        // maxWidth: "2.3rem",
        minWidth: "1.3rem",
      },
    },
    logo: (props) => ({
      [theme.breakpoints.down("md")]: {
        height: props.isLocationHub || props.isCustomHub ? 35 : "auto",
      },
      height: 60,
      maxWidth: 180,
    }),
    buttonMarginLeft: {
      marginLeft: theme.spacing(1),
    },
    marginRight: {
      marginRight: theme.spacing(3),
    },
    loggedInRoot: {
      verticalAlign: "middle",
      marginLeft: theme.spacing(2),
      zIndex: 101,
    },
    loggedInAvatar: {
      height: 30,
      width: 30,
    },
    loggedInAvatarMobile: {
      height: 60,
      width: 60,
      margin: "0 auto",
    },
    loggedInLink: {
      color: theme?.palette?.background?.default_contrastText,
      width: "100%",
    },
    linkContainer: {
      display: "flex",
      alignItems: "center",
      maxWidth: "calc(100% - 200px)",
      [theme.breakpoints.down("lg")]: {
        maxWidth: "calc(100% - 150px)",
      },
      [theme.breakpoints.down("md")]: {
        maxWidth: "calc(100% - 35px)",
      },
      justifyContent: "space-around",
    },
    shareProjectButton: (props) => {
      const css = {
        height: 36,
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
      };
      if (props.isCustomHub) {
        return {
          ...css,
          color: theme.palette.primary.contrastText,
          backgroundColor: theme.palette.primary.main,
        };
      } else {
        return css;
      }
    },
    notificationsHeadline: {
      padding: theme.spacing(2),
      textAlign: "center",
    },
    loggedInLinksFixedHeader: {
      zIndex: 30,
    },
    loggedInPopper: {
      zIndex: 130,
    },
    normalScreenIcon: {
      fontSize: 20,
      marginRight: theme.spacing(0.25),
    },
    mobileAvatarContainer: {
      display: "flex",
      justifyContent: "center",
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    languageSelectMobile: {
      display: "flex",
      justifyContent: "center",
    },
    btnColor: (props) => {
      return {
        color: props.isCustomHub
          ? theme.palette.primary.contrastText
          : props.isLandingPage
          ? "white"
          : theme.palette.background.default_contrastText,
        borderColor: props.isCustomHub
          ? theme.palette.primary.contrastText
          : theme.palette.primary.main,
        "&:hover": {
          borderColor: props.isCustomHub
            ? theme.palette.primary.contrastText
            : theme.palette.primary.main,
        },
      };
    },
    linkUnderline: (props) => ({
      color: props.isCustomHub
        ? theme.palette.background.default_contrastText
        : theme.palette.primary.main,
    }),

    drawerItem: {
      color: theme.palette.background.default_contrastText,
    },
    poweredByImg: {
      [theme.breakpoints.down("md")]: {
        height: 15,
      },
      height: 20,
      marginLeft: theme.spacing(1),
      marginTop: theme.spacing(0.1),
    },
    poweredByTxt: {
      [theme.breakpoints.down("md")]: {
        fontSize: 4,
      },
      fontSize: 6,
      fontWeight: 800,
    },
    poweredByContainer: {
      display: "flex",
      alignItems: "center",
      flexDirection: "column",
      marginRight: "auto",
      marginBottom: theme.spacing(-2),
      color: theme.palette.primary.contrastText,
      "&:hover": {
        textDecoration: "none",
      },
      [theme.breakpoints.down("md")]: {
        marginBottom: 0,
      },
    },
    dropDownBgColorInMobile: (props) => ({
      backgroundColor: props.isCustomHub
        ? theme.palette.primary.main
        : theme.palette.secondary.main,
    }),
    dropdownMenuInMobile: {
      maxHeight: 0,
      opacity: 0,
      overflow: "hidden",
      transition: `max-height 0.3s ease, opacity 0.3s ease`,
    },
    dropdownMenuInMobileOpen: {
      maxHeight: "150px",
      opacity: 1,
    },
  };
});

export default function Header({
  className,
  noSpacingBottom,
  isStaticPage,
  fixedHeader,
  transparentHeader,
  background,
  isHubPage,
  hubUrl,
  isLandingPage,
  hasHubLandingPage,
}: HeaderProps) {
  const {
    user,
    signOut,
    notifications,
    pathName,
    locale,
    CUSTOM_HUB_URLS,
    LOCATION_HUBS,
  } = useContext(UserContext);

  const texts = getTexts({ page: "navigation", locale: locale });
  const [anchorEl, setAnchorEl] = useState<false | null | HTMLElement>(false);
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const isMediumScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down(960));
  const customHubUrls = CUSTOM_HUB_URLS || ["prio1"];
  const isCustomHub = customHubUrls.includes(hubUrl);
  const isLocationHub = LOCATION_HUBS.includes(hubUrl);

  const LINKS = getLinks(
    pathName,
    texts,
    isLocationHub,
    isCustomHub,
    hasHubLandingPage,
    hubUrl,
    isLandingPage
  );
  const classes = useStyles({
    fixedHeader: fixedHeader,
    transparentHeader: transparentHeader,
    isStaticPage: isStaticPage,
    background: background,
    isHubPage: isHubPage,
    isLocationHub: isLocationHub,
    isCustomHub: isCustomHub,
    isLoggedInUser: user ? true : false,
    isLandingPage: isLandingPage,
  });

  const toggleShowNotifications = (event) => {
    if (!anchorEl) setAnchorEl(event.currentTarget);
    else setAnchorEl(null);
  };
  const localePrefix = getLocalePrefix(locale);

  const onNotificationsClose = () => setAnchorEl(null);

  useEffect(() => {
    if (!anchorEl) return;
    const handleScroll = () => setAnchorEl(null);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [anchorEl]);

  const getLogo = () => {
    const imageUrl = "/images";
    if (isCustomHub) {
      return `${imageUrl}/hub_logos/ch_${hubUrl}_logo.svg`;
    }

    if (hubUrl && isLocationHub) {
      const logoType = transparentHeader || isLandingPage ? "white" : null;
      return `${imageUrl}/hub_logos/ch_${hubUrl?.toLowerCase()}_logo${
        logoType ? `_${logoType}` : ""
      }.svg`;
    }

    return loadDefaultLogo(transparentHeader, isMediumScreen, locale);
  };

  const loadFallbackLogo = (
    ev // TODO: implementing better with re-rendering after screen size change
  ) => (ev.target.src = loadDefaultLogo(transparentHeader, isMediumScreen, locale));

  const loadDefaultLogo = (
    transparentHeader?: boolean,
    isMediumScreen?: boolean,
    locale?: string
  ): string => {
    if (isMediumScreen) {
      return transparentHeader ? "/images/logo_white_no_text.svg" : "/images/logo_no_text.svg";
    }
    return getLogoSrc(transparentHeader ? "white" : "normal", locale);
  };

  const logo = getLogo();
  const getLogoLink = () => {
    if (hubUrl) {
      return `${localePrefix}/hubs/${hubUrl}/browse`;
    }
    return `${localePrefix}/`;
  };
  const logoLink = getLogoLink();
  const poweredByLogoMap: Record<string, string> = {
    prio1: getLogoSrc("white", locale),
    perth: getLogoSrc("normal", locale),
  };
  const poweredByLogoSrc = poweredByLogoMap[hubUrl?.toLowerCase() ?? ""] || getLogoSrc("white");

  return (
    <Box
      component="header"
      className={`${classes.root} ${className} ${!noSpacingBottom && classes.spacingBottom}`}
    >
      <Container className={classes.container}>
        <Link href={logoLink} className={classes.logoLink} underline="hover">
          <img
            src={logo}
            alt={texts.climate_connect_logo}
            className={classes.logo}
            onError={loadFallbackLogo}
          />
        </Link>
        {isCustomHub && (
          <Link href={localePrefix + "/"} className={classes.poweredByContainer}>
            <span className={classes.poweredByTxt}>{texts.powered_by}</span>
            <img
              src={poweredByLogoSrc}
              alt={texts.climate_connect_logo}
              className={classes.poweredByImg}
            />
          </Link>
        )}
        {isNarrowScreen || ((isLocationHub || isCustomHub) && isMediumScreen) ? (
          <NarrowScreenLinks
            loggedInUser={user}
            handleLogout={signOut}
            anchorEl={anchorEl}
            toggleShowNotifications={toggleShowNotifications}
            onNotificationsClose={onNotificationsClose}
            notifications={notifications}
            transparentHeader={transparentHeader}
            LINKS={LINKS}
            texts={texts}
            getLoggedInLinks={getLoggedInLinks}
            isCustomHub={isCustomHub}
            hubUrl={hubUrl}
            isLandingPage={isLandingPage}
            classes={classes}
          />
        ) : (
          <NormalScreenLinks
            loggedInUser={user}
            handleLogout={signOut}
            anchorEl={anchorEl}
            toggleShowNotifications={toggleShowNotifications}
            onNotificationsClose={onNotificationsClose}
            notifications={notifications}
            transparentHeader={transparentHeader}
            fixedHeader={fixedHeader}
            LINKS={LINKS}
            texts={texts}
            isStaticPage={isStaticPage}
            getLoggedInLinks={getLoggedInLinks}
            isCustomHub={isCustomHub}
            hubUrl={hubUrl}
            isLandingPage={isLandingPage}
            classes={classes}
          />
        )}
      </Container>
      <div>{isStaticPage && <StaticPageLinks isCustomHub={isCustomHub} />}</div>
    </Box>
  );
}

function NormalScreenLinks({
  loggedInUser,
  handleLogout,
  anchorEl,
  toggleShowNotifications,
  onNotificationsClose,
  notifications,
  transparentHeader,
  fixedHeader,
  LINKS,
  texts,
  isStaticPage,
  getLoggedInLinks,
  isCustomHub,
  hubUrl,
  isLandingPage,
  classes,
}) {
  const { locale } = useContext(UserContext);
  const localePrefix = getLocalePrefix(locale);
  const theme = useTheme();
  const isSmallMediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const isMediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("lg"));
  const STATIC_PAGE_LINKS = getStaticPageLinks(texts, locale, isCustomHub && hubUrl);
  return (
    <Box className={classes.linkContainer}>
      {LINKS.filter(
        (link) =>
          !(loggedInUser && link.onlyShowLoggedOut) &&
          !(!loggedInUser && link.onlyShowLoggedIn) &&
          !link.showOnMobileOnly
      ).map((link, index) => {
        const buttonProps = getLinkButtonProps({
          link: link,
          index: index,
          loggedInUser: loggedInUser,
          classes: classes,
          transparentHeader: transparentHeader,
          toggleShowNotifications: toggleShowNotifications,
          localePrefix: localePrefix,
        });
        const Icon = link.icon;
        if (
          !(isMediumScreen && link.hideOnMediumScreen) &&
          !(isStaticPage && link.hideOnStaticPages)
        )
          return (
            <Fragment key={index}>
              <span>
                {link.type === "languageSelect" ? (
                  <LanguageSelect
                    transparentHeader={transparentHeader}
                    isCustomHub={isCustomHub}
                    isLandingPage={isLandingPage}
                  />
                ) : link.onlyShowIconOnNormalScreen ? (
                  <>
                    <IconButton {...buttonProps} size="large" className={classes.btnColor}>
                      {link.hasBadge && notifications && notifications.length > 0 ? (
                        <Badge badgeContent={notifications.length} color="error">
                          <Icon />
                        </Badge>
                      ) : (
                        <Icon />
                      )}
                    </IconButton>
                    {link.type === "notificationsButton" && anchorEl && (
                      <NotificationsBox
                        anchorEl={anchorEl}
                        keepMounted
                        open={Boolean(anchorEl)}
                        onClose={onNotificationsClose}
                      >
                        <Typography
                          className={classes.notificationsHeadline}
                          component="h1"
                          variant="h5"
                        >
                          {texts.notifications}
                        </Typography>
                        <Divider />
                        {notifications && notifications.length > 0 ? (
                          notifications.map((n, index) => {
                            console.log("notif in map", hubUrl);
                            return <Notification key={index} notification={n} hubUrl={hubUrl} />;
                          })
                        ) : (
                          <Notification key={index} isPlaceholder hubUrl={hubUrl} />
                        )}
                      </NotificationsBox>
                    )}
                  </>
                ) : link?.showStaticLinksInDropdown ? (
                  <DropDownButton options={STATIC_PAGE_LINKS} buttonProps={{ ...buttonProps }}>
                    {isMediumScreen && link.mediumScreenText ? link.mediumScreenText : link.text}
                  </DropDownButton>
                ) : link?.showJustIconUnderSm && isSmallMediumScreen ? (
                  <IconButton {...buttonProps} className={classes.link} size="large">
                    <link.showJustIconUnderSm />
                  </IconButton>
                ) : (
                  <Button {...buttonProps}>
                    {link.icon && !(link.hideDesktopIconUnderSm && isSmallMediumScreen) && (
                      <link.icon className={classes.normalScreenIcon} />
                    )}
                    {isMediumScreen && link.mediumScreenText ? link.mediumScreenText : link.text}
                  </Button>
                )}
              </span>
            </Fragment>
          );
      })}
      {loggedInUser && loggedInUser.url_slug && (
        <LoggedInNormalScreen
          loggedInUser={loggedInUser}
          handleLogout={handleLogout}
          fixedHeader={fixedHeader}
          texts={texts}
          localePrefix={localePrefix}
          getLoggedInLinks={getLoggedInLinks}
          hubUrl={hubUrl}
          classes={classes}
        />
      )}
    </Box>
  );
}
const handleClickMenuItems = (isLogoutButton, url, handleLogout) => {
  // If it's a logout button, handle logout logic first
  if (isLogoutButton) {
    handleLogout();
  }
  // Set the href and force a reload
  if (!isLogoutButton) {
    window.location.href = url;
    window.location.reload();
  }
};
const LoggedInNormalScreen = ({
  loggedInUser,
  handleLogout,
  fixedHeader,
  texts,
  localePrefix,
  getLoggedInLinks,
  hubUrl,
  classes,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef(null);

  const handleToggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
  };

  const avatarProps = {
    className: classes.loggedInAvatar,
    src: getImageUrl(loggedInUser.image),
    alt: loggedInUser.name,
  };
  return (
    <ClickAwayListener onClickAway={handleCloseMenu}>
      <Box className={classes.loggedInRoot}>
        <Button
          onClick={handleToggleMenu}
          disableElevation
          disableRipple
          disableFocusRipple
          style={{ backgroundColor: "transparent" }}
          ref={anchorRef}
          color="inherit"
        >
          {loggedInUser?.badges?.length > 0 ? (
            <ProfileBadge badge={loggedInUser?.badges[0]} size="small" className={classes.badge}>
              <Avatar {...avatarProps} />
            </ProfileBadge>
          ) : (
            <Avatar {...avatarProps} />
          )}
          <ArrowDropDownIcon />
        </Button>
        <Popper
          open={menuOpen}
          anchorEl={anchorRef.current}
          className={`${fixedHeader && classes.loggedInLinksFixedHeader} ${classes.loggedInPopper}`}
        >
          <Paper>
            <MenuList>
              {getLoggedInLinks({ loggedInUser: loggedInUser, texts: texts, hubUrl })
                .filter((link) => !link.showOnMobileOnly)
                .map((link, index) => {
                  const menuItemProps: any = {
                    component: "button",
                    className: classes.loggedInLink,
                  };
                  if (link.isLogoutButton) menuItemProps.onClick = handleLogout;
                  else menuItemProps.href = localePrefix + link.href;
                  const MenuItem_ = MenuItem as any;
                  const newUrl = localePrefix + link.href;
                  return (
                    <MenuItem_ // todo: type issue
                      key={index}
                      component="button"
                      className={classes.loggedInLink}
                      onClick={() =>
                        handleClickMenuItems(link.isLogoutButton, newUrl, handleLogout)
                      }
                      href={!link.isLogoutButton ? localePrefix + link.href : undefined}
                    >
                      {link.text}
                    </MenuItem_>
                  );
                })}
            </MenuList>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

function NarrowScreenLinks({
  loggedInUser,
  handleLogout,
  anchorEl,
  toggleShowNotifications,
  onNotificationsClose,
  notifications,
  transparentHeader,
  LINKS,
  texts,
  getLoggedInLinks,
  isCustomHub,
  hubUrl,
  isLandingPage,
  classes,
}) {
  const { locale } = useContext(UserContext);
  const localePrefix = getLocalePrefix(locale);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const openDrawer = setIsDrawerOpen.bind(null, true);
  const closeDrawer = setIsDrawerOpen.bind(null, false);
  const STATIC_PAGE_LINKS = getStaticPageLinks(texts, locale, isCustomHub && hubUrl);
  const linksOutsideDrawer = LINKS.filter(
    (link) =>
      link.alwaysDisplayDirectly === true &&
      !(loggedInUser && link.onlyShowLoggedOut) &&
      !(!loggedInUser && link.onlyShowLoggedIn)
  );

  return (
    <>
      <Box>
        {linksOutsideDrawer.map((link, index) => {
          const Icon = link.iconForDrawer;
          const buttonProps = getLinkButtonProps({
            link: link,
            index: index,
            loggedInUser: loggedInUser,
            classes: classes,
            transparentHeader: transparentHeader,
            toggleShowNotifications: toggleShowNotifications,
            isNarrowScreen: true,
            linksOutsideDrawer: linksOutsideDrawer,
            localePrefix: localePrefix,
          });

          if (index === linksOutsideDrawer.length - 1) {
            buttonProps.className = classes.marginRight;
          }
          return (
            <Fragment key={index}>
              {link.onlyShowIconOnMobile ? (
                <>
                  <IconButton
                    {...buttonProps}
                    className={`${classes.marginRight} ${classes.btnColor}`}
                    size="large"
                  >
                    {link.hasBadge && notifications && notifications.length > 0 ? (
                      <Badge badgeContent={notifications.length} color="error">
                        <Icon />
                      </Badge>
                    ) : (
                      <Icon />
                    )}
                  </IconButton>
                  {link.type === "notificationsButton" && anchorEl && (
                    <NotificationsBox
                      anchorEl={anchorEl}
                      keepMounted
                      open={Boolean(anchorEl)}
                      onClose={onNotificationsClose}
                    >
                      <Typography
                        className={classes.notificationsHeadline}
                        component="h1"
                        variant="h5"
                      >
                        {texts.notifications}
                      </Typography>
                      <Divider />
                      {notifications && notifications.length > 0 ? (
                        notifications.map((n, index) => (
                          <Notification key={index} notification={n} hubUrl={hubUrl} />
                        ))
                      ) : (
                        <Notification key={index} isPlaceholder hubUrl={hubUrl} />
                      )}
                    </NotificationsBox>
                  )}
                </>
              ) : (
                <span>
                  {link.type === "languageSelect" ? (
                    <LanguageSelect
                      transparentHeader={transparentHeader}
                      isCustomHub={isCustomHub}
                      isLandingPage={isLandingPage}
                    />
                  ) : (
                    <Button {...buttonProps} className={buttonProps.className} key={index}>
                      {link.text}
                    </Button>
                  )}
                </span>
              )}
            </Fragment>
          );
        })}
        <span>
          <IconButton
            edge="start"
            aria-label="menu"
            onClick={openDrawer}
            size="large"
            className={classes.btnColor}
          >
            <MenuIcon />
          </IconButton>
        </span>
        <SwipeableDrawer
          anchor="right"
          open={isDrawerOpen}
          // `onOpen` is a required property, even though we don't use it.
          onOpen={noop}
          onClose={closeDrawer}
          disableBackdropTransition={true}
        >
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <List sx={{ flexGrow: 1 }}>
              <ListItemButton className={classes.languageSelectMobile}>
                <LanguageSelect
                  transparentHeader={transparentHeader}
                  isCustomHub={isCustomHub}
                  isLandingPage={isLandingPage}
                />
              </ListItemButton>
              {LINKS.filter(
                (link) =>
                  (!link.alwaysDisplayDirectly ||
                    !(loggedInUser && link.alwaysDisplayDirectly === "loggedIn")) &&
                  !(loggedInUser && link.onlyShowLoggedOut) &&
                  !(!loggedInUser && link.onlyShowLoggedIn) &&
                  !link.onlyShowOnNormalScreen
              ).map((link, index) => {
                const Icon = link.iconForDrawer;
                if (link.type !== "languageSelect") {
                  if (link?.showStaticLinksInDropdown && isCustomHub) {
                    return (
                      <NarrowScreenDropdownMenu
                        key={index}
                        locale={locale}
                        classes={classes}
                        Icon={Icon}
                        link={link}
                        STATIC_PAGE_LINKS={STATIC_PAGE_LINKS}
                        closeDrawer={closeDrawer}
                      />
                    );
                  } else {
                    return (
                      <Link
                        href={link.isExternalLink ? link.href : localePrefix + link.href}
                        key={index}
                        underline="hover"
                        className={classes.linkUnderline}
                        target={link.isExternalLink ? "_blank" : undefined}
                      >
                        <ListItemButton component="a" onClick={closeDrawer}>
                          <ListItemIcon>
                            <Icon className={classes.drawerItem} />
                          </ListItemIcon>
                          <ListItemText primary={link.text} className={classes.drawerItem} />
                        </ListItemButton>
                      </Link>
                    );
                  }
                }
              })}
              {loggedInUser &&
                loggedInUser.url_slug &&
                getLoggedInLinks({ loggedInUser: loggedInUser, texts: texts, hubUrl }).map(
                  (link, index) => {
                    const Icon: any = link.iconForDrawer;
                    const avatarProps = {
                      className: classes.loggedInAvatarMobile,
                      src: getImageUrl(loggedInUser.image),
                      alt: loggedInUser.name,
                    };
                    if (link.avatar)
                      return (
                        <div className={classes.mobileAvatarContainer} key={index}>
                          <Link
                            href={appHref("/profiles/" + loggedInUser.url_slug, { hubUrl, locale })}
                            underline="hover"
                          >
                            {loggedInUser?.badges?.length > 0 ? (
                              <ProfileBadge
                                badge={loggedInUser?.badges[0]}
                                size="medium"
                                className={classes.badge}
                              >
                                <Avatar {...avatarProps} />
                              </ProfileBadge>
                            ) : (
                              <Avatar {...avatarProps} />
                            )}
                          </Link>
                        </div>
                      );
                    else if (link.isLogoutButton)
                      return (
                        <ListItemButton component="a" key={index} onClick={handleLogout}>
                          <ListItemIcon>
                            <Icon className={classes.drawerItem} />
                          </ListItemIcon>
                          <ListItemText primary={link.text} className={classes.drawerItem} />
                        </ListItemButton>
                      );
                    else
                      return (
                        <Link
                          href={localePrefix + link.href}
                          key={index}
                          underline="hover"
                          className={classes.linkUnderline}
                        >
                          <ListItemButton component="a" onClick={closeDrawer}>
                            <ListItemIcon>
                              <Icon className={classes.drawerItem} />
                            </ListItemIcon>
                            <ListItemText primary={link.text} className={classes.drawerItem} />
                          </ListItemButton>
                        </Link>
                      );
                  }
                )}
            </List>
            <List>
              <Divider />
              <Link
                href={localePrefix + "/imprint"}
                underline="hover"
                className={classes.linkUnderline}
              >
                <ListItemButton component="a" onClick={closeDrawer}>
                  <ListItemText primary={texts.imprint} className={classes.drawerItem} />
                </ListItemButton>
              </Link>
              <Link
                href={localePrefix + "/privacy"}
                underline="hover"
                className={classes.linkUnderline}
              >
                <ListItemButton component="a" onClick={closeDrawer}>
                  <ListItemText primary={texts.privacy} className={classes.drawerItem} />
                </ListItemButton>
              </Link>
              <Link
                href={localePrefix + "/terms"}
                underline="hover"
                className={classes.linkUnderline}
              >
                <ListItemButton component="a" onClick={closeDrawer}>
                  <ListItemText primary={texts.terms} className={classes.drawerItem} />
                </ListItemButton>
              </Link>
            </List>
          </Box>
        </SwipeableDrawer>
      </Box>
    </>
  );
}

const NarrowScreenDropdownMenu = ({
  locale,
  classes,
  Icon,
  link,
  STATIC_PAGE_LINKS,
  closeDrawer,
}) => {
  const [openDropdownInMobile, setOpenDropdownInMobile] = useState(false);
  const toggleDropdownInMobile = setOpenDropdownInMobile.bind(null, !openDropdownInMobile);
  return (
    <>
      <ListItemButton component="a" onClick={toggleDropdownInMobile}>
        <ListItemIcon>
          <Icon className={classes.drawerItem} />
        </ListItemIcon>
        <ListItemText primary={link.text} className={classes.drawerItem} />
        <ArrowDropDownIcon className={classes.drawerItem} />
      </ListItemButton>
      <div
        className={`${classes.dropDownBgColorInMobile} ${classes.dropdownMenuInMobile} ${
          openDropdownInMobile ? classes.dropdownMenuInMobileOpen : ""
        }`}
      >
        {STATIC_PAGE_LINKS.map((link, index) => {
          return (
            <Link
              href={getStaticLinkFromItem(locale, link)}
              key={index}
              underline="hover"
              className={classes.linkUnderline}
              target={link.target || "_self"}
            >
              <ListItemButton component="a" onClick={closeDrawer}>
                <ListItemText primary={link.text} className={classes.drawerItem} />
              </ListItemButton>
            </Link>
          );
        })}
      </div>
    </>
  );
};

const getLinkButtonProps = ({
  link,
  index,
  loggedInUser,
  classes,
  toggleShowNotifications,
  isNarrowScreen,
  linksOutsideDrawer,
  localePrefix,
}: any) => {
  const buttonProps: any = {};
  // why we use index !== 0 here: (!isNarrowScreen && index !== 0)
  // removed index !== 0 from condition because we want to apply the first link className in the header
  if (!isNarrowScreen) {
    if (link.className) {
      // Support multiple classNames in link.className
      // e.g. className: "btnColor buttonMarginLeft", in the heaserLink.ts file
      buttonProps.className = link.className
        .split(" ")
        .map((name) => classes[name])
        .filter(Boolean) // filter(Boolean) removes any undefined values
        .join(" ");
    } else buttonProps.className = classes.buttonMarginLeft;
  }
  if ((isNarrowScreen || loggedInUser || !link.vanillaIfLoggedOut) && link.isOutlinedInHeader) {
    buttonProps.variant = "outlined";
  }
  const contained =
    !isNarrowScreen && (loggedInUser || !link.vanillaIfLoggedOut) && link.isFilledInHeader;
  if (contained) {
    buttonProps.variant = "contained";
  }

  if (!isNarrowScreen && (loggedInUser || !link.vanillaIfLoggedOut) && link.icon) {
    buttonProps.starticon = <link.icon />;
  }

  // if (!transparentHeader) buttonProps.color = "primary";
  else if (!contained && link.type !== "notificationsButton") buttonProps.color = "inherit";
  if (link.type === "notificationsButton") buttonProps.onClick = toggleShowNotifications;
  if (link.href) {
    if (link.isExternalLink) {
      buttonProps.href = link.href;
      buttonProps.target = "_blank";
    } else {
      buttonProps.href = localePrefix + link.href;
    }
  }
  if (isNarrowScreen && index === linksOutsideDrawer.length - 1) {
    buttonProps.className = classes.marginRight;
  }

  return buttonProps;
};

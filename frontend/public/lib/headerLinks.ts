import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import HomeIcon from "@mui/icons-material/Home";
import InfoIcon from "@mui/icons-material/Info";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SettingsIcon from "@mui/icons-material/Settings";
import { appHref } from "./appLink";
import { getCustomHubData } from "../data/customHubData";
import { WASSERAKTIONSWOCHEN_PATH } from "../data/wasseraktionswochen_config";

const ERLANGEN_SLUG = "erlangen";
const ERLANGEN_DONATE = "https://www.climatehub.earth/300";
const COMMON_LINKS = {
  NOTIFICATIONS: {
    type: "notificationsButton",
    iconForDrawer: NotificationsIcon,
    hasBadge: true,
    onlyShowIconOnNormalScreen: true,
    onlyShowIconOnMobile: true,
    icon: NotificationsIcon,
    alwaysDisplayDirectly: true,
    onlyShowOnNormalScreen: true,
  },
  SHARE: (hubUrl?: string) => ({
    href: appHref("/share", { hubUrl }),
    iconForDrawer: AddCircleIcon,
    icon: AddCircleOutlineIcon,
    hideDesktopIconUnderSm: true,
    isFilledInHeader: true,
    className: "shareProjectButton",
    vanillaIfLoggedOut: true,
  }),
  AUTH_LINKS: (path_to_redirect, texts, hubUrl?: string) => {
    const loginPath = `/login?redirect=${encodeURIComponent(path_to_redirect)}`;
    return [
      {
        href: appHref(loginPath, { hubUrl }),
        text: texts.auth_log_in,
        iconForDrawer: AccountCircleIcon,
        isOutlinedInHeader: true,
        onlyShowLoggedOut: true,
      },
    ];
  },
};

const isWasseraktionswochenPage = (pathToRedirect) =>
  typeof pathToRedirect === "string" && pathToRedirect.startsWith(WASSERAKTIONSWOCHEN_PATH);

const getBrowseLinkText = ({ texts, isLocationHub, isOnLandingPage, hasHubLandingPage }) => {
  if (!isLocationHub) {
    return texts.browse;
  }
  if (isOnLandingPage || hasHubLandingPage) {
    return texts.climate_connect;
  }
  return texts.projects_worldwide;
};

const shouldShowStaticLinksForBrowse = ({ isLocationHub, hasHubLandingPage, isOnLandingPage }) => {
  return Boolean(isLocationHub && (hasHubLandingPage || isOnLandingPage));
};

const buildBrowseLink = ({ texts, isLocationHub, isOnLandingPage, hasHubLandingPage }) => ({
  href: "/browse",
  text: getBrowseLinkText({ texts, isLocationHub, isOnLandingPage, hasHubLandingPage }),
  iconForDrawer: HomeIcon,
  showJustIconUnderSm: HomeIcon,
  showStaticLinksInDropdown: shouldShowStaticLinksForBrowse({
    isLocationHub,
    hasHubLandingPage,
    isOnLandingPage,
  }),
});

const getAboutLinkHref = ({ isOnLandingPage, hasHubLandingPage, hubUrl }) => {
  if (isOnLandingPage && hubUrl) {
    return `/hubs/${hubUrl}/browse`;
  }
  if (hasHubLandingPage && hubUrl) {
    return `/hubs/${hubUrl}/`;
  }
  return "/about";
};

const getAboutLinkText = ({ texts, isLocationHub, hasHubLandingPage, isOnLandingPage }) => {
  if (isOnLandingPage) {
    return texts.return_to_climatehub_projects;
  }
  if (isLocationHub && hasHubLandingPage) {
    return texts.about_climatehub;
  }
  return texts.about;
};

const shouldShowStaticLinksForAbout = ({ isOnLandingPage, isLocationHub, hasHubLandingPage }) => {
  if (isOnLandingPage) {
    return false;
  }
  if (isLocationHub && hasHubLandingPage) {
    return false;
  }
  return true;
};

const buildAboutLink = ({ texts, isLocationHub, hasHubLandingPage, isOnLandingPage, hubUrl }) => ({
  href: getAboutLinkHref({ isOnLandingPage, hasHubLandingPage, hubUrl }),
  text: getAboutLinkText({ texts, isLocationHub, hasHubLandingPage, isOnLandingPage }),
  iconForDrawer: InfoIcon,
  showStaticLinksInDropdown: shouldShowStaticLinksForAbout({
    isOnLandingPage,
    isLocationHub,
    hasHubLandingPage,
  }),
  hideOnStaticPages: true,
});

const getDonateHref = (hubUrl) => (hubUrl === ERLANGEN_SLUG ? ERLANGEN_DONATE : "/donate");

const isDonateExternal = (hubUrl) => hubUrl === ERLANGEN_SLUG;

const buildDonateLink = ({ texts, hubUrl }) => ({
  href: getDonateHref(hubUrl),
  isExternalLink: isDonateExternal(hubUrl),
  text: texts.donate,
  iconForDrawer: FavoriteBorderIcon,
  isOutlinedInHeader: true,
  icon: FavoriteBorderIcon,
  hideDesktopIconUnderSm: true,
  vanillaIfLoggedOut: true,
  hideOnStaticPages: true,
  alwaysDisplayDirectly: "loggedIn",
  className: "btnColor buttonMarginLeft",
});

const getWasseraktionswochenLinks = ({ path_to_redirect, texts, hubUrl, hasHubLandingPage }) => {
  return [
    buildAboutLink({
      texts,
      isLocationHub: true,
      hasHubLandingPage,
      isOnLandingPage: false,
      hubUrl,
    }),
    buildDonateLink({ texts, hubUrl }),
    {
      ...COMMON_LINKS.SHARE(hubUrl),
      text: texts.share_a_project,
      hideOnMediumScreen: false,
      onlyShowIconOnNormalScreen: true,
    },
    {
      type: "languageSelect",
    },
    {
      ...COMMON_LINKS.NOTIFICATIONS,
      text: texts.inbox,
    },
    ...COMMON_LINKS.AUTH_LINKS(path_to_redirect, texts, hubUrl),
  ];
};

const buildBuergerenergieLink = ({ texts }) => ({
  href: "https://climatehub.earth/burgerenergie-em",
  text: texts.emmerdingen_buergerenergie,
  isExternalLink: true,
  iconForDrawer: InfoIcon,
  hideOnStaticPages: true,
  showOnMobileOnly: true,
});

const getDefaultLinks = (
  path_to_redirect,
  texts,
  isLocationHub,
  hasHubLandingPage,
  hubUrl,
  isOnLandingPage
) => {
  const authHubUrl = isLocationHub ? hubUrl : undefined;
  {
    return [
      buildBrowseLink({ texts, isLocationHub, isOnLandingPage, hasHubLandingPage }),
      buildAboutLink({ texts, isLocationHub, hasHubLandingPage, isOnLandingPage, hubUrl }),
      ...(hubUrl === "em" ? [buildBuergerenergieLink({ texts })] : []),
      buildDonateLink({ texts, hubUrl }),
      {
        ...COMMON_LINKS.SHARE(isLocationHub ? hubUrl : undefined),
        text: texts.share_a_project,
        hideOnMediumScreen: isLocationHub,
      },
      {
        type: "languageSelect",
      },
      {
        ...COMMON_LINKS.NOTIFICATIONS,
        text: texts.inbox,
      },
      ...COMMON_LINKS.AUTH_LINKS(path_to_redirect, texts, authHubUrl),
    ];
  }
};

const getLinks = (
  path_to_redirect: string,
  texts: Record<string, string>,
  isLocationHub: boolean | undefined,
  isCustomHub: boolean | undefined,
  hasHubLandingPage: boolean | undefined,
  hubUrl?: any,
  isLandingPage?: boolean
) => {
  if (isWasseraktionswochenPage(path_to_redirect)) {
    return getWasseraktionswochenLinks({
      path_to_redirect,
      texts,
      hubUrl,
      hasHubLandingPage,
    });
  }
  const effectiveIsLocationHub = isLocationHub || isCustomHub;
  return isCustomHub
    ? getCustomHubData({ hubUrl, texts, path_to_redirect })?.headerLinks
    : getDefaultLinks(
        path_to_redirect,
        texts,
        effectiveIsLocationHub,
        hasHubLandingPage,
        hubUrl,
        !!isLandingPage
      );
};

const getLoggedInLinks = ({
  loggedInUser,
  texts,
  hubUrl,
}: {
  loggedInUser: any;
  texts: any;
  hubUrl?: string;
}) => {
  return [
    {
      href: appHref("/profiles/" + loggedInUser.url_slug, { hubUrl }),
      text: texts.my_profile,
      iconForDrawer: AccountCircleIcon,
    },
    {
      href: appHref("/inbox", { hubUrl }),
      text: texts.inbox,
      iconForDrawer: MailOutlineIcon,
    },
    {
      href: appHref(`/profiles/${loggedInUser.url_slug}#projects`, { hubUrl }),
      text: texts.my_projects,
      iconForDrawer: GroupWorkIcon,
    },
    {
      href: appHref(`/profiles/${loggedInUser.url_slug}#organizations`, { hubUrl }),
      text: texts.my_organizations,
      iconForDrawer: GroupWorkIcon,
    },
    {
      href: appHref("/settings", { hubUrl }),
      text: texts.settings,
      iconForDrawer: SettingsIcon,
    },
    {
      avatar: true,
      href: appHref("/profiles/" + loggedInUser.url_slug, { hubUrl }),
      src: loggedInUser.image,
      alt: texts.profile_image_of + " " + loggedInUser.name,
      showOnMobileOnly: true,
    },
    {
      isLogoutButton: true,
      text: texts.log_out,
      iconForDrawer: ExitToAppIcon,
    },
  ];
};

const defaultStaticLinks = (texts, hubUrl) => [
  {
    href: "/about",
    text: texts.about,
  },
  {
    href: hubUrl === ERLANGEN_SLUG ? ERLANGEN_DONATE : "/donate",
    text: texts.donate,
    only_show_on_static_page: true,
  },
  {
    href: "/team",
    text: texts.team,
    parent_item: "/about",
  },
  {
    href: "/verein",
    text: texts.association,
    parent_item: "/about",
    only_show_in_languages: ["de"],
  },
  {
    href: "/jobs",
    text: texts.jobs,
    parent_item: "/about",
  },
  {
    href: "/transparency",
    text: texts.transparency,
    parent_item: "/about",
  },
  /*
  remove donor forest for now as it's outdated
  {
    href: "/donorforest",
    text: texts.donorforest,
    parent_item: "/donate",
  },
  */
  {
    href: "/blog",
    text: texts.blog,
  },
  {
    href: "/press",
    text: texts.press,
  },
  {
    href: "/faq",
    text: texts.faq,
  },
];

const getCustomHubStaticLinks = (url_slug, texts) => {
  const customHubData = getCustomHubData({ hubUrl: url_slug, texts });
  return customHubData?.headerStaticLinks || defaultStaticLinks(texts, url_slug);
};
const getStaticLinks = (texts, customHubUrlSlug) => {
  return !customHubUrlSlug
    ? defaultStaticLinks(texts, "")
    : getCustomHubStaticLinks(customHubUrlSlug, texts);
};

const getStaticLinkFromItem = (locale, item) => {
  if (item.isExternalLink) {
    return item.href;
  }
  // Static / hub-switcher targets are global or hub-route destinations, so the
  // active `?hub=` must never be appended (Category C). `appHref` applies the
  // locale prefix and — because hub routes (`/hubs/...`) already convey the hub
  // in their path — skips `?hub=` automatically, preventing a stale
  // `?hub=<old>` from leaking onto a different hub.
  return appHref(item.href, { leaveHub: true, locale });
};

export { getLinks, getLoggedInLinks, getStaticLinks, getStaticLinkFromItem, COMMON_LINKS };

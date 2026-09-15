import { COMMON_LINKS } from "../../lib/headerLinks";
import { Link } from "../customHubtypes";
import InfoIcon from "@mui/icons-material/Info";

type GetLinksOptions = {
  baseUrl: string;
  hubKey: string;
  mainTextKey: string;
};

export const getSharedLinks = (
  pathToRedirect: string,
  texts: any,
  options: GetLinksOptions
): Link[] => [
  {
    href: options.baseUrl,
    text: texts[options.mainTextKey],
    iconForDrawer: InfoIcon,
    hideOnStaticPages: true,
    isExternalLink: true,
    className: "btnIconTextColor",
  },
  {
    ...COMMON_LINKS.SHARE(options.hubKey),
    text: texts.share_a_project,
    hideOnMediumScreen: true,
  },
  {
    type: "languageSelect",
  },
  {
    ...COMMON_LINKS.NOTIFICATIONS,
    text: texts.inbox,
  },
  ...COMMON_LINKS.AUTH_LINKS(pathToRedirect, texts, options.hubKey),
];

export type StaticLinkConfig = {
  href: string;
  textKey: string;
  baseUrl?: string;
  target?: string;
  isExternalLink?: boolean;
};

export function getStaticLinks(texts: any, configs: StaticLinkConfig[], baseUrl?: string): Link[] {
  return configs.map(({ href, textKey, target = "_blank", isExternalLink = true }) => ({
    href: baseUrl ? `${baseUrl}${href}` : href,
    text: texts[textKey],
    target,
    isExternalLink,
  }));
}

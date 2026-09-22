import { ClassNameMap } from "@mui/styles";
import { User, CcLocale, Project } from "../../src/types";
import getAboutTexts from "./about_texts";
import account_texts from "./account_texts.json";
import activate_email from "./activate_email.json";
import chat_texts from "./chat_texts.json";
import getCommunicationTexts from "./communication_texts";
import cookie_texts from "./cookie_texts.json";
import getDashboardTexts from "./dashboard_texts";
import getDonateTexts from "./donate_texts";
import getFaqTexts from "./faq_texts";
import getFilterAndSearchTexts from "./filter_and_search_texts";
import general_texts from "./general_texts.json";
import getHubTexts from "./getHubTexts";
import getIdeaTexts from "./idea_texts";
import getLandingPageTexts from "./landing_page_texts";
import navigation_texts from "./navigation_texts.json";
import getNotificationTexts from "./notification_texts";
import getOrganizationTexts from "./organization_texts";
import getProfileTexts from "./profile_texts";
import getProjectTexts from "./project_texts";
import settings_texts from "./settings.json";
import custom_hub_texts from "./custom_hub_texts";

type Page =
  | "about"
  | "account"
  | "activate_email"
  | "chat"
  | "cookie"
  | "communication"
  | "dashboard"
  | "donate"
  | "faq"
  | "filter_and_search"
  | "general"
  | "hub"
  | "idea"
  | "landing_page"
  | "navigation"
  | "notification"
  | "organization"
  | "profile"
  | "project"
  | "settings";
type Args<P extends Page> = {
  classes?: ClassNameMap;
  filterType?: string;
  goal?: string;
  hubName?: string;
  idea?: any;
  isNarrowScreen?: boolean;
  locale: CcLocale;
  organization?: string;
  page: P;
  profile?: string;
  project?: Project;
  url_slug?: string;
  user?: User;
  hubAmbassador?: string;
  creator?: string;
  subHubName?: string;
};

export default function getTexts<P extends Page>({
  classes,
  filterType,
  goal,
  hubName,
  idea,
  isNarrowScreen,
  locale,
  organization,
  page,
  profile,
  project,
  url_slug,
  user,
  hubAmbassador,
  creator,
  subHubName,
}: Args<P>) {
  // These are the multiple text files for various translations. They're
  // split up to reduce the amount of work required to download
  const texts = {
    about: getAboutTexts(classes),
    account: account_texts,
    activate_email: activate_email,
    chat: chat_texts,
    cookie: cookie_texts,
    communication: getCommunicationTexts(),
    dashboard: getDashboardTexts({ user: user, hubName: hubName }),
    donate: getDonateTexts({ classes: classes, goal: goal /*locale*/ }),
    faq: getFaqTexts({ classes: classes, locale: locale }),
    filter_and_search: getFilterAndSearchTexts({
      filterType: filterType,
      hubName: hubName,
      locale: locale,
      subHubName: subHubName,
    }),
    general: general_texts,
    hub: getHubTexts({ hubName: hubName, hubAmbassador: hubAmbassador }),
    idea: getIdeaTexts({
      idea: idea,
      // user: user,
      // url_slug: url_slug,
      // locale: locale,
      creator: creator,
    }),
    landing_page: getLandingPageTexts({ classes: classes, isNarrowScreen: isNarrowScreen }),
    navigation: navigation_texts,
    notification: getNotificationTexts({ idea: idea, project: project }),
    organization: getOrganizationTexts({ organization: organization, locale: locale }),
    profile: getProfileTexts({ profile: profile, locale: locale, hubName: hubName }),
    project: getProjectTexts({
      project: project,
      user: user,
      url_slug: url_slug,
      locale: locale,
      creator: creator,
      hubName: hubName,
    }),
    settings: settings_texts,
  };

  let text = { ...texts[page], ...general_texts };

  if (hubName && hubName in custom_hub_texts) {
    // replaces/updates the general texts with the custom texts
    // if no version is given, the default version is used
    text = { ...text, ...custom_hub_texts[hubName] };
  }

  const defaultLocale = "en";

  const result = {} as Record<string, string>;

  return Object.keys(text).reduce((obj, curKey) => {
    if (text[curKey][locale]) obj[curKey] = text[curKey][locale];
    else obj[curKey] = text[curKey][defaultLocale];
    return obj;
  }, result);
}

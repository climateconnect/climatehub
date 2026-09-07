import { getFashionHubDescription } from "./hubDescriptions/fashion";
import { getFoodHubDescription } from "./hubDescriptions/food";

export default function getHubTexts({ hubName, hubAmbassador }) {
  const generalHubTexts = {
    search_for_solutions_in_sector: {
      en: "Search for climate solutions in the " + hubName + " sector",
      de: "Durchsuche Klimaschutzprojekte im Bereich " + hubName,
    },
    search_projects_in_location: {
      en: "Search climate projects in " + hubName,
      de: "Suche Klimaprojekte in " + hubName,
    },
    search_ideas_in_location: {
      en: "Find inspiring climate ideas from " + hubName,
      de: "Finde inspirierende Klimaschutz-Ideen aus " + hubName,
    },
    search_for_organizations_in_sector: {
      en: "Search for climate organisations in the " + hubName + " sector",
      de: "Durchsuche Klimaschutzorganisationen im Bereich " + hubName,
    },
    search_organization_in_location: {
      en: "Search organisations in " + hubName,
      de: "Suche Organisationen in " + hubName,
    },
    search_profiles_in_location: {
      en: "Search climate actors in " + hubName,
      de: "Suche Klimaschützer*innen in " + hubName,
    },
    more_info_about_hub_coming_soon: {
      en:
        "More Info coming soon! Have a look at the projects and solutions submitted by ClimateHub Network users below!",
      de:
        "Mehr Infos kommen in Kürze! Schau dir unten die Projekte und Lösungen an, die von ClimateHub Netzwerk Nutzern erstellt wurden!",
    },
    less_info: {
      en: "Less Info",
      de: "Weniger Infos",
    },
    more_info: {
      en: "More Info",
      de: "Mehr Infos",
    },
    show_projects: {
      en: "Show Projects",
      de: "Zeige Projekte",
    },
    browse_explainer_text: {
      en: "Find impactful climate change solutions created by ClimateHub Network users.",
      de: "Finde wirksame Klimaschutzprojekte von anderen ClimateHub Netzwerk Nutzer:innen.",
    },
    loading_chart: {
      en: "Loading Chart",
      de: "Lade Diagramm",
    },
    climate_action_hubs: {
      en: "Climate Action Hubs",
      de: "Klimaschutz Hubs",
    },
    hubs_overview_image_alt: {
      en: "Beautiful flat landscape with many hot air balloons taking off",
      de: "Schöne flache Landschaft mit vielen abhebenden Heißluftballons",
    },
    find_climate_solutions_in_each_hub: {
      en: "Find climate solutions in each hub",
      de: "Finde Klima-Lösungen in jedem Hub",
    },
    find_the_best_ways_to_tackle_climate_change_in_each_sector: {
      en: "Find the best ways to tackle climate change in each sector",
      de: "Finde die besten Wege, den Klimawandel in jedem Bereich zu bekämpfen",
    },
    hubs_overview_mobile_explainer_text: {
      en:
        "Find information and concrete solutions on how to effectively fight climate change in each sector.",
      de:
        "Finde Informationen und konkrete Lösungen wie Klimawandel in jedem Bereich effektiv bekämpft werden kann.",
    },
    hubs_overview_largescreen_explainer_text_first_part: {
      en: `On the hub pages you can find information on how to effectively fight climate change in each
        sector. You can find concrete and impactful solutions created by ClimateHub Network users. Get
        inspired and see possible actions how to fight climate change and get involved in a project
        you like. Who knows, maybe you will even find a really cool project that is already working
        great somewhere else and can reproduce it in your home town! Contact the solutions'
        creators directly on the solutions' pages to start a conversation!`,
      de: `In den Hubs findest du Informationen, wie der Klimawandel in jedem Bereich bekämpft werden kann.
        Dort findest du konkrete und wirkungsvolle Lösungen, die von ClimateHub Netzwerk Nutzern erstellt wurden.
        Lass dich inspirieren, finde Aktionen, die zeigen, wie du den Klimawandel bekämpfen kannst und
        engagiere dich in einem Projekt, das dir gefällt. Wer weiß, vielleicht findest du ja auch ein richtig cooles
        Projekt, das woanders schon erfolgreich ist und du kannst es in deiner Stadt reproduzieren! Kontaktiere
        die Projektersteller direkt über die Projektseite und tausche dich mit Ihnen aus!`,
    },
    hubs_overview_largescreen_explainer_text_last_part: {
      en: `Have fun exploring what is possible to save our planet! Remember: The clock is ticking and
      every tenth of a degree matters.`,
      de: `Viel Spaß beim Entdecken der Möglichkeiten wie wir unseren Planeten schützen können! Denk dran: Die Uhr tickt
      und jedes Zehntel-Grad zählt.`,
    },
    find_climate_projects_in_each_sector_in_our_hubs: {
      en: "Find climate projects in each sector in our hubs",
      de: "Finde Klimaprojekte in jedem Sektor in unseren Hubs",
    },
    find_climate_projects_in_each_sector_in_our_hubs_text: {
      en: `Discover facts and concrete climate actions, projects and solutions ClimateHub Network users
      are working on by visiting the Hubs. Get a rundown of every main field of action in the fight
      against climate change.`,
      de: `Entdecke Fakten und konkrete Klima-Aktionen, -Projekte und -Lösungen, an denen ClimateHub Netzwerk Nutzer
      arbeiten, indem du die Hubs besuchst. Verschaffe dir damit einen Überblick über alle wichtigen
      Handlungsfelder im Kampf gegen den Klimawandel.`,
    },
    click_here_to_minimize_info: {
      en: "Click here to minimize the info about the hub",
      de: "Klicke hier, um den Info-Bereich der Hub auszublenden",
    },
    please_create_an_account_or_log_in_to_contact_the_ambassador: {
      en: `Please sign up to contact ${hubAmbassador?.user?.first_name}.`,
      de: `Bitte melde dich an, um ${hubAmbassador?.user?.first_name} zu kontaktieren.`,
    },
    contact_ambassador: {
      en: `Contact ${hubAmbassador?.title}`,
      de: `${hubAmbassador?.title} kontaktieren`,
    },
    all_locations: {
      en: "All Locations",
      de: "Alle Orte",
    },
    do_you_need_support: {
      en: "Do you need support?",
      de: "Brauchst du Unterstützung?",
    },
    local_ambassador_is_there_for_you: {
      en: `${hubAmbassador?.user?.first_name} is responsible for the ClimateHub ${hubName} and is there for you.`,
      de: `${hubAmbassador?.user?.first_name} koordiniert den ClimateHub ${hubName} und ist für dich da.`,
    },
    all_supporters: {
      en: "All supporters",
      de: "Alle Unterstützer",
    },
    the_climatehub_is_supported_by: {
      en: "The ClimateHub is supported by",
      de: "Der ClimateHub wird unterstützt durch",
    },
    all_supporters_and_sponsoring_members: {
      en: "All supporters of the ClimateHub",
      de: "Alle Unterstützer und Fördermitglieder des ClimateHub",
    },
    would_you_like_to_support_the_ClimateHub: {
      en: "Would you also like to support the ClimateHub?",
      de: "Du möchtest den ClimateHub auch unterstützen?",
    },
    you_are_seeing_projects_related_to: {
      en: `You are seeing projects, ideas and events related to the topic "${hubName}"`,
      de: `Du siehst Projekte, Ideen und Events zum Thema "${hubName}"`,
    },
    you_are_seeing_organizations_related_to: {
      en: `You are seeing organisations working on the topic "${hubName}"`,
      de: `Du siehst Organisationen, die am Thema "${hubName}" arbeiten`,
    },
    you_are_seeing_members_related_to: {
      en: `You are seeing people interested in the topic "${hubName}"`,
      de: `Du siehst Menschen, die sich für das Thema "${hubName}" interessieren`,
    },
    you_are_seeing_events_related_to: {
      en: `You are seeing events related to the topic "${hubName}"`,
      de: `Du siehst Events zum Thema "${hubName}"`,
    },
    upcoming_events: {
      en: "Upcoming events",
      de: "Kommende Events",
    },
    event_calendar: {
      en: "Event Calendar",
      de: "Eventkalender",
    },
    more_upcoming_events: {
      en: "More upcoming events",
      de: "Weitere anstehende Events",
    },
    search_events: {
      en: "Search events",
      de: "Events suchen",
    },
    subscribe_to_calendar_button: {
      en: "Subscribe",
      de: "Abonnieren",
    },
    subscribe_dialog_title: {
      en: "Subscribe to event calendar",
      de: "Event-Kalender abonnieren",
    },
    subscribe_dialog_instructions: {
      en:
        "Copy the URL below and add it to your calendar app using 'Subscribe to calendar' or 'Add calendar by URL'.",
      de:
        "Kopiere die URL unten und füge sie in deiner Kalender-App über 'Kalender abonnieren' oder 'Kalender per URL hinzufügen' hinzu.",
    },
    subscribe_open_in_google: {
      en: "Open in Google Calendar",
      de: "In Google Kalender öffnen",
    },
    subscribe_copy_url: {
      en: "Copy URL",
      de: "URL kopieren",
    },
    subscribe_copied: {
      en: "Copied!",
      de: "Kopiert!",
    },
    subscribe_google_lag_note: {
      en:
        "Note: Google Calendar refreshes subscribed feeds every 12\u201324 hours, so new events may take up to a day to appear.",
      de:
        "Hinweis: Google Kalender aktualisiert abonnierte Kalender alle 12\u201324 Stunden, daher können neue Events bis zu einem Tag dauern.",
    },
  };

  if (hubName === "Fashion") return { ...generalHubTexts, ...getFashionHubDescription() };
  if (hubName === "Food") return { ...generalHubTexts, ...getFoodHubDescription() };

  return generalHubTexts;
}

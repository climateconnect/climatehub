import React from "react";

export default function getLandingPageTexts({ classes, isNarrowScreen }) {
  return {
    be_part_of_the_community: {
      en: (
        <>
          <span className={classes?.yellow}>Be part</span> of the community
        </>
      ),
      de: (
        <>
          <span className={classes?.yellow}>Sei Teil</span> der Community
        </>
      ),
    },
    be_part_of_the_community_text: {
      en: `Sign up to Climate Connect - it's free! By signing up you can work together and
      share knowledge and experiences with people taking climate action globally and in your home
      town.`,
      de: `Melde dich bei Climate Connect an - es ist kostenlos! Wenn du dich anmeldest, kannst du
      mit Menschen zusammenarbeiten und Erfahrungen austauschen, die sich weltweit und in deiner Heimatstadt
      für den Klimaschutz engagieren.`,
    },
    whether_youre_working_on_climate_action_fulltime: {
      en:
        "Whether you're working on climate action fulltime, on a volunteer basis or are just looking for what to do against climate change, we're all part of #teamclimate.",
      de:
        "Egal, ob du dich hauptberuflich oder ehrenamtlich für den Klimaschutz engagierst oder einfach nur wissen willst, was Du gegen den Klimawandel tun kannst - wir sind alle Teil von #teamclimate.",
    },
    landing_page_photo_alt: {
      en: "Photo of earth from space at night with some connecting waypoints",
      de: "Foto der Erde aus dem Weltraum bei Nacht mit einigen verbindenden Wegpunkten",
    },
    from_around_the_world: {
      en: "from around the world",
      de: "aus der ganzen Welt",
    },
    //html tag is break point for mobile. Should be roughly in the middle of the sentence
    landing_page_text: {
      en: (
        <>
          Join the global climate action network to connect all
          {!isNarrowScreen ? <br /> : " "}
          climate actors on our planet - the only one we have
        </>
      ),
      de: (
        <>
          Komm ins globale Klimaschutz-Netzwerk, das alle
          {!isNarrowScreen ? <br /> : " "}
          Klimaschutz-Akteure auf unserem Planeten verbindet
        </>
      ),
    },
    explore: {
      en: "Explore",
      de: "Entdecken",
    },
    explore_climate_projects: {
      en: "Explore climate projects",
      de: "Entdecke Klimaschutz-Projekte",
    },
    find_a_climate_action_organization_and_get_involved: {
      en: "Find a climate action organisation and get involved",
      de: "Finde eine Klimaschutzorganisation und bringe dich ein",
    },
    find_a_climate_action_organization_and_get_involved_text: {
      en: `Find nonprofits, associations, companies, institutes, NGOs, local governments and other
      types of organisations taking climate action!`,
      de: `Finde Non-Profit-Organisationen, Verbände, Unternehmen, Institute, Nicht-Regierungs-Organisationen, lokale Regierungen und
      andere Arten von Organisationen, die sich für den Klimaschutz einseten!`,
    },
    find_a_climate_action_organization_and_get_involved_additional_text: {
      en: `You can directly contact the organisation's representative to exchange knowledge,
      find volunteering opportunities or job opportunites.`,
      de: `Du kannst direkt den Repräsentanten der Organisation kontaktieren um Wissen auszutauschen und
      zu lernen, wie du dich einbringen kannst.`,
    },
    explore_all_organizations: {
      en: "Explore all organisations",
      de: "Entdecke alle Organisationen",
    },
    who_we_are: {
      en: "Who we are",
      de: "Wer wir sind",
    },
    find_out_more_about_our_team: {
      en: "Find out about our team",
      de: "Lerne unser Team kennen",
    },
    and_why_we_are_doing_what_we_are_doing: {
      en: "and why we are doing what we are doing",
      de: "und warum wir tun, was wir tun",
    },
    open_hand_offering_a_seedling_with_a_heart_instead_of_leaves: {
      en: "Open hand offering a seedling with a heart instead of leaves",
      de: "Offene Hand, die einen Setzling mit einem Herz anstelle von Blättern anbietet",
    },
    our_mission: {
      en: "Our Mission",
      de: "Unsere Mission",
    },
    learn_about_our_goals_and_values: {
      en: "Learn about our goals and values",
      de: "Erfahre mehr über unsere Ziele und Werte",
    },
    and_what_we_want_to_achieve_with_creating_a_climate_community: {
      en: "and what we want to achieve with creating a climate community",
      de: "und was wir durch den Aufbau einer Klimaschutz Community erreichen wollen ",
    },
    five_people_positioned_around_a_globe_connected_through_lines: {
      en: "5 people positioned around a globe connected through lines",
      de: "5 Personen, die um einen Globus positioniert und durch Linien verbunden sind",
    },
    man_floating_in_the_air_with_a_lightbulb_a_book_a_pen_a_notebook_a_baloon_and_saturn_floating_around_him: {
      en:
        "Man floating in the air with a lightbulb, a book, a pen, a notebook, a baloon and Saturn floating around him",
      de:
        "Mann schwebt in der Luft mit einer Glühbirne, einem Buch, einem Stift, einem Notizbuch, einem Ballon und dem Saturn, der um ihn herum schwebt",
    },
    four_people_at_a_table_working_together_and_giving_each_other_a_high_five: {
      en: "Four people at a table working together and giving each other a high five",
      de: "Vier Personen an einem Tisch arbeiten zusammen und geben sich gegenseitig ein High Five",
    },
    start_now_banner_text: {
      en: (
        <>
          <span className={classes?.yellow}>Work together</span>, feel inspired and make a real
          impact <span className={classes?.yellow}>on climate change!</span>
        </>
      ),
      de: (
        <>
          <span className={classes?.yellow}>Arbeite zusammen</span>, lass dich inspirieren und nimm
          echten Einfluss <span className={classes?.yellow}>auf den Klimawandel!</span>
        </>
      ),
    },
    climate_projects_with: {
      en: "climate projects",
      de: "Klimaprojekten",
    },
    learn_from: {
      en: "Learn from",
      de: "Lerne von",
    },
    citizen_climate_action: {
      en: "Citizen Climate Action in",
      de: "Dein Startpunkt für Klimaschutz-Engagement in",
    },
    climateHub: {
      en: "ClimateHub",
      de: "ClimateHub",
    },
    hub_landing_page_description: {
      en:
        "Find projects and initiatives near you to get involved with and make a difference. The ClimateHub is the place to start if you want to find your group and make an impact.",
      de:
        "Finde Mitstreiter:innen, um in deiner Region gemeinsam für den Klimaschutz anzupacken und etwas für eine nachhaltige Zukunft zu bewirken.",
    },
    hub_landing_page_description_em: {
      en:
        "Find projects and initiatives in the Emmendingen district to get involved with and make a difference. The ClimateHub is the place to start if you want to find your group and make an impact.",
      de:
        "Finde Mitstreiter:innen, um im Landkreis Emmendingen gemeinsam für den Klimaschutz anzupacken und etwas für eine nachhaltige Zukunft zu bewirken.",
    },
    hub_landing_page_description_erlangen: {
      en:
        "Find projects and initiatives in Erlangen to get involved with and make a difference. The ClimateHub is the place to start if you want to find your group and make an impact.",
      de:
        "Finde Mitstreiter:innen, um in Erlangen gemeinsam für den Klimaschutz anzupacken und etwas für eine nachhaltige Zukunft zu bewirken.",
    },
    hub_landing_page_description_kassel: {
      en:
        "Find projects and initiatives in Kassel to get involved with and make a difference. The ClimateHub is the place to start if you want to find your group and make an impact.",
      de:
        "Finde Mitstreiter:innen, um in Kassel gemeinsam für den Klimaschutz anzupacken und etwas für eine nachhaltige Zukunft zu bewirken.",
    },
    hub_landing_page_description_marburg: {
      en:
        "Find projects and initiatives in Marburg to get involved with and make a difference. The ClimateHub is the place to start if you want to find your group and make an impact.",
      de:
        "Finde Mitstreiter:innen, um in Marburg gemeinsam für den Klimaschutz anzupacken und etwas für eine nachhaltige Zukunft zu bewirken.",
    },
    hub_landing_page_description_potsdam: {
      en:
        "Find projects and initiatives in Potsdam to get involved with and make a difference. The ClimateHub is the place to start if you want to find your group and make an impact.",
      de:
        "Finde Mitstreiter:innen, um in Potsdam gemeinsam für den Klimaschutz anzupacken und etwas für eine nachhaltige Zukunft zu bewirken.",
    },
    hub_landing_page_description_wuerzburg: {
      en:
        "Find projects and initiatives in Würzburg to get involved with and make a difference. The ClimateHub is the place to start if you want to find your group and make an impact.",
      de:
        "Finde Mitstreiter:innen, um in Würzburg gemeinsam für den Klimaschutz anzupacken und etwas für eine nachhaltige Zukunft zu bewirken.",
    },
    coordinates_the_climateHub: {
      en: "coordinates the ClimateHub",
      de: "koordiniert den ClimateHub",
    },
    is_there_for_you: {
      en: "and is there for you",
      de: "und ist für dich da.",
    },
  };
}

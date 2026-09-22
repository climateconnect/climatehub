import { Link } from "@mui/material";
import React from "react";
import { appHref } from "../lib/appLink";

export default function getProjectTexts({ project, user, url_slug, locale, creator, hubName }) {
  // Helper function to generate draft text for different project types
  const getDraftText = (type: "project" | "idea" | "event") => {
    const typeConfig = {
      project: {
        enText: "project drafts",
        deText: "Projektentwürfe",
        enSection: "in the my projects section",
        deSection: "Meine Projekte",
      },
      idea: {
        enText: "idea drafts",
        deText: "Ideentwürfe",
        enSection: "in the my ideas section",
        deSection: "Meine Ideen",
      },
      event: {
        enText: "event drafts",
        deText: "Veranstaltungentwürfe",
        enSection: "in the my events section",
        deSection: "Meine Veranstaltungen",
      },
    };

    const config = typeConfig[type];
    const profileUrl = appHref(`/profiles/${user?.url_slug}#projects`, { hubUrl: hubName, locale });

    return {
      en: (
        <>
          You can view, edit and publish your {config.enText}{" "}
          <Link href={profileUrl}>{config.enSection}</Link> of your profile
        </>
      ),
      de: (
        <>
          Du kannst deine {config.deText}{" "}
          <Link href={profileUrl}>im Bereich {config.deSection}</Link> deines Profils ansehen,
          bearbeiten und veröffentlichen
        </>
      ),
    };
  };

  // Helper function to generate "view your X here" text
  const getViewHereText = (type: "project" | "idea" | "event") => {
    const typeConfig = {
      project: {
        enText: "project",
        deText: "Projekt",
      },
      idea: {
        enText: "idea",
        deText: "Idee",
      },
      event: {
        enText: "event",
        deText: "Veranstaltung",
      },
    };

    const config = typeConfig[type];
    const viewUrl = appHref("/projects/" + url_slug, { hubUrl: hubName, locale });

    return {
      en: (
        <>
          You can view your {config.enText} <Link href={viewUrl}>here</Link>
        </>
      ),
      de: (
        <>
          Du kannst dein{config.enText === "event" ? "e" : ""} {config.deText}{" "}
          <Link href={viewUrl}>hier</Link> ansehen
        </>
      ),
    };
  };

  return {
    // Project type translations (based on type_id)
    project_type_idea: {
      en: "Idea",
      de: "Idee",
    },
    project_type_event: {
      en: "Event",
      de: "Event",
    },
    project_type_project: {
      en: "Project",
      de: "Projekt",
    },
    please_log_in_to_edit_project: {
      en: "Please Log In to Edit a project.",
      de: "Bitte logge dich ein, um ein Projekt zu bearbeiten ",
    },
    to_edit_this_project: {
      en: "to edit this project",
      de: ", um dieses Project zu bearbeiten",
    },
    project_not_found: {
      en: "Project not Found",
      de: "Projekt konnte nicht gefunden werden",
    },
    project_does_not_exist: {
      en: "This project does not exist.",
      de: "Dieses Projekt existiert nicht.",
    },
    to_create_a_project: {
      en: "to create a project",
      de: ", um ein Projekt zu erstellen",
    },
    not_a_member: {
      en: "You are not a member of this project",
      de: "Du bist kein Mitglied dieses Projektes",
    },
    "project page": {
      en: "project page",
      de: "Projektseite",
    },
    and_ask_to_be_part_of_the_team: {
      en: "and ask to be part of the team",
      de: "und frag nach, ob du zum Team hinzugefügt werden kannst.",
    },
    no_permissions_to_edit_project: {
      en: "No Permission to Edit this project",
      de: "Du hast keine Erlaubnis das Projekt zu bearbeiten",
    },
    need_to_be_admin_to_manage_project_team: {
      en: "You need to be an administrator of the project to manage the team.",
      de: "Du musst ein Admin des Projekts sein, um das Team zu verwalten.",
    },
    edit_project: {
      en: "Edit Project",
      de: "Projekt bearbeiten",
    },
    edit: {
      en: "Edit",
      de: "Bearbeiten",
    },
    edit_draft: {
      en: "Edit Draft",
      de: "Entwurf bearbeiten",
    },
    no_projects_found: {
      en: "No projects found.",
      de: "Keine Projekte gefunden.",
    },
    project_image_of_project: {
      en: "Project image",
      de: "Bild des Projektes",
    },
    you_have_to_log_in_to_manage_a_projects_members: {
      en: "You have to log in to manage a project's members.",
      de: "Du musst dich einloggen, um die Projektmitglieder zu verwalten",
    },
    please_log_in_to_manage_the_members_of_this_project: {
      en: "Please Log In to Manage the Members of this project",
      de: "Bitte logge dich ein, um die Mitglieder dieses Projekts zu verwalten",
    },
    to_manage_the_members_of_this_project: {
      en: "to manage the members of this project",
      de: ", um die Mitglieder dieses Projekts zu verwalten",
    },
    you_are_not_a_member_of_this_project: {
      en: "You are not a member of this project.",
      de: "Du bist kein Mitglied dieses Projekts.",
    },
    go_to_project_page_and_click_join_to_join: {
      en: (
        <>
          Go to{" "}
          <Link href={appHref("/projects/" + project?.url_slug, { locale })} underline="hover">
            the project page
          </Link>{" "}
          and click join to join it.
        </>
      ),
      de: (
        <>
          Gehe auf{" "}
          <Link href={appHref("/projects/" + project?.url_slug, { locale })} underline="hover">
            die Projektseite
          </Link>{" "}
          und klicke auf {"Mitmachen"}.
        </>
      ),
    },
    you_need_to_be_an_administrator_of_the_project_to_manage_project_members: {
      en: "You need to be an administrator of the project to manage project members.",
      de: "Du musst Admin des Projekts sein, um die Projektmitglieder zu verwalten.",
    },
    no_permission_to_manage_members_of_this_project: {
      en: "No Permission to Manage Members of this project",
      de: "Keine Berechtigung die Mitglieder des Projekts zu verwalten",
    },
    manage_projects_members: {
      en: "Manage Project's Members",
      de: "Projektmitglieder verwalten",
    },
    you_have_successfully_updated_your_team: {
      en: "You have successfully updated your team",
      de: "Du hast dein Team erfolgreich aktualisiert",
    },
    there_must_be_exactly_one_creator_of_a_project: {
      en: "There must be exactly one Super Admin of a project.",
      de: "Für ein Projekt muss es genau eine(n) Super Admin geben.",
    },
    manage_members_of_project: {
      en: `Manage members of ${project?.name}`,
      de: `Mitglieder von ${project?.name} verwalten`,
    },
    team: {
      en: "Team",
      de: "Team",
    },
    discussion: {
      en: "Discussion",
      de: "Diskussion",
    },
    you_have_successfully_left_the_project: {
      en: "You have successfully left the project.",
      de: "Du hast das Projekt erfolgreich verlassen.",
    },
    please_log_in_to_follow_a_project: {
      en: "Please log in to follow a project.",
      de: "Bitte logge dich ein, um einem Projekt zu folgen.",
    },
    please_log_in_to_like_a_project: {
      en: "Please log in to like a project.",
      de: "Bitte logge dich ein, um ein Projekt zu liken.",
    },
    you_cant_leave_a_project_as_the_creator: {
      en: `You can't leave a project as the Super Admin. Please give the Super Admin role to another team member by clicking "Manage Members" in the team tab.`,
      de: `Du kannst das Projekt als Super Admin nicht verlassen. Bitte übertrage diese Rolle auf ein anderes Teammitglied, indem du "Mitglieder verwalten" im Team-Tab klickst`,
    },
    do_you_really_want_to_unfollow: {
      en: "Do you really want to unfollow?",
      de: "Möchtest du dem Projekt wirklich nicht mehr folgen? ",
    },
    are_you_sure_that_you_want_to_unfollow_this_project: {
      en: (
        <>
          Are you sure that you want to unfollow this project?
          <br />
          You {"won't"} receive updates about it anymore
        </>
      ),
      de: (
        <>
          Bist du sicher, dass du diesem Projekt nicht folgen willst?
          <br />
          Du wirst keine Updates mehr davon erhalten
        </>
      ),
    },
    do_you_really_want_to_dislike: {
      en: "Do you really want to remove your like?",
      de: "Möchtest du deinen Like wirklich entfernen? ",
    },

    are_you_sure_that_you_want_to_dislike_this_project: {
      en: "Are you sure that you want to remove your like from this project?",
      de: "Bist du sicher, dass du dieses Projekt nicht mehr liken möchtest?",
    },
    do_you_really_want_to_leave_this_project: {
      en: "Do you really want to leave this project?",
      de: "Möchtest du dieses Projekt wirklich verlassen?",
    },
    are_you_sure_that_you_want_to_leave_this_project: {
      en: "Are you sure that you want to leave this project?",
      de: "Bist du dir sicher, dass du dieses Projekt verlassen möchtest",
    },
    you_wont_be_part_of_the_team_anymore: {
      en: "You won't be part of the team anymore.",
      de: "Du wirst kein Teil dieses Teams mehr sein.",
    },
    you_are_the_only_member_of_this_project: {
      en: (
        <>
          Danger: You are the only member of this project. <br />
          If you leave the project it will be deactivated.
        </>
      ),
      de: (
        <>
          Achtung: Du bist das einzige Mitglied in diesem Projekt. <br />
          Wenn du das Projekt verlässt, wird es deaktiviert.
        </>
      ),
    },
    please_create_an_account_or_log_in_to_contact_a_projects_organizer: {
      en: "Please create an account or log in to contact a project's organizer.",
      de:
        "Bitte erstelle ein Konto oder melde dich an, um die Verantwortlichen des Projektes zu kontaktieren.",
    },
    contact_creator: {
      en: "Contact creator",
      de: "Verantwortliche Kontaktieren",
    },
    contact: {
      en: "Contact",
      de: "Kontaktieren",
    },
    contact_short: {
      en: "Contact",
      de: "Kontakt",
    },
    followers: {
      en: "Followers",
      de: "Followers",
    },
    follower: {
      en: "follower",
      de: "Follower",
    },
    follow: {
      en: "Follow",
      de: "Folgen",
    },
    following: {
      en: "Following",
      de: "Du folgst",
    },
    like: {
      en: "Like",
      de: "Liken",
    },
    liked: {
      en: "Liked",
      de: "Geliked",
    },
    one_like: {
      en: "Like",
      de: "Like",
    },
    likes: {
      en: "Likes",
      de: "Likes",
    },
    leave_project: {
      en: "Leave team",
      de: "Team verlassen",
    },
    in_collaboration_with: {
      en: "in collaboration with",
      de: "in Zusammenarbeit mit",
    },
    total_duration: {
      en: "Total duration",
      de: "Gesamte Laufzeit",
    },
    this_event_is_part_of: {
      en: "This event is part of",
      de: "Dieses Event ist Teil von",
    },
    this_idea_is_part_of: {
      en: "This idea is part of",
      de: "Diese Idee ist Teil von",
    },
    this_project_is_part_of: {
      en: "This project is part of",
      de: "Dieses Projekt ist Teil von",
    },
    project_description: {
      en: `${project?.project_type?.name ? project.project_type.name : "Project"} Description`,
      de: `${project?.project_type?.name ? project.project_type.name : "Projekt"}beschreibung`,
    },
    event_description: {
      en: "Event Description",
      de: "Veranstaltungsbeschreibung",
    },
    idea_description: {
      en: "Idea Description",
      de: "Ideenbeschreibung",
    },
    this_project_hasnt_added_a_description_yet: {
      en: "This project hasn't added a description yet.",
      de: "Zu diesem Projekt wurde noch keine Beschreibung hinzugefügt.",
    },
    this_event_hasnt_added_a_description_yet: {
      en: "The organizers haven't added a description yet.",
      de: "Die Veranstalter:innen haben noch keine Beschreibung hinzugefügt.",
    },
    this_idea_hasnt_added_a_description_yet: {
      en: "So far no detailled description has been added to this idea.",
      de: "Zu dieser Idee wurde noch keine detaillierte Beschreibung hinzugefügt.",
    },
    this_project_is_not_looking_for_collaborators_right_now: {
      en: "This project is not looking for collaborators right now.",
      de: "Für dieses Projekt wird derzeit keine Unterstützung gesucht.",
    },
    progress: {
      en: "Progress",
      de: "Fortschritt",
    },
    follow_the_project_to_be_notified_when_they_make_an_update_post: {
      en: "Follow the project to be notified when they make an update post.",
      de: "Folge dem Projekt, um benachrichtigt zu werden, wenn es ein Update gibt.",
    },
    to_fight_climate_change_we_all_need_to_work_together: {
      en: `To fight climate change, we all need to work together! If you like the project, offer to
      work with the team to make it a success!`,
      de: `Um den Klimawandel zu bekämpfen, müssen wir alle zusammenarbeiten! Wenn dir das Projekt gefällt,
      biete einfach deine Mitarbeit im Team an, um es zu einem Erfolg zu machen!`,
    },
    this_project_is_open_to_collaborators: {
      en: "This project is open to collaborators.",
      de: "Dieses Projekt ist offen für Mitwirkende.",
    },
    connections_to_these_organizations_could_help_the_project: {
      en: "Connections to these organisations could help the project",
      de: "Connections zu diesen Organisationen könnten dem Projekt helfen",
    },
    to_see_this_projects_team_members: {
      en: "to see this project's team  members",
      de: ", um die Teammitglieder dieses Projekts anzusehen",
    },
    to_see_this_projects_followers: {
      en: "to see this project's followers",
      de: ", um die Followers des Projektes zu sehen",
    },
    to_see_this_projects_likes: {
      en: "to see this project's likes",
      de: ", um die Likes des Projektes zu sehen",
    },
    we_could_not_find_any_members_of_this_project: {
      en: "We could not find any members of this project.",
      de: "Wir konnten keine Mitglieder für dieses Projekt finden.",
    },
    allow_collaboration_on_your_project: {
      en: "Are you looking for collaborators for your project?",
      de: "Suchst du noch Unterstützung für dein Projekt?",
    },
    are_you_looking_for_more_people_to_help_implement_the_idea: {
      en: "Are you looking for more people to implement the idea together?",
      de: "Suchst du nach Mitstreiter:innen?",
    },
    are_you_looking_for_people_to_help_with_the_event: {
      en: "Are you looking for people to help organizing the event?",
      de: "Suchst du noch Unterstützer:innen, um das Event zu organisieren?",
    },
    add_connections_that_would_be_beneficial_for_collaborators_to_have: {
      en: "Connections to which organisations would be helpful for the project?",
      de: "Connections zu welchen Organisationen wären für das Projekt hilfreich?",
    },
    add_connections_that_would_be_beneficial_for_collaborators_to_have_idea: {
      en: "Connections to which organisations would be helpful for the project?",
      de: "Connections zu welchen Organisationen wären für die Umsetzung der Idee hilfreich?",
    },
    add_connections_that_would_be_beneficial_for_collaborators_to_have_event: {
      en: "Connections to these organisations would be helpful for organizing the event?",
      de: "Connections zu welchen Organisationen wären für die Event-Organisation hilfreich?",
    },
    to_share_a_project: {
      en: "to share a project",
      de: ", um ein Projekt zu teilen",
    },
    share_your_climate_solution: {
      en: "Share your Climate Solution",
      de: "Teile dein Klimaprojekt",
    },
    my_project_is_part_of_the_prio1_project: {
      de: "Mein Projekt ist Teil des PRIO1 Hubs",
      en: "My project is part of the PRIO1 hub",
    },
    tooltip_my_project_is_part_of_the_prio1_project: {
      de:
        "PRIO1 ist das junge Klima-Netzwerk. erfahre mehr unter prio1-klima.net. Wenn du diese Option auswählst, wird dein Projekt auch im PRIO1 Hub angezeigt.",
      en:
        "PRIO1 is the young climate network. find out more at prio1-klima.net. If you select this option, your project will also be displayed in the PRIO1 Hub.",
    },
    my_idea_is_part_of_the_prio1_project: {
      de: "Meine Idee ist Teil des PRIO1 Hubs",
      en: "My idea is part of the PRIO1 hub",
    },
    tooltip_my_idea_is_part_of_the_prio1_project: {
      de:
        "PRIO1 ist das junge Klima-Netzwerk. erfahre mehr unter prio1-klima.net. Wenn du diese Option auswählst, wird deine Idee auch im PRIO1 Hub angezeigt.",
      en:
        "PRIO1 is the young climate network. find out more at prio1-klima.net. If you select this option, your idea will also be displayed in the PRIO1 Hub.",
    },
    my_event_is_part_of_the_prio1_project: {
      de: "Meine Veranstaltung ist Teil des PRIO1 Hubs",
      en: "My event is part of the PRIO1 hub",
    },
    tooltip_my_event_is_part_of_the_prio1_project: {
      de:
        "PRIO1 ist das junge Klima-Netzwerk. erfahre mehr unter prio1-klima.net. Wenn du diese Option auswählst, wird deine Veranstaltung auch im PRIO1 Hub angezeigt.",
      en:
        "PRIO1 is the young climate network. find out more at prio1-klima.net. If you select this option, your event will also be displayed in the PRIO1 Hub.",
    },

    // This is for project join requests
    requesters_of: {
      en: "Requesters of",
      de: "Anforderer von",
    },
    //Kontext: Followers of Projektname
    followers_of: {
      en: "Followers of",
      de: "Follower von",
    },
    likes_of: {
      en: "Likes of",
      de: "Likes von",
    },
    this_project_does_not_have_any_followers_yet: {
      en: "This project does not have any followers yet.",
      de: "Dieses Projekt hat noch keine Follower",
    },
    this_project_does_not_have_any_likes_yet: {
      en: "This project does not have any likes yet.",
      de: "Dieses Projekt hat noch keine Likes",
    },
    following_since: {
      en: "Following since",
      de: "Folgt seit",
    },
    liking_since: {
      en: "Liking since",
      de: "Gefällt seit",
    },
    delete_draft: {
      en: "Delete Draft",
      de: "Entwurf löschen",
    },
    delete_project: {
      en: "Delete Project",
      de: "Projekt löschen",
    },
    delete_idea: {
      en: "Delete Idea",
      de: "Idee löschen",
    },
    delete_event: {
      en: "Delete Event",
      de: "Event löschen",
    },
    you_can_not_add_the_same_connection_twice: {
      en: "You can not add the same connection twice.",
      de: "Du kannst die gleiche Connection nicht zweimal hinzufügen.",
    },
    personal: {
      en: "Personal",
      de: "Persönlich",
    },
    personal_project: {
      en: "Personal project",
      de: "Persönliches Projekt",
    },
    organizations_project: {
      en: "Organisation's project",
      de: "Projekt einer Organisation",
    },
    personal_idea: {
      en: "Personal idea",
      de: "Persönliche Idee",
    },
    organizations_idea: {
      en: "Organisation's idea",
      de: "Idee einer Organisation",
    },
    personal_event: {
      en: "Personal event",
      de: "Persönliche Veranstaltung",
    },
    organizations_event: {
      en: "Organisation's event",
      de: "Veranstaltung einer Organisation",
    },
    created_by: {
      en: "Created by",
      de: "Erstellt von",
    },
    please_select_an_organization: {
      en: "Please select an organisation.",
      de: "Bitte wähle eine Organisation aus.",
    },
    you_are_not_a_member_of_any_organization_yet: {
      en: "You're not a member of any organisation yet.",
      de: "Du bist noch kein Mitglied einer Organisation.",
    },
    describe_your_project_in_detail_please_only_use_language: {
      en: "Describe your project in detail. Please only use English!",
      de: "Beschreibe dein Projekt im Detail.",
    },
    // \n\n creates two newlines
    describe_your_project_in_more_detail: {
      en: `Describe your ${project?.project_type?.name} in more detail`,
      de: `Beschreibe dein ${project?.project_type?.name} detaillierter.`,
    },
    project_description_youTube_button: {
      en: "Insert YouTube video",
      de: "YouTube-Video einfügen",
    },
    project_description_youTube_url_label: {
      en: "YouTube URL",
      de: "YouTube-URL",
    },
    project_description_youTube_url_invalid: {
      en: "Please enter a valid YouTube URL.",
      de: "Bitte gib eine gültige YouTube-URL ein.",
    },
    project_description_youTube_cancel: {
      en: "Cancel",
      de: "Abbrechen",
    },
    project_description_youTube_insert: {
      en: "Insert",
      de: "Einfügen",
    },
    project_description_character_counter: {
      en: "characters",
      de: "Zeichen",
    },
    add_connections: {
      en: "Add Connections",
      de: "Connections hinzufügen",
    },
    connection: {
      en: "Connection",
      de: "Connection",
    },
    helpful_connections: {
      en: "Helpful Connections",
      de: "Hilfreiche Connections",
    },
    add_a_helpful_connection: {
      en: "Add a helpful connection",
      de: "Füge eine hilfreiche Connection hinzu",
    },
    do_you_really_want_to_delete_your_project: {
      en: "Do you really want to delete your project?",
      de: "Möchtest du das Projekt wirklich löschen?",
    },
    if_you_delete_your_project_it_will_be_lost: {
      en: "If you delete your project, it will be lost. Are you sure that you want to delete it?",
      de:
        "Wenn du dein Projekt löscht, geht es verloren. Bist du dir sicher, dass du es löschen möchtest?",
    },
    briefly_summarise_what_you_are_doing_please_only_use_english: {
      en: "Briefly summarise what you are doing (up to 280 characters)\n\nPlease only use English!",
      de: "Fass kurz zusammen, was ihr tun (bis zu 280 Zeichen)",
    },
    project_categories: {
      en: "Topics",
      de: "Themenfelder",
    },
    project_website: {
      en: "Project website",
      de: "Webseite des Projektes",
    },
    if_your_project_has_a_website_you_can_enter_it_here: {
      en: "If your project has a website, you can enter it here.",
      de: "Falls dein Projekt eine Webseite hat, kannst du sie hier eintragen",
    },
    idea_website: {
      en: "Idea website",
      de: "Webseite der Idee",
    },
    if_your_idea_has_a_website_you_can_enter_it_here: {
      en: "If your idea has a website, you can enter it here.",
      de: "Falls deine Idee eine Webseite hat, kannst du sie hier eintragen",
    },
    event_website: {
      en: "Event website",
      de: "Webseite der Veranstaltung",
    },
    if_your_event_has_a_website_you_can_enter_it_here: {
      en: "If your event has a website, you can enter it here.",
      de: "Falls deine Veranstaltung eine Webseite hat, kannst du sie hier eintragen",
    },
    edit_sectors: {
      en: "Edit topics",
      de: "Themenfelder bearbeiten",
    },
    add_sectors: {
      en: "Add topics",
      de: "Themenfelder hinzufügen",
    },
    project_name: {
      en: "Project name",
      de: "Projekttitel",
    },
    idea_name: {
      en: "Idea name",
      de: "Ideentitel",
    },
    event_name: {
      en: "Event name",
      de: "Veranstaltungsname",
    },
    your_project_draft_is_missing_the_following_reqired_property: {
      en: "Your project draft is missing the following reqired property:",
      de: "In deinem Projektentwurf fehlt folgende erforderliche Eigenschaft:",
    },
    you_have_successfully_edited_your_project: {
      en: "You have successfully edited your project.",
      de: "Du hast dein Projekt erfolgreich bearbeitet.",
    },
    your_project_has_been_published_great_work: {
      en: "Your project has been published. Great work!",
      de: "Dein Projekt wurde veröffentlicht. Gute Arbeit!",
    },
    save_changes_as_draft: {
      en: "Save draft",
      de: "Entwurf speichern",
    },
    save_as_draft: {
      en: "Save as draft",
      de: "Als Entwurf speichern",
    },
    you_have_successfully_deleted_your_project: {
      en: "You have successfully deleted your project.",
      de: "Du hast dein Projekt erfolgreich gelöscht.",
    },
    leave_without_saving_changes: {
      en: "Leave without saving changes?",
      de: "Verlassen, ohne Veränderungen zu speichern?",
    },
    do_you_really_want_to_leave_without_saving_your_changes: {
      en: "Do you really want to leave without saving your changes?",
      de: "Willst du wirklich gehen, ohne die Veränderungen zu speichern?",
    },
    next_step: {
      en: "Next Step",
      de: "Nächster Schritt",
    },
    climate_action_projects_shared_by_climate_connect_users: {
      en: "Climate action projects shared by ClimateHub Network users",
      de: "Klimaschutzprojekte, die ClimateHub Netzwerk Nutzer*innen geteilt haben",
    },
    climate_action_projects_shared_by_climate_connect_users_text: {
      en: `Find the best climate change solutions from around the world. Get involved, share your own
      solutions or spread effective projects and ideas to your location.`,
      de: `Finde spannende Klimaprojekte aus aller Welt. Beteilige dich, teile deine eigenen Lösungen oder setze effektive Projekte auch bei dir vor Ort um.`,
    },
    show_all_projects: {
      en: "Show all projects",
      de: "Alle Projekte anzeigen",
    },
    events_in_this_series: {
      en: "Events in this series",
      de: "Events in dieser Reihe",
    },
    show_all_events: {
      en: "Show all events",
      de: "Alle Events anzeigen",
    },
    please_touch_on_the_following_points_in_your_project_description: {
      en: "Please touch on the following points in your project description",
      de: "Bitte gehe in deiner Projektbeschreibung auf die folgenden Punkte ein",
    },
    if_you_want_to_include_a_video_in_your_project_description: {
      en: `If you want to include a video: the first YouTube link will be converted to an embedded
      video on your project page.`,
      de: `Wenn du ein Video einbinden möchtest: Der erste YouTube-Link wird in ein eingebettetes
      Video auf deiner Projektseite umgewandelt.`,
    },
    if_you_want_to_include_a_video_in_your_idea_description: {
      en: `If you want to include a video: the first YouTube link will be converted to an embedded
      video on your idea page.`,
      de: `Wenn du ein Video einbinden möchtest: Der erste YouTube-Link wird in ein eingebettetes
      Video auf deiner Ideenseite umgewandelt.`,
    },
    if_you_want_to_include_a_video_in_your_event_description: {
      en: `If you want to include a video: the first YouTube link will be converted to an embedded
      video on your event page.`,
      de: `Wenn du ein Video einbinden möchtest: Der erste YouTube-Link wird in ein eingebettetes
      Video auf deiner Veranstaltungsseite umgewandelt.`,
    },
    role_in_project: {
      en: "Role in project",
      de: "Funktion/Aufgabe im Projekt",
    },
    use_the_search_bar_to_add_members_to_your_project: {
      en: "Use the search bar to add members to your project.",
      de: "Benutze die Suchleiste, um Mitglieder zu deinem Projekt hinzuzufügen.",
    },
    use_the_search_bar_to_add_members_to_your_idea: {
      en: "Use the search bar to add members to your idea.",
      de: "Benutze die Suchleiste, um Mitglieder zu deiner Idee hinzuzufügen.",
    },
    use_the_search_bar_to_add_members_to_your_event: {
      en: "Use the search bar to add supporters to your event.",
      de: "Benutze die Suchleiste, um Mitglieder zu deinem Event hinzuzufügen.",
    },
    summarize_your_project: {
      en: "Short Summary Of Your Project",
      de: "Kurze Zusammenfassung deines Projektes",
    },
    summarize_your_event: {
      en: "Short Overview Of Your Event",
      de: "Kurzer Überblick über dein Event",
    },
    summarize_your_idea: {
      en: "Short Summary Of Your Idea",
      de: "Kurze Zusammenfassung deiner Idee",
    },
    briefly_summarise_what_you_are_doing: {
      en: "Briefly summarize what you are doing (up to 280 characters)",
      de: "Fasse kurz zusammen, was du tust (bis zu 280 Zeichen)",
    },
    briefly_summarise_what_you_are_doing_part_one: {
      en:
        "Briefly summarise what you are doing. You have space to fully describe your project later. (",
      de:
        "Gib einen kurzen Überblick darüber, was ihr macht. Du hast nachfolgend noch Platz für eine vollständige Beschreibung (",
    },
    briefly_summarise_what_you_are_doing_part_two: {
      en: " / 280 characters)",
      de: " / 280 Zeichen)",
    },
    search_for_your_team_members: {
      en: "Search for your team members",
      de: "Suche nach deinen Team-Mitgliedern",
    },
    type_the_name_of_the_team_member_you_want_to_add_next: {
      en: "Type the name of the team member you want to add next.",
      de: "Gib den Namen des Team-Mitglieds ein, das du als nächstes hinzufügen möchtest.",
    },
    short_summary: {
      en: "Short summary",
      de: "Kurzzusammenfassung",
    },
    please_add_an_image: {
      en: "Please add an image!",
      de: "Bitte füge ein Bild hinzu!",
    },
    general_information: {
      en: "General Information",
      de: "Allgemeine Information",
    },
    your_project_is: {
      en: "Your project is",
      de: "Dein Projekt ist",
    },
    add_photo_helptext_project: {
      en:
        "Upload a photo that represents your project. This way other climate protectors can see at a glance what your project is about. It is recommended to use a non-transparent image in 16:9 format.",
      de:
        "Lade ein Foto hoch, das dein Projekt repräsentiert. So können andere Klimaschützer*innen auf einen Blick sehen, worum es bei deinem Projekt geht. Wir empfehlen, ein nicht-transparentes Bild im Format 16:9 zu verwenden.",
    },
    add_photo_helptext_idea: {
      en:
        "Upload a photo that represents your idea. This way other climate protectors can see at a glance what your idea is about. It is recommended to use a non-transparent image in 16:9 format.",
      de:
        "Lade ein Foto hoch, das deine Idee repräsentiert. So können andere Klimaschützer*innen auf einen Blick sehen, worum es bei deiner Idee geht. Wir empfehlen, ein nicht-transparentes Bild im Format 16:9 zu verwenden.",
    },
    add_photo_helptext_event: {
      en:
        "Upload a photo that represents your event. This way other climate protectors can see at a glance what your event is about. It is recommended to use a non-transparent image in 16:9 format.",
      de:
        "Lade ein Foto hoch, das deine Veranstaltung repräsentiert. So können andere Klimaschützer*innen auf einen Blick sehen, worum es bei deiner Veranstaltung geht. Wir empfehlen, ein nicht-transparentes Bild im Format 16:9 zu verwenden.",
    },
    short_description_helptext_project: {
      en:
        "Summarize your project in fewer than 280 characters. Other climate protectors should be able to grasp what your project wants to achieve.",
      de:
        "Fasse dein Projekt in weniger als 280 Zeichen zusammen. Andere Klimaschützer*innen sollen verstehen, was dein Projekt erreichen will.",
    },
    short_description_helptext_idea: {
      en:
        "Summarize your idea in fewer than 280 characters. Other climate protectors should be able to grasp what your idea wants to achieve.",
      de:
        "Fasse deine Idee in weniger als 280 Zeichen zusammen. Andere Klimaschützer*innen sollen verstehen, was deine Idee erreichen will.",
    },
    short_description_helptext_event: {
      en:
        "Summarize your event in fewer than 280 characters. Other climate protectors should be able to grasp what your event is about.",
      de:
        "Fasse dein Veranstaltung in weniger als 280 Zeichen zusammen. Andere Klimaschützer*innen sollen verstehen, worum es bei der Veranstaltung geht.",
    },
    description_helptext_project: {
      en:
        "Describe your project in more detail. What are you exactly doing? What is the climate impact of your project?",
      de:
        "Beschreibe dein Projekt genauer. Was machst du genau? Was ist die Klimawirkung deines Projekts?",
    },
    description_helptext_idea: {
      en:
        "Describe your idea in more detail. What do you want to do? What is the climate impact of your idea?",
      de: "Beschreibe deine Idee genauer. Was hast du vor? Was ist die Klimawirkung deiner Idee?",
    },
    description_helptext_event: {
      en:
        "Describe your event in more detail. What are you exactly doing and what can guests expect? What is the climate impact of your event?",
      de:
        "Beschreibe deine Veranstaltung genauer. Was machst du genau und was können Gäste erwarten? Was ist die Klimawirkung deiner Veranstaltung?",
    },
    collaboration_helptext_project: {
      en:
        "Select if you are would be open to accept help and work with other climate protectors on your project.",
      de:
        "Wähle aus, ob du offen bist, Hilfe anzunehmen und mit anderen Klimaschützer*innen an deinem Projekt zu arbeiten.",
    },
    collaboration_helptext_idea: {
      en:
        "Select if you are would be open to accept help and work with other climate protectors on your idea.",
      de:
        "Wähle aus, ob du offen bist, Hilfe anzunehmen und mit anderen Klimaschützer*innen an deiner Idee zu arbeiten.",
    },
    collaboration_helptext_event: {
      en:
        "Select if you are would be open to accept help and work with other climate protectors on your event.",
      de:
        "Wähle aus, ob du offen bist, Hilfe anzunehmen und mit anderen Klimaschützer*innen deine Veranstaltung zu organisieren.",
    },
    add_connections_helptext: {
      en:
        "Add connections that would be helpful for collaborators to have. Specifically this could be connections to organisations that could help accelerate your project.",
      de:
        "Füge Connections hinzu, die für Unterstützende hilfreich sein könnten. Konkret könnten dies Connections zu Organisationen sein, die dein Projekt beschleunigen könnten.",
    },
    search_for_collaborating_organizations: {
      en: "Search for collaborating organisations",
      de: "Suche nach Organisationen, mit denen du/ihr zusammenarbeitet",
    },
    type_the_name_of_the_collaborating_organization_you_want_to_add_next: {
      en: "Type the name of the collaborating organisation you want to add next.",
      de:
        "Gib den Namen der zusammenarbeitenden Organisation ein, die du als nächstes hinzufügen möchtest.",
    },
    use_the_search_bar_to_add_collaborating_organizations: {
      en: "Use the search bar to add collaborating organisations.",
      de: "Verwende die Suchleiste, um zusammenarbeitende Organisationen hinzuzufügen.",
    },
    responsible_organization: {
      en: "Responsible Organisation",
      de: "Verantwortliche Organisation",
    },
    responsible_person_project: {
      en: "Project Creator",
      de: "Verantwortliche*r",
    },
    responsible_person_idea: {
      en: "Idea Creator",
      de: "Ideenersteller*in",
    },
    responsible_person_org: {
      en: "Reponsible for organisation",
      de: "Verantwortliche*r",
    },
    responsible_person_generic: {
      en: "Responsible",
      de: "Verantwortliche*r",
    },
    collaborating_organizations: {
      en: "Collaborating Organisations",
      de: "Zusammenarbeitende Organisation",
    },
    there_has_been_an_error_when_trying_to_publish_your_project: {
      en:
        "There has been an error when trying to publish your project. Check the console for more information.",
      de:
        "Beim Versuch dein Projekt zu veröffentlichen, ist ein Fehler aufgetreten. Prüfen die console für weitere Informationen.",
    },
    we_are_really_happy_that_you_inspire_the_global_climate_action_community: {
      en: "We are really happy that you inspire the global climate action community!",
      de: "Wir freuen uns sehr, dass du die globale Klimaschutz-Community inspirierst!",
    },
    you_can_view_your_project_here: getViewHereText("project"),
    you_can_view_your_idea_here: getViewHereText("idea"),
    you_can_view_your_event_here: getViewHereText("event"),

    add_sectors_that_fit: {
      en: "Add topics which fit:",
      de: "Füge Themenfelder hinzu, die passen:",
    },
    select_1_to_3_sectors_that_fit_your_project: {
      en: "Select 1-3 topics that fit your project",
      de: "Wähle 1-3 Themenfelder, die zu deinem Projekt passen",
    },
    select_1_to_3_sectors_that_fit_your_idea: {
      en: "Select 1-3 topics that fit your idea",
      de: "Wähle 1-3 Themenfelder, die zu deiner Idee passen",
    },
    select_1_to_3_sectors_that_fit_your_event: {
      en: "Select 1-3 topics that fit your event",
      de: "Wähle 1-3 Themenfelder, die zu deiner Veranstaltung passen",
    },
    add_a_sector_where_you_are_active: {
      en: "Add a Topic",
      de: "Füge ein Themenfeld hinzu",
    },
    please_choose_at_least_one_sector: {
      en: "Please choose at least one topic!",
      de: "Bitte wähle mindestens ein Themenfeld aus!",
    },
    you_can_only_choose_up_to_3_sectors: {
      en: "You can only choose up to 3 topics.",
      de: "Du kannst nur bis zu 3 Themenfelder auswählen",
    },
    you_can_combine_categories_text: {
      en: `You can combine categories. For example if you fund treeplanting, select both
      Afforestation/Reforestration and Funding.`,
      de: `Du kannst Kategorien kombinieren. Wenn du zum Beispiel Baumpflanzungen finanzierst, kannst du sowohl
      Aufforstung/Wiederaufforstung, als auch Finanzierung wählen.`,
    },
    this_way_you_can_specify_what_you_are_doing_and_in_which_field: {
      en: "This way you can specify what you are doing and in which field.",
      de: "Auf diese Weise kannst du angeben, was du tust und in welchem Bereich.",
    },
    if_your_organization_does_not_exist_yet_click_here: {
      en: (
        <>
          If your organisation does not exist yet{" "}
          <Link
            href={appHref("/createorganization", { hubUrl: hubName, locale })}
            underline="always"
          >
            click here
          </Link>{" "}
          to create it.
        </>
      ),
      de: (
        <>
          Wenn das Profil deiner Organisation noch nicht existiert,{" "}
          <Link
            href={appHref("/createorganization", { hubUrl: hubName, locale })}
            underline="always"
          >
            klicke hier
          </Link>{" "}
          um sie zu erstellen.
        </>
      ),
    },
    title_with_explanation_and_example: {
      en: "Title (Use a short, compelling title, e.g. 'Generating energy from ocean waves')",
      de: "Titel (Verwende einen kurzen Titel, z. B. 'Energiegewinnung aus Meereswellen')",
    },
    use_a_title_that_makes_people_curious_to_learn_more_about_your_project: {
      en: "Use a title that makes people curious to learn more about your project",
      de: "Nimm einen Titel, der Menschen neugierig macht, mehr über dein Projekt zu erfahren",
    },
    are_you_sure_you_want_to_leave_you_will_lose_your_project: {
      en: "Are you sure you want to leave? You will lose your project.",
      de: "Bist du sicher, dass du abbrechen willst? Du wirst dein Projekt verlieren.",
    },
    add_team: {
      en: "Add team",
      de: "Team hinzufügen",
    },
    translate_project_intro: {
      en: (
        <>
          Because climate change is a global crisis it is important to us that projects are
          available in multiple languages. So far we support german and english.
          <br />
          If you click on {"automatically translate"} you can still edit the text afterwards. If you
          know the language you can of course also translate everything yourself. When you click on
          publish all empty fields will be translated automatically.
        </>
      ),
      de: (
        <>
          Da der Klimawandel eine globale Krise ist, ist es uns wichtig, dass alle Projekte auch auf
          Englisch verfügbar sind.
          <br />
          Wenn du auf {"Automatisch Übersetzen"} klickst, kannst du den Text immer noch bearbeiten.
          Natürlich kannst du auch alles selbst übersetzen. Wenn du auf {"Veröffentlichen"} klickst,
          werden alle leeren Felder automatisch übersetzt.
        </>
      ),
    },
    basic_info: {
      en: "Basic Info",
      de: "Übersicht",
    },
    project_category: {
      en: "Choose topics",
      de: "Themenfelder auswählen",
    },
    allow_collaboration: {
      en: "Allow collaboration",
      de: "Zusammenarbeit zulassen",
    },
    dont_allow_collaboration: {
      en: "Don't allow collaboration",
      de: "Keine Zusammenarbeit gewünscht",
    },
    please_log_in_or_sign_up_to_share_a_project: {
      en: "Please log in or sign up to share a project",
      de: "Bitte logge dich ein oder registriere dich, um ein Projekt zu teilen",
    },
    internal_server_error: {
      en: "Internal Server Error",
      de: "Interner Serverfehler",
    },
    number_of_likes: {
      en: "Number of likes",
      de: "Anzahl der Likes",
    },
    number_of_comments: {
      en: "Number of comments",
      de: "Anzahl an Kommentaren",
    },
    error_when_publishing_project: {
      en: (
        <>
          There has been an error when publishing your project.
          <br />
          Please contact contact@climatehub.org for support
        </>
      ),
      de: (
        <>
          Beim Veröffentlichen deines Projektes gab es einen Fehler.
          <br /> Bitte wende dich an contact@climatehub.org.
        </>
      ),
    },
    tell_others_about_this_project: {
      en: "Tell others about this project!",
      de: "Erzähle anderen von diesem Projekt!",
    },
    climate_protection_project_by: {
      en: "Climate project by ",
      de: "Klimaschutzprojekt von ",
    },
    share_project_email_body: {
      en: `Hey,
      I found this awesome climate project: "${project?.name}"${
        project?.creator &&
        ` created by ${project.creator?.name ? project.creator?.name : creator?.name}`
      }.
      You should check it out here: `,
      de: `Hey,
      Ich habe gerade dieses spannende Klimaschutzprojekt gefunden: "${project?.name}"${
        project?.creator &&
        `, erstellt von ${project.creator?.name ? project.creator?.name : creator?.name}`
      }.
      Schau's dir doch mal an: `,
    },
    your_page_title_project: {
      en: "Your project page",
      de: "Deine Projektseite",
    },
    your_page_title_idea: {
      en: "Your idea page",
      de: "Deine Ideenseite",
    },
    your_page_title_event: {
      en: "Your event page",
      de: "Deine Eventseite",
    },
    content_is_live_headline_project: {
      en: "Your project is live!",
      de: "Dein Projekt ist live!",
    },
    content_is_live_headline_idea: {
      en: "Your idea is live!",
      de: "Deine Idee ist live!",
    },
    content_is_live_headline_event: {
      en: "Your event is live!",
      de: "Dein Event ist live!",
    },
    content_preview_caption_project: {
      en: "This is how your project appears in the overview – click the card to view your page.",
      de:
        "So erscheint dein Projekt in der Übersicht – klicke auf die Karte, um zu deiner Seite zu gelangen.",
    },
    content_preview_caption_idea: {
      en: "This is how your idea appears in the overview – click the card to view your page.",
      de:
        "So erscheint deine Idee in der Übersicht – klicke auf die Karte, um zu deiner Seite zu gelangen.",
    },
    content_preview_caption_event: {
      en: "This is how your event appears in the overview – click the card to view your page.",
      de:
        "So erscheint dein Event in der Übersicht – klicke auf die Karte, um zu deiner Seite zu gelangen.",
    },
    share_cta_headline_project: {
      en: "Spread the word about your project!",
      de: "Erzähle der Welt von deinem Projekt!",
    },
    share_cta_headline_idea: {
      en: "Spread the word about your idea!",
      de: "Erzähle der Welt von deiner Idee!",
    },
    share_cta_headline_event: {
      en: "Spread the word about your event!",
      de: "Erzähle der Welt von deinem Event!",
    },
    share_cta_subtitle_project: {
      en:
        "Now it's time to make it known. Share it with your network and inspire others to join in!",
      de: "Jetzt mach es bekannt! Teile es mit deinem Netzwerk und inspiriere andere mitzumachen!",
    },
    share_cta_subtitle_idea: {
      en: "Share it with your network and inspire others to join in!",
      de: "Teile sie mit deinem Netzwerk und inspiriere andere mitzumachen!",
    },
    share_cta_subtitle_event: {
      en: "Share the link so more people hear about it and join you.",
      de: "Teile den Link, damit mehr Menschen davon erfahren und dabei sind.",
    },
    share_cta_subtitle_event_with_registration: {
      en: "Share the link so people can register and join you.",
      de: "Teile den Link, damit sich Menschen anmelden und dabei sein können.",
    },
    share_own_content_message_title_project: {
      en: `I just published my climate project "${project?.name}" – check it out!`,
      de: `Ich habe gerade mein Klimaschutzprojekt "${project?.name}" veröffentlicht – schau es dir an!`,
    },
    share_own_content_message_title_idea: {
      en: `I just shared my climate idea "${project?.name}" – have a look and get involved!`,
      de: `Ich habe gerade meine Klimaidee "${project?.name}" – schau sie dir an und mach mit!`,
    },
    share_own_content_message_title_event: {
      en: `I'm organizing the climate event "${project?.name}" – check it out!`,
      de: `Ich organisiere das Klima-Event "${project?.name}" – schau es dir an!`,
    },
    share_own_content_message_title_event_with_registration: {
      en: `I'm organizing the climate event "${project?.name}" – check it out and register to join!`,
      de: `Ich organisiere das Klima-Event "${project?.name}" – schau es dir an und melde dich an!`,
    },
    share_own_content_email_body: {
      en: `Hey,
      I just published "${project?.name}" and would love your support.
      Check it out and feel free to share it with others: `,
      de: `Hey,
      ich habe gerade "${project?.name}" veröffentlicht und würde mich über deine Unterstützung freuen.
      Schau es dir gerne an und teile es mit anderen: `,
    },
    share_online_title: {
      en: "Share it online",
      de: "Online teilen",
    },
    share_online_description: {
      en: "Post it where your community is – or copy the link.",
      de: "Poste es, wo deine Community ist – oder kopiere den Link.",
    },
    qr_code_for_print_title: {
      en: "Put it on paper",
      de: "Auf Papier bringen",
    },
    qr_code_for_print_description: {
      en: "Print this QR code on flyers or posters – it links directly to your page.",
      de: "Drucke diesen QR-Code auf Flyer oder Poster – er verlinkt direkt zu deiner Seite.",
    },
    download_qr_code: {
      en: "Download QR code",
      de: "QR-Code herunterladen",
    },
    qr_code_alt_text: {
      en: "QR code linking to your page",
      de: "QR-Code, der zu deiner Seite verlinkt",
    },
    contact_creator_to_know_more_about_project: {
      en: `Contact ${creator?.first_name} if you want to chat about this project.`,
      de: `Kontaktiere ${creator?.first_name}, um über das Projekt zu reden.`,
    },
    contact_creator_to_know_more_about_organization: {
      en: `Contact ${creator?.first_name} if you want to chat about this organisation.`,
      de: `Kontaktiere ${creator?.first_name}, um über diese Organisation zu reden.`,
    },
    contact_creator_to_know_more_about_idea: {
      en: `Contact ${creator?.first_name} if you want to chat about this project.`,
      de: `Kontaktiere ${creator?.first_name}, um über diese Organisation zu reden.`,
    },
    no_open_project_join_requests: {
      en: "There are currently no open join requests",
      de: "Keine offenen Anfragen.",
    },
    project_requesters_dialog_title: {
      en: "Open requests to join project",
      de: "Offene Anfragen zum Mitmachen",
    },
    you_may_also_like_these_projects: {
      en: "You may also like these projects!",
      de: "Dir könnten diese Projekte auch gefallen!",
    },
    view_all_projects: {
      en: "View all projects",
      de: "Alle Projekte anzeigen",
    },
    only_project_admins_can_view_join_requests: {
      en: "Only project admins can view join requests.",
      de: "Nur Projektadministratoren können sehen, wer mitmachen möchte.",
    },
    your_request_has_been_sent: {
      en: "We notified the project owner that you would like to join this project.",
      de: "Die Projektverantwortlichen wurden benachrichtigt, dass du gerne mitmachen möchtest.",
    },
    event_start_date: {
      en: "Event Start Time",
      de: "Start des Events",
    },
    event_finish_date: {
      en: "Event Finish Time",
      de: "Ende des Events",
    },
    event_location: {
      en: "Event Location",
      de: "Veranstaltungsort",
    },
    event_location_helper_text: {
      en:
        "Enter the exact location so others are able to find your event. For online events enter the city or country you are from.",
      de:
        "Gib die genaue Adresse an, damit Interessierte deine Veranstaltung finden können. Bei Online-Events einfach die Stadt, in der du wohnst.",
    },
    this_project_takes_place_online: {
      en: "This project takes place online",
      de: "Dieses Projekt findet online statt",
    },
    this_event_takes_place_online: {
      en: "This event takes place online",
      de: "Dieses Event findet online statt",
    },
    this_idea_takes_place_online: {
      en: "This idea takes place online",
      de: "Diese Idee findet online statt",
    },
    online: {
      en: "Online",
      de: "Online",
    },
    project_location: {
      en: "Project location",
      de: "Projektstandort",
    },
    event_location_section: {
      en: "Event location",
      de: "Veranstaltungsort",
    },
    idea_location: {
      en: "Idea location",
      de: "Ideenstandort",
    },
    share_your_climate_project: {
      en: "What would you like to create?",
      de: "Was möchtest du erstellen?",
    },
    shared: {
      en: "Shared",
      de: "Geteilt",
    },
    event_organized_by: {
      en: "Event organized by",
      de: "Veranstaltung organisiert von",
    },
    project_type: {
      en: "Type",
      de: "Typ",
    },
    end_date_must_be_after_start_date: {
      en: "End date must be after start date",
      de: "Das Enddatum muss nach dem Startdatum sein",
    },
    do_you_want_to_delete_your_project: {
      en: "Do you want to delete this project?",
      de: "Möchtest Du dieses Projekt löschen?",
    },
    registration: {
      en: "Registration",
      de: "Anmeldung",
    },
    registration_settings: {
      en: "Registration settings",
      de: "Eventanmeldung einrichten",
    },
    allow_online_registration: {
      en: "Allow members to register online for the event",
      de: "Mitgliedern erlauben, sich online für das Event anzumelden",
    },
    registration_enabled_help_text: {
      en: "In the next step you can configure the event registration.",
      de: "Im nächsten Schritt kannst du die Eventanmeldung konfigurieren.",
    },
    max_participants: {
      en: "Max. number of guests",
      de: "Max. Anzahl Teilnehmende",
    },
    max_participants_must_be_greater_than_0: {
      en: "Maximum number of guests must be greater than 0",
      de: "Die maximale Anzahl an Teilnehmenden muss größer als 0 sein",
    },
    registration_end_date: {
      en: "End of registration",
      de: "Ende der Anmeldung",
    },
    registration_end_date_must_be_before_event_end_date: {
      en: "Registration end date must be before or equal to the event end date",
      de: "Das Anmeldeende muss vor oder gleich dem Ende des Events liegen",
    },
    edit_registration_settings: {
      en: "Edit registration settings",
      de: "Anmeldeeinstellungen bearbeiten",
    },
    online_registration: {
      en: "Online registration",
      de: "Online-Anmeldung",
    },
    disable_registration_confirm: {
      en:
        "There are already registrations for this event. Disabling registration will hide the registration form from visitors and you won't be able to see the registrations. Alternatively you can also close the registration via the registration settings. Do you want to continue?",
      de:
        "Es gibt bereits Anmeldungen für dieses Event. Das Deaktivieren der Anmeldung blendet das Anmeldeformular für Besucher aus und du wirst nicht mehr sehen können, welche Anmeldungen es gibt. Alternativ kannst du auch die Anmeldung via den Anmeldeeinstellungen schließen. Möchtest du fortfahren?",
    },
    disable_registration: {
      en: "Disable registration",
      de: "Anmeldung deaktivieren",
    },
    registration_settings_saved: {
      en: "Registration settings saved successfully",
      de: "Anmeldeeinstellungen erfolgreich gespeichert",
    },
    registration_end_date_must_be_in_the_future: {
      en: "Registration end date must be in the future",
      de: "Das Anmeldeende muss in der Zukunft liegen",
    },
    registration_status: {
      en: "Status",
      de: "Status",
    },
    registration_status_open: {
      en: "Registration open",
      de: "Anmeldung offen",
    },
    registration_status_closed: {
      en: "Registration closed",
      de: "Anmeldung geschlossen",
    },
    registration_status_full: {
      en: "Event full",
      de: "Veranstaltung ausgebucht",
    },
    registration_status_ended: {
      en: "Registration ended",
      de: "Anmeldung abgelaufen",
    },
    registration_end_date_required: {
      en: "Registration end date is required",
      de: "Ein Anmeldedatum ist erforderlich",
    },
    view_registrations: {
      en: "View registrations",
      de: "Anmeldungen anzeigen",
    },
    registrations: {
      en: "Registrations",
      de: "Anmeldungen",
    },
    no_registration_settings_found: {
      en: "No registration settings found for this event.",
      de: "Keine Anmeldeeinstellungen für dieses Event gefunden.",
    },
    registration_is_open: {
      en: "Registration is open",
      de: "Anmeldung ist offen",
    },
    registration_is_closed: {
      en: "Registration is closed",
      de: "Anmeldung ist geschlossen",
    },
    registration_fully_booked_increase_max_participants: {
      en: "Registration is fully booked. Increase the maximum participants to reopen.",
      de:
        "Die Anmeldung ist ausgebucht. Erhöhe die maximale Teilnehmerzahl, um sie wieder zu öffnen.",
    },
    notify_admins_on_registration: {
      en: "Send a notification to team admins when someone registers or cancels.",
      de: "Sende eine Benachrichtigung an Team-Admins, wenn sich jemand an- oder abmeldet.",
    },
    registration_config_draft_indicator: {
      en:
        "Registration configuration is in draft mode. Complete the setup and publish to make registration visible to visitors.",
      de:
        "Die Anmeldekonfiguration ist im Entwurfsmodus. Schließe die Einrichtung ab und veröffentliche sie, um die Anmeldung für Besucher sichtbar zu machen.",
    },
    publish_registration: {
      en: "Publish registration",
      de: "Anmeldung veröffentlichen",
    },
    registration_setup_incomplete: {
      en: "Registration setup incomplete",
      de: "Anmeldeeinrichtung unvollständig",
    },
    registration_setup_incomplete_description: {
      en: "Complete the registration configuration to start accepting sign-ups.",
      de: "Schließe die Anmeldekonfiguration ab, um Anmeldungen zu akzeptieren.",
    },
    complete_registration_setup: {
      en: "Complete registration setup",
      de: "Anmeldeeinrichtung abschließen",
    },
    registration_config_still_draft_warning: {
      en: "Registration configuration is not yet complete.",
      de: "Die Anmeldekonfiguration ist noch nicht vollständig.",
    },
    registration_custom_fields: {
      en: "Additional registration fields",
      de: "Zusätzliche Anmeldefelder",
    },
    add_registration_field: {
      en: "Add field",
      de: "Feld hinzufügen",
    },
    field_type_checkbox: {
      en: "Checkbox",
      de: "Checkbox",
    },
    field_type_option_select: {
      en: "Single choice",
      de: "Einfachauswahl",
    },
    field_type_inventory: {
      en: "Inventory",
      de: "Inventar",
    },
    single_option_per_guest_notice: {
      en: "Guests can only select one option",
      de: "Gast kann nur eine Option wählen",
    },
    inventory_available_amount: {
      en: "Available amount",
      de: "Verfügbare Menge",
    },
    inventory_max_per_guest: {
      en: "Max per guest",
      de: "Max. pro Gast",
    },
    inventory_description: {
      en: "Description",
      de: "Beschreibung",
    },
    field_type_time_slot_select: {
      en: "Time Slot Select",
      de: "Zeitfenster-Auswahl",
    },
    field_type_text: {
      en: "Text Input",
      de: "Texteingabe",
    },
    registration_text_field_title_label: {
      en: "Title (shown to guest)",
      de: "Titel (wird dem Gast angezeigt)",
    },
    registration_text_field_description_label: {
      en: "Description (optional)",
      de: "Beschreibung (optional)",
    },
    registration_text_field_multiline_label: {
      en: "Multi-line input",
      de: "Mehrzeilige Eingabe",
    },
    registration_text_field_placeholder: {
      en: "Your answer\u2026",
      de: "Deine Antwort\u2026",
    },
    registration_text_field_required_error: {
      en: "Please answer this question.",
      de: "Bitte beantworte diese Frage.",
    },
    registration_text_field_max_length_error: {
      en: "Maximum 300 characters.",
      de: "Maximal 300 Zeichen.",
    },
    time_slot_title: {
      en: "Title",
      de: "Titel",
    },
    time_slot_description: {
      en: "Description",
      de: "Beschreibung",
    },
    time_slot_start_time: {
      en: "Start time",
      de: "Startzeit",
    },
    time_slot_end_time: {
      en: "End time",
      de: "Endzeit",
    },
    time_slot_capacity: {
      en: "Available amount",
      de: "Verfügbare Menge",
    },
    registration_field_description: {
      en: "Description",
      de: "Beschreibung",
    },
    registration_field_required: {
      en: "Required",
      de: "Pflichtfeld",
    },
    option_select_title: {
      en: "Title",
      de: "Titel",
    },
    add_option: {
      en: "Add option",
      de: "Option hinzufügen",
    },
    option_placeholder: {
      en: "Option label",
      de: "Optionsbezeichnung",
    },
    delete_field: {
      en: "Delete field",
      de: "Feld löschen",
    },
    move_field_up: {
      en: "Move up",
      de: "Nach oben",
    },
    move_field_down: {
      en: "Move down",
      de: "Nach unten",
    },
    delete_option: {
      en: "Delete option",
      de: "Option löschen",
    },
    max_registration_fields_reached: {
      en: "Maximum of 15 fields reached",
      de: "Maximal 15 Felder erreicht",
    },
    confirm_delete_field_title: {
      en: "Delete field?",
      de: "Feld löschen?",
    },
    confirm_delete_field_body: {
      en:
        "This will permanently delete the field and any answers already submitted by registrants. This cannot be undone.",
      de:
        "Dieses Feld und alle bereits eingereichten Antworten der Teilnehmenden werden unwiderruflich gelöscht.",
    },
    confirm_delete_option_title: {
      en: "Delete option?",
      de: "Option löschen?",
    },
    confirm_delete_option_body: {
      en:
        "This will permanently delete the option and any answers already submitted for it. This cannot be undone.",
      de:
        "Diese Option und alle bereits eingereichten Antworten dafür werden unwiderruflich gelöscht.",
    },
    edit_field_label: {
      en: "Edit label",
      de: "Bezeichnung bearbeiten",
    },
    field_label_placeholder: {
      en: "Field label",
      de: "Feldbezeichnung",
    },
    field_label_duplicate_error: {
      en: "Label already used by another field",
      de: "Bezeichnung wird bereits von einem anderen Feld verwendet",
    },
    your_project_has_been_saved_as_a_draft: {
      en: "Your project has been saved as a draft!",
      de: "Dein Projekt wurde als Entwurf gespeichert!",
    },
    your_idea_has_been_saved_as_a_draft: {
      en: "Your idea has been saved as a draft!",
      de: "Deine Idee wurde als Entwurf gespeichert!",
    },
    your_event_has_been_saved_as_a_draft: {
      en: "Your event has been saved as a draft!",
      de: "Deine Veranstaltung wurde als Entwurf gespeichert!",
    },
    you_can_view_edit_and_publish_your_project_drafts_in_the: getDraftText("project"),
    you_can_view_edit_and_publish_your_idea_drafts_in_the: getDraftText("idea"),
    you_can_view_edit_and_publish_your_event_drafts_in_the: getDraftText("event"),
    congratulations_your_project_has_been_published: {
      en: "Congratulations! Your project has been published!",
      de: "Glückwunsch! Dein Projekt ist veröffentlicht worden!",
    },
    congratulations_your_idea_has_been_published: {
      en: "Congratulations! Your idea has been published!",
      de: "Glückwunsch! Deine Idee ist veröffentlicht worden!",
    },
    congratulations_your_event_has_been_published: {
      en: "Congratulations! Your event has been published!",
      de: "Glückwunsch! Deine Veranstaltung ist veröffentlicht worden!",
    },
    registered_guests: {
      en: "Registered guests",
      de: "Angemeldete Gäste",
    },
    search_guests: {
      en: "Search by name…",
      de: "Nach Name suchen…",
    },
    first_name: {
      en: "First name",
      de: "Vorname",
    },
    last_name: {
      en: "Last name",
      de: "Nachname",
    },
    registration_date: {
      en: "Registration date",
      de: "Anmeldedatum",
    },
    no_registrations_yet: {
      en: "No registrations yet.",
      de: "Noch keine Anmeldungen.",
    },
    loading_registrations: {
      en: "Loading registrations…",
      de: "Anmeldungen werden geladen…",
    },
    error_loading_registrations: {
      en: "Failed to load registrations. Please try again.",
      de: "Anmeldungen konnten nicht geladen werden. Bitte erneut versuchen.",
    },
    send_email_to_guests: {
      en: "Email guests",
      de: "Gäste per E-Mail benachrichtigen",
    },
    email_subject: {
      en: "Subject",
      de: "Betreff",
    },
    email_message: {
      en: "Message",
      de: "Nachricht",
    },
    send_now: {
      en: "Send now",
      de: "Jetzt senden",
    },
    send_test_to_myself: {
      en: "Send test to myself",
      de: "Testmail an mich senden",
    },
    sending: {
      en: "Sending…",
      de: "Wird gesendet…",
    },
    email_sent_to_guests: {
      en: "Email sent to {count} registered guests.",
      de: "E-Mail an {count} registrierte Gäste gesendet.",
    },
    test_email_sent_to: {
      en: "Test email sent to {email}.",
      de: "Test-E-Mail an {email} gesendet.",
    },
    email_subject_required: {
      en: "Subject is required.",
      de: "Betreff ist erforderlich.",
    },
    email_message_required: {
      en: "Message is required.",
      de: "Nachricht ist erforderlich.",
    },
    email_confirmation_recipients: {
      en: "This email will be sent to {count} registered guests.",
      de: "Diese E-Mail wird an {count} registrierte Gäste gesendet.",
    },
    email_confirmation_admin_cc: {
      en: "Team admins will also receive a copy.",
      de: "Team-Admins erhalten ebenfalls eine Kopie.",
    },
    email_send_to_new_guests_only: {
      en: "Send only to new guests (registered since {date})",
      de: "Nur an neue Gäste senden (registriert seit {date})",
    },
    email_all_guests_will_receive: {
      en: "All {count} active guests will receive this message.",
      de: "Alle {count} aktiven Gäste erhalten diese Nachricht.",
    },
    email_new_guests_will_receive: {
      en: "{count} of {total} guests registered since {date} will receive this message.",
      de:
        "{count} von {total} Gästen, die sich seit {date} registriert haben, erhalten diese Nachricht.",
    },
    editor_bold: {
      en: "Bold",
      de: "Fett",
    },
    editor_italic: {
      en: "Italic",
      de: "Kursiv",
    },
    editor_bullet_list: {
      en: "Bullet list",
      de: "Aufzählung",
    },
    editor_ordered_list: {
      en: "Ordered list",
      de: "Nummerierung",
    },
    editor_align_left: {
      en: "Align left",
      de: "Linksbündig",
    },
    editor_align_center: {
      en: "Align center",
      de: "Zentriert",
    },
    editor_align_right: {
      en: "Align right",
      de: "Rechtsbündig",
    },
    editor_edit_link: {
      en: "Edit link",
      de: "Link bearbeiten",
    },
    editor_add_table: {
      en: "Add table",
      de: "Tabelle einfügen",
    },
    confirm_and_send: {
      en: "Confirm and send",
      de: "Bestätigen und senden",
    },
    back: {
      en: "Back",
      de: "Zurück",
    },
    close: {
      en: "Close",
      de: "Schließen",
    },
    // Event registration translations
    register_for_event: {
      en: "Register for Event",
      de: "Für Veranstaltung anmelden",
    },
    register_now: {
      en: "Register",
      de: "Anmelden",
    },
    booked_out: {
      en: "Booked Out",
      de: "Ausgebucht",
    },
    authentication: {
      en: "Authentication",
      de: "Authentifizierung",
    },
    event_registration: {
      en: "Registration",
      de: "Anmeldung",
    },
    confirmation: {
      en: "Confirmation",
      de: "Bestätigung",
    },
    name: {
      en: "Name",
      de: "Name",
    },
    email: {
      en: "Email",
      de: "E-Mail",
    },
    password: {
      en: "Password",
      de: "Passwort",
    },
    cancel: {
      en: "Cancel",
      de: "Abbrechen",
    },
    confirm_registration: {
      en: "Confirm Registration",
      de: "Anmeldung bestätigen",
    },
    confirm_your_registration_for: {
      en: `Please confirm your registration for ${project?.name}.`,
      de: `Bitte bestätige deine Anmeldung für ${project?.name}.`,
    },
    fill_the_form_and_confirm_your_registration_for: {
      en: `Please fill in the form and confirm your registration for ${project?.name}.`,
      de: `Bitte fülle das Formular aus und bestätige deine Anmeldung für ${project?.name}.`,
    },
    to_register_please_login_or_signup: {
      en: "To register for this event, please log in or sign up!",
      de: "Um dich für diese Veranstaltung anzumelden, melde dich bitte an oder registriere dich!",
    },
    auth_log_in: {
      en: "Log In",
      de: "Anmelden",
    },
    sign_up: {
      en: "Sign Up",
      de: "Registrieren",
    },
    continue: {
      en: "Continue",
      de: "Weiter",
    },
    signup_flow_coming_soon: {
      en: "Sign-up flow coming soon",
      de: "Registrierungsablauf kommt bald",
    },
    youre_registered: {
      en: "You're registered!",
      de: "Du bist angemeldet!",
    },
    a_confirmation_email_has_been_sent: {
      en: "A confirmation email has been sent to you.",
      de: "Eine Bestätigungs-E-Mail wurde an dich gesendet.",
    },
    registration_failed: {
      en: "Registration failed",
      de: "Anmeldung fehlgeschlagen",
    },
    registration_failed_please_try_again: {
      en: "Registration failed. Please try again.",
      de: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    },
    event_is_fully_booked: {
      en: "Event is fully booked",
      de: "Die Veranstaltung ist ausgebucht",
    },
    event_is_fully_booked_message: {
      en:
        "This event has reached its maximum number of participants. Registration is no longer available.",
      de:
        "Diese Veranstaltung hat die maximale Teilnehmerzahl erreicht. Eine Anmeldung ist nicht mehr möglich.",
    },
    registration_period_has_ended: {
      en: "Registration has ended",
      de: "Die Anmeldefrist ist abgelaufen",
    },
    registration_period_has_ended_message: {
      en: "The registration period for this event has ended. Registration is no longer possible.",
      de:
        "Die Anmeldefrist für diese Veranstaltung ist abgelaufen. Eine Anmeldung ist nicht mehr möglich.",
    },
    try_again: {
      en: "Try Again",
      de: "Erneut versuchen",
    },
    seats_available: {
      en: "Seats available",
      de: "Verfügbare Plätze",
    },
    already_registered: {
      en: "Registered ✓",
      de: "Angemeldet ✓",
    },
    already_registered_for_event: {
      en: "You're already registered",
      de: "Du bist bereits angemeldet",
    },
    already_registered_for_event_message: {
      en: "You have an active registration for this event. You do not need to register again.",
      de:
        "Du hast eine aktive Anmeldung für diese Veranstaltung. Du brauchst dich nicht erneut anzumelden.",
    },
    keep_registration: {
      en: "Keep registration",
      de: "Anmeldung behalten",
    },
    cancel_guest_registration: {
      en: "Cancel registration",
      de: "Abmelden",
    },
    cancel_guest_registration_confirm: {
      en: "Are you sure you want to cancel {name}'s registration for {event}?",
      de: "Bist du sicher, dass du die Anmeldung von {name} für {event} stornieren möchtest?",
    },
    message_to_guest_optional: {
      en: "Message to guest (optional)",
      de: "Nachricht an den Gast (optional)",
    },
    cancellation_message_placeholder: {
      en: "Reason for cancellation or instructions for the guest…",
      de: "Grund für die Stornierung oder Hinweise an den Gast…",
    },
    yes_cancel_registration: {
      en: "Yes, cancel registration",
      de: "Ja, abmelden",
    },
    registration_status_active: {
      en: "Active",
      de: "Aktiv",
    },
    registration_status_cancelled: {
      en: "Cancelled",
      de: "Storniert",
    },
    view_registration_answers: {
      en: "View answers",
      de: "Antworten anzeigen",
    },
    registration_answers_modal_title: {
      en: "Registration answers from {name}",
      de: "Anmeldeantworten von {name}",
    },
    registration_answers_modal_title_self: {
      en: "Modify your registration",
      de: "Deine Anmeldung bearbeiten",
    },
    registration_answers_cancelled_notice: {
      en: "This registration has been cancelled.",
      de: "Diese Anmeldung wurde storniert.",
    },
    registration_answer_checked: {
      en: "Checked",
      de: "Angekreuzt",
    },
    registration_answer_unchecked: {
      en: "Not checked",
      de: "Nicht angekreuzt",
    },
    registration_answer_no_selection: {
      en: "No selection",
      de: "Keine Auswahl",
    },
    no_registration_answers: {
      en: "No answers submitted.",
      de: "Keine Antworten eingereicht.",
    },
    cancel_registration: {
      en: "Cancel registration",
      de: "Abmelden",
    },
    cancel_registration_confirm: {
      en: "Are you sure you want to cancel your registration for {event}?",
      de: "Bist du sicher, dass du deine Anmeldung für {event} stornieren möchtest?",
    },
    cancellation_message_to_organizer_label: {
      en: "Message to organizer (optional)",
      de: "Nachricht an den Veranstalter (optional)",
    },
    cancellation_message_to_organizer_placeholder: {
      en: "Tell the organizer why you're cancelling...",
      de: "Erkläre dem Veranstalter, warum du absagst...",
    },
    cancellation_reason: {
      en: "Cancellation reason",
      de: "Stornierungsgrund",
    },
    you_attended_this_event: {
      en: "You attended this event",
      de: "Du hast an dieser Veranstaltung teilgenommen",
    },
    cancel_registration_error: {
      en: "Failed to cancel registration. Please try again.",
      de: "Stornierung fehlgeschlagen. Bitte versuche es erneut.",
    },
    modify_registration: {
      en: "Modify registration",
      de: "Anmeldung bearbeiten",
    },
    this_field_is_required: {
      en: "This field is required.",
      de: "Dieses Feld ist erforderlich.",
    },
    you_must_check_this_box: {
      en: "You must check this box to proceed.",
      de: "Du musst dieses Kontrollkästchen ankreuzen, um fortzufahren.",
    },
    please_select_an_option: {
      en: "Please select an option.",
      de: "Bitte wähle eine Option aus.",
    },
    please_select_inventory_option: {
      en: "Please select an option.",
      de: "Bitte wähle eine Option aus.",
    },
    please_enter_quantity: {
      en: "Please enter a quantity.",
      de: "Bitte gib eine Menge ein.",
    },
    quantity_available: {
      en: "available",
      de: "verfügbar",
    },
    max_per_guest: {
      en: "Max per guest",
      de: "Max. pro Gast",
    },
    quantity_exceeds_max: {
      en: "Quantity cannot exceed the maximum per guest.",
      de: "Die Menge darf das Maximum pro Gast nicht überschreiten.",
    },
    inventory_sold_out: {
      en: "Sold out",
      de: "Ausverkauft",
    },
    please_select_time_slot: {
      en: "Please select a time slot.",
      de: "Bitte wähle ein Zeitfenster aus.",
    },
    time_slot_fully_booked: {
      en: "This time slot is fully booked.",
      de: "Dieses Zeitfenster ist vollständig ausgebucht.",
    },
    required_fields_participation_notice: {
      en:
        "*Required fields - unfortunately, you cannot participate without providing this information",
      de: "*Pflichtfelder - ohne diese Angaben ist eine Teilnahme leider nicht möglich",
    },
    add_to_calendar: {
      en: "Add to Calendar",
      de: "Zum Kalender hinzufügen",
    },
    add_to_google_calendar: {
      en: "Google Calendar",
      de: "Google Kalender",
    },
    add_to_apple_calendar: {
      en: "Apple Calendar / iCal",
      de: "Apple Kalender / iCal",
    },
    you_are_registered_for_this_event: {
      en: "You're registered for this event.",
      de: "Du bist für diese Veranstaltung angemeldet.",
    },
    not_registered_yet_reminder: {
      en: "Not registered yet \u2014 don't forget to sign up!",
      de: "Noch nicht angemeldet \u2014 Vergiss nicht, dich anzumelden!",
    },
  };
}

import { Link } from "@mui/material";
import React from "react";
import { getLocalePrefix } from "../lib/apiOperations";
import getLanguageNames from "../data/languageNames";

export default function getOrganizationTexts({ organization, locale }) {
  const org_lang_name = getLanguageNames(organization?.language, locale);
  return {
    log_in_to_edit_organization: {
      en: "You have to log in to edit an organisation.",
      de: "Du musst dich einloggen, um eine Organisation zu bearbeiten.",
    },
    successfully_edited_organization: {
      en: "You have successfully edited your organisation.",
      de: "Du hast deine Organisation erfolgreich bearbeitet.",
    },
    image_required_error: {
      en: 'Please add an avatar image by clicking the "Add Image" button.',
      de: 'Bitte füge ein Profilbild hinzu, indem du auf den Button "Bild hinzufügen" klickst.',
    },
    type_required_errror: {
      en:
        'Please choose at least one organisation type by clicking the "Add Type" button under the avatar.',
      de:
        'Bitte wähle mindestens einen Organisationstyp aus, indem du auf den Button "Typ hinzufügen" klickst.',
    },
    name_required_error: {
      en: "Please type your organisation name under the avatar image",
      de: "Bitte gib deinen Organisationsnamen unter dem Profilbild der Organisation an",
    },
    location_required_error: {
      en: "Please specify your location",
      de: "Bitte gib einen Standort an",
    },
    how_to_summarize_organization: {
      en:
        "Give a short summary or what your organisation is doing. Below you'll have more space to describe it. (",
      de:
        "Fasse deine Organisation und ihre Aktivitäten kurz zusammen. Unten hast du Platz, sie genauer zu beschreiben. (",
    },
    how_to_describe_organization: {
      en:
        "Describe what your organisation is doing, how you work and what impact you have on climate change. Please only use English!",
      de:
        "Beschreibe, was deine Organisation macht, wie ihr arbeitet und welchen Einfluss ihr auf den Klimawandel habt.",
    },
    we_are_a_suborganization: {
      en: "We are a sub-organisation of a larger organisation (e.g. local group)",
      de: "Wir sind eine Sub-Organisation einer größeren Organisation (z.B. eine lokale Gruppe)",
    },
    parent_organization: {
      en: "Parent organisation",
      de: "Übergeordnete Organisation",
    },
    edit_parent_organization_label: {
      en: "Edit your parent organisation",
      de: "Bearbeite deine übergeordnete Organisation",
    },
    edit_parent_organization_helper_text: {
      en: "Type the name of your parent organisation",
      de: "Gib den Namen der übergeordneten Organisation ein",
    },
    no_organization_found: {
      en: "No organisations found. Try changing or removing your filter or search query.",
      de:
        "Keine Organisation gefunden. Versuche, den Filter oder deine Suchanfrage zu ändern oder zu entfernen.",
    },
    to_manage_org_members: {
      en: "to manage the members of this organisation",
      de: ", um die Mitglieder dieser Organisation zu verwalten",
    },
    you_are_not_a_member_of_this_organization: {
      en: "You are not a member of this organisation.",
      de: "Du bist kein Mitglied dieser Organisation.",
    },
    //Kommt drauf an wie "Join" übersetzt ist?
    go_to_org_page_and_click_join_to_join_it: {
      en: (
        <>
          Go to the{" "}
          <Link
            href={getLocalePrefix(locale) + "/organizations/" + organization?.url_slug}
            underline="hover"
          >
            organisation page
          </Link>{" "}
          and click join to join it.
        </>
      ),
      de: (
        <>
          Gehe auf die{" "}
          <Link
            href={getLocalePrefix(locale) + "/organizations/" + organization?.url_slug}
            underline="hover"
          >
            Organisationsseite
          </Link>{" "}
          und klicke auf {"Join"} um der Organisation beizutreten.
        </>
      ),
    },
    no_permission_to_manage_members_of_this_org: {
      en: "No Permission to Manage Members of this Organisation",
      de: "Keine Berechtigung, um Mitglieder dieser Organisation zu verwalten",
    },
    need_to_be_admin_to_manage_org_members: {
      en: "You need to be an administrator of the organisation to manage organisation members.",
      de: "Du musst Admin dieser Organisation sein, um Mitglieder verwalten zu können.",
    },
    manage_organizations_members: {
      en: "Manage organisation's Members",
      de: "Verwalte die Mitglieder dieser Organisation",
    },
    you_have_to_log_in_to_manage_organization_members: {
      en: "You have to log in to manage an organisation's members.",
      de: "Du musst dich anmelden, um Mitglieder dieser Organisation verwalten zu können.",
    },
    successfully_updated_org_members: {
      en: "You have successfully updated your organisation members",
      de: "Du hast die Mitglieder deiner Organisation erfolgreich aktualisiert",
    },
    there_must_be_exactly_one_creator_of_organization: {
      en: "There must be exactly one Super Admin of an organisation.",
      de: "Es muss genau eine(n) Super Admin einer Organisation geben.",
    },
    manage_members_of_organization_name: {
      en: `Manage members of ${organization?.name}`,
      de: `Verwalte die Mitglieder von ${organization?.name}`,
    },
    search_for_your_organizations_members: {
      en: "Search for your organisation's members",
      de: "Suche nach Mitglieder deiner Organisation",
    },
    type_name_of_next_team_member: {
      en: "Type the name of the team member you want to add next.",
      de: "Gib den Namen deines Team Mitglieds an, den du als nächstes hinzufügen möchtest",
    },
    role_in_organization: {
      en: "Role in organisation",
      de: "Funktion innerhalb der Organisation",
    },
    edit_organization: {
      en: "Edit organisation",
      de: "Organisation bearbeiten",
    },
    to_see_this_organizations_full_information: {
      en: "to see this organisation's full information",
      de: ", um die vollständigen Informationen zu dieser Organisation zu sehen",
    },
    this_organizations_projects: {
      en: `Projects by ${organization?.name}`,
      de: `Projekte von ${organization?.name}`,
    },
    members_of_organization: {
      en: `Members of ${organization?.name}`,
      de: `Mitglieder von ${organization?.name}`,
    },
    this_organization_has_not_listed_any_projects_yet: {
      en: "This organisation has not listed any projects yet!",
      de: "Diese Organisation hat noch keine Projekte geteilt!",
    },
    none_of_the_members_of_this_organization_has_signed_up_yet: {
      en: "None of the members of this organisation has signed up yet!",
      de: "Keins der Mitglieder dieser Organisation hat sich bisher registriert!",
    },
    organizations_logo: {
      en: `${organization?.name}'s logo`,
      de: `${organization?.name}'s Logo`,
    },
    you_have_not_selected_a_parent_organization_either_untick: {
      en:
        "You have not selected a parent organisation. Either untick the sub-organisation field or choose/create your parent organisation.",
      de:
        "Du hast keine übergeordnete Organisation ausgewählt. Deaktiviere entweder das Feld für die Sub-Organisation oder erstelle eine dazugehörige übergeordnete Organisation.",
    },
    an_organization_with_this_name_already_exists: {
      en: "An organisation with this name already exists.",
      de: "Eine Organisation mit dem gleichen Namen existiert bereits.",
    },
    //Context: An organization with this name already exists. Click here to see it.
    to_see_it: {
      en: "to see it.",
      de: ", um mehr zu erfahren.",
    },
    you_have_successfully_created_an_organization_you_can_add_members: {
      en: "You have successfully created an organisation! Now you can add the rest of your team.",
      de:
        "Du hast erfolgreich eine Organisation erstellt! Jetzt kannst du den Rest deines Teams hinzufügen.",
    },
    to_create_an_organization: {
      en: "to create an organisation",
      de: ", um eine Organisation zu erstellen",
    },
    create_an_organization: {
      en: "Create an Organisation",
      de: "Organisation erstellen",
    },
    organization_name: {
      en: "Organisation name",
      de: "Organisationsname",
    },
    we_are_a_sub_organization_of_a_larger_organization: {
      en: "We are a sub-organisation of a larger organisation (e.g. local group)",
      de: "Wir sind eine Sub-Organisation einer größeren Organisation (z.B. eine lokale Gruppe)",
    },
    parent_organization_name: {
      en: "Parent organisation name",
      de: "Name der übergeordneten Organisation",
    },
    search_for_your_parent_organization: {
      en: "Search for your parent organisation",
      de: "Suche nach deiner übergeordneten Organisation",
    },
    type_the_name_of_your_parent_organization: {
      en: "Type the name of your parent organisation.",
      de: "Gib den Namen der übergeordneten Organisation an",
    },
    i_verify_that_i_am_an_authorized_representative_of_this_organization: {
      en: `I verify that I am an authorized representative of this organisation
      and have the right to act on its behalf in the creation and management of this page.`,
      de: `Ich bestätige, dass ich ein(e) autorisierte*r Vertreter*in dieser Organisation
      bin und das Recht habe, in deren Namen bei der Erstellung und Verwaltung dieser Seite zu handeln.`,
    },
    almost_done_here_you_can_customize_your_organization_page_and_add_details: {
      en: "Almost done! Here you can customize your organisation page and add details",
      de: "Fast geschafft! Hier kannst du deine Organisationsseite anpassen und Details hinzufügen",
    },
    translate_organization_intro: {
      en: "",
      de: (
        <>
          Da der Klimawandel eine globale Krise ist, ist es uns wichtig, dass alle
          Organisationsprofile auch auf Englisch verfügbar sind.
          <br />
          Wenn du auf {"Automatisch Übersetzen"} klickst, kannst du den Text immer noch bearbeiten.
          Natürlich kannst du auch alles selbst übersetzen. Wenn du auf {"Veröffentlichen"} klickst,
          werden alle leeren Felder automatisch übersetzt.
        </>
      ),
    },
    about: {
      en: `About`,
      de: `Über uns`,
    },
    large_medium_organization_size: {
      en: "501-1,000",
      de: "501-1.000",
    },
    large_organization_size: {
      en: "1,001-5,000",
      de: "1.001-5.000",
    },
    very_large_organization_size: {
      en: "5,001-50,000",
      de: "5.001-50.000",
    },
    huge_organization_size: {
      en: "Over 50,000",
      de: "Über 50.000",
    },
    organization_size: {
      en: "Members",
      de: "Mitglieder",
    },
    people: {
      en: "people",
      de: "Menschen",
    },
    climate_protection_organization: {
      en: "Interesting climate organisation: ",
      de: "Interessante Klimaschutzorganisation: ",
    },
    tell_others_about_this_organization: {
      en: "Tell others about this organisation!",
      de: "Erzähle anderen von dieser Organisation!",
    },
    share_organization_email_body: {
      en: `Hey,
      I found this awesome climate protection organisation: "${organization?.name}".
      You should check it out here: `,
      de: `Hey,
      Ich habe gerade diese spannende Klimaschutzorganisation gefunden: "${organization?.name}".
      Schau sie dir doch mal an: `,
    },
    skip_for_now: {
      en: "Skip for now",
      de: "Erstmal überspringen",
    },

    please_log_in_to_follow_an_organization: {
      en: "Please log in to follow an organisation.",
      de: "Bitte logge dich ein, um einer Organisation zu folgen.",
    },
    do_you_really_want_to_unfollow: {
      en: "Do you really want to unfollow?",
      de: "Möchtest du dieser Organisation wirklich nicht mehr folgen? ",
    },
    are_you_sure_that_you_want_to_unfollow_this_organization: {
      en: (
        <>
          Are you sure that you want to unfollow this organisation?
          <br />
          You {"won't"} receive updates about it anymore
        </>
      ),
      de: (
        <>
          Bist du sicher, dass du dieser Organisation nicht mehr folgen willst?
          <br />
          Du wirst keine Updates mehr erhalten
        </>
      ),
    },
    followers: {
      en: "Followers",
      de: "Follower",
    },
    follower: {
      en: "Follower",
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
    to_see_this_organizations_followers: {
      en: " to see this organisation's followers",
      de: ", um die Follower der Organisation zu sehen",
    },
    //Kontext: Followers of Organization
    followers_of: {
      en: "Followers of",
      de: "Follower von",
    },
    following_since: {
      en: "Following since",
      de: "Folgt seit",
    },
    this_organzation_does_not_have_any_followers_yet: {
      en: "This organisation does not have any followers yet.",
      de: "Diese Organisation hat noch keine Follower.",
    },
    follow_for_updates: {
      en: "Follow to receive updates!",
      de: "Folgen, um Updates zu erhalten!",
    },
    get_involved: {
      en: "How to get involved",
      de: "Wie man sich einbringen kann",
    },
    get_involved_helptext: {
      en: "e.g. Open online meeting every Wednesday at 6pm. New people always welcome! (",
      de:
        'z.B. "Offenes Treffen jeden Mittwoch um 18 Uhr im Café Margareta. Interessierte sind immer willkommen!" (',
    },
    add_up_to_two_types: {
      en: "Organisation Type (Up to 2)",
      de: "Organisationsart (Bis zu 2)",
    },
    organization_is_active_in_these_sectors: {
      en: `${organization?.name} is active in these topics`,
      de: `${organization?.name} ist in diesen Bereichen aktiv`,
    },
    add_sectors_in_which_your_organization_is_active: {
      en: "Add topics in which your organisation is active",
      de: "Füge Themenbereiche hinzu, in denen deine Organisation aktiv ist",
    },
    someone_has_already_created_organization: {
      en: "Someone has already created the organisation ",
      de: "Jemand erstellte bereits die Organisation ",
    },
    please_join_org_or_use_diff_name_if_problems_contact: {
      en:
        ". Please join the organisation or use a different name. If you're having problems please contact ",
      de:
        ". Bitte trete der Organisation bei oder verwende einen anderen Namen. Falls du Probleme hast, wende dich bitte an ",
    },
    organization_language: {
      en: "Your organisation's language is set to",
      de: "Die Sprache Ihrer Organisation ist",
    },
    edit_in_another_language: {
      en: "but you're trying to edit it in",
      de: "aber Sie versuchen, es zu bearbeiten in",
    },
    please_use_the_button: {
      en: "Please use the 'Check Translations' button",
      de: "Bitte verwenden Sie die Schaltfläche 'Übersetzungen überprüfen'",
    },
    editing_org_in_wrong_language: {
      en: `This organisation was originally shared in ${org_lang_name}. The edit form uses that source language automatically. If you want to update text in other languages, click on "Check Translations" below.`,
      de: `Diese Organisation wurde ursprünglich auf ${org_lang_name} geteilt. Das Bearbeitungsformular verwendet diese Ausgangssprache automatisch. Wenn du Texte in anderen Sprachen anpassen möchtest, klicke unten auf "Übersetzungen überprüfen".`,
    },
    delete_organization: {
      en: "Delete organisation",
      de: "Organisation löschen",
    },
    organization_has_projects_cannot_delete: {
      en:
        "The organisation has {count} projects. Please first delete these projects or assign them to other organisations or users.",
      de:
        "Die Organisation hat {count} Projekte. Bitte lösche diese zuerst oder ordne sie anderen Organisationen oder Benutzer:innen zu.",
    },
    do_you_really_want_to_delete_your_organization: {
      en: "Do you really want to delete your organisation?",
      de: "Möchtest du deine Organisation wirklich löschen?",
    },
    deleting_organization_is_irreversible: {
      en: "This action is irreversible. All members, followers, and related data will be removed.",
      de:
        "Diese Aktion ist unwiderruflich. Alle Mitglieder, Follower und zugehörigen Daten werden entfernt.",
    },
    you_have_successfully_deleted_your_organization: {
      en: "You have successfully deleted your organisation.",
      de: "Du hast deine Organisation erfolgreich gelöscht.",
    },
    server_error: {
      en: "Something went wrong. Please try again.",
      de: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    },
  };
}

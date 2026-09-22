import { Link } from "@mui/material";
import React from "react";
import { appHref } from "../lib/appLink";

export default function getProfileTexts({ profile, hubName, locale }) {
  return {
    no_members_found: {
      en: "No members found. Try changing or removing your filter or search query.",
      de: "Keine Mitglieder gefunden. Versuche, die Filterung oder deine Suchanfrage anzupassen.",
    },
    availability_user_profile_missing_message: {
      en: "This user hasn't specified their availibility yet.",
      de:
        "Diese(r) Benutzer*in hat noch nicht angegeben, wie viele Stunden pro Woche er/sie erreichbar ist.",
    },
    add_skill: {
      en: "Add skill",
      de: "Fähigkeit hinzufügen",
    },
    skills_user_profile_missing_message: {
      en: "This user hasn't added any skills yet.",
      de: "Diese(r) Benutzer*in hat seine/ihre Fähigkeiten noch nicht angegeben.",
    },
    bio: {
      en: "About You (Bio)",
      de: "Über dich (Bio)",
    },
    enter_profile_bio_helptext: {
      en:
        "What got you interested in climate action? What do you do? What are you looking for and/or offering? (",
      de:
        "Was hat dein Interesse an Klimaschutz geweckt? Was machst du beruflich? Suchst du nach etwas bestimmten? (",
    },
    bio_user_profile_missing_message: {
      en: "This user hasn't added a bio yet.",
      de: "Diese(r) Benutzer*in hat noch keine Bio hinzugefügt.",
    },
    location_user_profile_missing_message: {
      en: "This user hasn't specified their location yet.",
      de: "Diese(r) Benutzer*in hat seinen Standort noch nicht angegeben.",
    },
    choose_what_permissions_the_user_should_have: {
      en: "Choose what permissions the user should have.",
      de: "Wähle aus, welche Berechtigungen der/die Benutzer*in haben soll",
    },
    role_in_project: {
      en: "Role in project",
      de: "Rolle im Projekt",
    },
    role_in_organization: {
      en: "Role in organisation",
      de: "Rolle in der Organisation",
    },
    role_in_idea: {
      en: "Role in idea",
      de: "Rolle bei der Idee",
    },
    role_in_event: {
      en: "Role in event",
      de: "Rolle beim Event",
    },
    pick_or_describe_role_in_organization: {
      en: "Pick or describe what the user's role in the organisation is.",
      de: "Wähle oder beschreibe, welche Rolle der/die Benutzer*in in der Organisation hat.",
    },
    pick_or_describe_role_in_project: {
      en: "Pick or describe what the user's role in the project is.",
      de: "Wähle oder beschreibe, welche Rolle der/die Benutzer*in im Projekt hat.",
    },
    pick_or_describe_role_in_idea: {
      en: "Pick or describe what the user's role in the idea is.",
      de: "Wähle oder beschreibe, welche Rolle der/die Benutzer*in bei der Idee hat.",
    },
    pick_or_describe_role_in_event: {
      en: "Pick or describe what the user's role in the event is.",
      de: "Wähle oder beschreibe, welche Rolle der/die Benutzer*in beim Event hat.",
    },
    pick_or_type_users_role: {
      en: "Pick or type user's role",
      de: "Rolle beschreiben",
    },
    hours_contributed_per_week: {
      en: "Hours contributed per week",
      de: "Beigetragene Wochenstunden",
    },
    pick_how_many_hours_user_contributes_to_org: {
      en: "Pick how many hours per week the user contributes to this organisation on average.",
      de:
        "Wähle aus, wie viele Stunden pro Woche der/die Benutzer*in im Durchschnitt zu dieser Organisation beiträgt.",
    },
    pick_how_many_hours_user_contributes_to_project: {
      en: "Pick how many hours per week the user contributes to this project on average.",
      de:
        "Wähle aus, wie viele Stunden pro Woche der/die Benutzer*in im Durchschnitt zu diesem Projekt beiträgt.",
    },
    do_you_really_want_to_lose_creators_permissions: {
      en: "Do you really want to lose Super Admin permissions?",
      de: "Willst du wirklich deine Super-Admin-Rechte verlieren?",
    },
    there_is_always_one_org_member_with_creator_privileges: {
      en: "There is always exactly one organisation member with Super Admin privileges.",
      de: "Es gibt immer genau ein Organisationsmitglied mit Super-Admin-Rechten.",
    },
    there_is_always_one_project_member_with_creator_privileges: {
      en: "There is always exactly one project member with Super Admin privileges.",
      de: "Es gibt immer genau ein Projektmitglied mit Super-Admin-Rechten.",
    },
    creator_can_add_remove_and_edit_admins: {
      en: "The Super Admin can add, remove and edit Administrators.",
      de: "Der Super Admin kann Admins hinzufügen, entfernen und bearbeiten.",
    },
    if_you_make_person_admin_you_will_lose_privileges: {
      en: `If you make ${profile?.name} the Super Admin you will lose your Super Admin permissions.`,
      de: `Wenn du ${profile?.name} zum/zur Super Admin machst, verlierst du deine Super-Admin-Rechte`,
    },
    do_you_really_want_to_do_this: {
      en: "Do you really want to do this?",
      de: "Willst du das wirklich tun?",
    },
    is_a_suborganization_of: {
      en: "is a suborganisation of",
      de: "ist eine Unterorganisation von",
    },
    suborganization_of: {
      en: "Suborganisation of",
      de: "Unterorganisation von",
    },
    suborganizations_of: {
      en: "Suborganisations of",
      de: "Unterorganisationen von",
    },
    persons_profile: {
      en: `${profile?.name}'s Profile`,
      de: `${profile?.name}'s Profil`,
    },
    to_see_this_users_full_information: {
      en: "to see this user's full information",
      de: ", um die vollständigen Informationen dieses/dieser Benutzer*in zu sehen",
    },
    your_projects: {
      en: "Your climate projects, ideas and events",
      de: "Deine Projekte, Ideen und Events",
    },
    this_users_projects: {
      en: `${profile?.first_name}'s Climate Projects`,
      de: `Klimaschutzprojekte von ${profile?.first_name}`,
    },
    your_ideas: {
      en: "Your climate ideas",
      de: "Deine Klimaschutzideen",
    },
    this_users_ideas: {
      en: `Climate Ideas ${profile?.first_name} is involved in`,
      de: `Klimaschutz Ideen, bei denen ${profile?.first_name} mitmacht`,
    },
    /*context: You are...*/
    not_involved_in_any_projects_yet: {
      en: "not involved in any climate projects yet!",
      de: "noch nicht an Klima-Projekten beteiligt!",
    },
    not_involved_in_any_ideas_yet: {
      en: "not involved in any climate ideas yet!",
      de: "ist bisher bei keiner Klimaschutzidee dabei!",
    },
    your_organizations: {
      en: "Your organisations",
      de: "Deine Organisationen",
    },
    this_users_organizations: {
      en: `${profile?.first_name}'s Organisations`,
      de: `Organisationen von ${profile?.first_name}`,
    },
    /*context: You are...*/
    not_involved_in_any_organizations_yet: {
      en: "not involved in any organisations yet!",
      de: "noch in keiner Organisation engagiert!",
    },
    your_registered_events: {
      en: "Events you registered for",
      de: "Veranstaltungen für die du dich angemeldet hast",
    },
    no_registered_events_yet: {
      en: "You haven't registered for any upcoming events yet.",
      de: "Du hast dich bisher für keine bevorstehenden Veranstaltungen angemeldet.",
    },
    sign_up_message: {
      en: "You are now a ClimateHub Network member. On this page you can customize your profile.",
      de:
        "Du bist jetzt ein ClimateHub Netzwerk Mitglied. Auf dieser Seite kannst du dein Profil anpassen.",
    },
    account_created: {
      en: "Account created",
      de: "Konto erstellt",
    },
    congratulations: {
      en: "Congratulations!",
      de: "Glückwunsch!",
    },
    congratulations_you_have_created_your_account: {
      en: "Congratulations, you have created your account!",
      de: "Glückwunsch, du hast dein Konto erfolgreich erstellt!",
    },
    just_one_more_step_to_complete_your_signup: {
      en: "Congratulations! Just one more step to complete your signup!",
      de: "Glückwunsch! Nur noch ein Schritt, um deine Anmeldung abzuschließen!",
    },
    almost_done: {
      en: "Almost there!",
      de: "Fast geschafft!",
    },
    we_sent_you_an_email_with_a_link: {
      en: "We have sent you an E-Mail with a link!",
      de: "Wir haben dir eine E-Mail mit einem Link geschickt!",
    },
    please_click_on_the_link_to_activate_your_account: {
      en: "Please click on the link to activate your account.",
      de: "Bitte klicke auf den Link, um dein Konto zu aktivieren.",
    },
    make_sure_to_also_check_your_spam: {
      en: "Make sure to also check your spam/junk folder in case you can't find the link.",
      de: "Bitte überprüfe auch deinen Spam-/Junk-Ordner, falls du die E-Mail nicht finden kannst.",
    },
    if_you_are_experiencing_any_problems_contact_us: {
      en: "If you are experiencing any problems, email us at contact@climatehub.org",
      de: "Wenn du Probleme haben solltest, kontaktiere uns einfach unter contact@climatehub.org",
    },
    if_the_email_does_not_arrive_after_5_minutes: {
      en: (
        <>
          If the email does not arrive after 5 minutes,{" "}
          <Link
            href={appHref("/resend_verification_email", { hubUrl: hubName, locale })}
            underline="hover"
          >
            click here
          </Link>{" "}
          to resend it.
        </>
      ),
      de: (
        <>
          Wenn die E-Mail nach 5 Minuten noch nicht angekommen ist,{" "}
          <Link
            href={appHref("/resend_verification_email", { hubUrl: hubName, locale })}
            underline="hover"
          >
            klicke hier
          </Link>
          , um sie erneut versenden zu lassen.
        </>
      ),
    },
    you_have_successfully_updated_your_profile: {
      en: "You have successfully updated your profile!",
      de: "Du hast dein Profil erfolgreich aktualisiert!",
    },
    new_to_climate_connect: {
      en: "New to the ClimateHub Network?",
      de: "Neu beim ClimateHub Netzwerk?",
    },
    click_here_to_create_an_account: {
      en: "Click here to create an account",
      de: "Klicke hier, um ein Konto zu erstellen",
    },
    forgot_your_password: {
      en: "Forgot your password?",
      de: "Passwort vergessen?",
    },
    not_verified_error_message: {
      en: (
        <>
          You have not activated you account yet. Click the link in the email we sent you or{" "}
          <Link
            href={appHref("/resend_verification_email", { locale })}
            target="_blank"
            underline="hover"
          >
            click here
          </Link>{" "}
          to send the verification link again.
        </>
      ),
      de: (
        <>
          Du hast dein Konto noch nicht aktiviert. Klicke auf den Link in der E-Mail, die wir dir
          geschickt haben, oder{" "}
          <Link
            href={appHref("/resend_verification_email", { locale })}
            target="_blank"
            underline="hover"
          >
            klicke hier
          </Link>{" "}
          , um die Bestätigungsemail mit dem Verifizierungslink erneut zu erhalten.
        </>
      ),
    },
    passwords_dont_match: {
      en: "Passwords don't match.",
      de: "Die Passwörter stimmen nicht überein.",
    },
    first_name: {
      en: "First Name",
      de: "Vorname",
    },
    last_name: {
      en: "Last Name",
      de: "Nachname",
    },
    i_would_like_to_receive_emails_about_updates_news_and_interesting_projects: {
      en: "I would like to receive emails about updates, news and interesting projects",
      de: "Ich möchte E-Mails über Updates, Neuigkeiten und interessante Projekte erhalten",
    },
    agree_to_tos_and_privacy_policy: {
      en: (
        <>
          I agree to the{" "}
          <Link href={appHref("/terms", { locale })} target="_blank" rel="noreferrer">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href={appHref("/privacy", { locale })} target="_blank" rel="noreferrer">
            Privacy policy
          </Link>
          .
        </>
      ),
      de: (
        <>
          Ich erkläre mich mit den{" "}
          <Link href={appHref("/terms", { locale })} target="_blank" rel="noreferrer">
            Nutzungsbedingungen
          </Link>{" "}
          und den{" "}
          <Link href={appHref("/privacy", { locale })} target="_blank" rel="noreferrer">
            Datenschutzbestimmungen
          </Link>{" "}
          einverstanden.
        </>
      ),
    },
    signup_step_2_headline: {
      en:
        "Select the climate action areas you're interested in. This helps us connect you with relevant projects and people. You can skip this step and add interests later.",
      de:
        "Wähle die Klimaschutz-Bereiche aus, die dich interessieren. Das hilft uns, dich mit relevanten Projekten und Personen zu verbinden. Du kannst diesen Schritt überspringen und später Interessen hinzufügen.",
    },
    signup_step_3_headline: {
      en:
        "Let the climate community know what you are already doing or which fields interest you the most. By doing this you can contribute to Projects more easily. Choose up to 3 fields.",
      de:
        "Lass die Klima-Community wissen, was du schon machst oder welche Themen dich am meisten interessieren. So kannst du einfacher zu Projekten beitragen. Wähle bis zu 3 Bereiche aus.",
    },
    repeat_password: {
      en: "Repeat Password",
      de: "Passwort wiederholen",
    },
    profile: {
      en: "Profile",
      de: "Profil",
    },
    translate_profile_intro: {
      en: "",
      de: (
        <>
          Da der Klimawandel eine globale Krise ist, ist es uns wichtig, dass alle Profile auch auf
          Englisch verfügbar sind.
          <br />
          Wenn du auf {"Automatisch Übersetzen"} klickst, kannst du den Text immer noch bearbeiten.
          Natürlich kannst du auch alles selbst übersetzen. Wenn du auf {"Veröffentlichen"} klickst,
          werden alle leeren Felder automatisch übersetzt.
        </>
      ),
    },
    user_name_is: {
      en: `${profile?.first_name} is`,
      de: `${profile?.first_name} ist`,
    },
    your_area_of_interest: {
      en: "Your areas of interest",
      de: "Deine Interessensgebiete",
    },
    welcome_to_climate_connect: {
      en: "Welcome!",
      de: "Willkommen!",
    },
    welcome_to_climate_connect_subtitle: {
      en: "Register or log in with your existing account:",
      de: "Anmelden oder mit bestehendem Account einloggen:",
    },
    area_of_interest: {
      en: "Areas of interest",
      de: "Interessensgebiete",
    },
    enter_your_code: {
      en: "Enter your code",
      de: "Code eingeben",
    },
    enter_password: {
      en: "We found your account. Please enter your password to login and continue.",
      de:
        "Wir haben deinen Account gefunden. Gib bitte dein Passwort ein, um dich einzuloggen und fortzufahren.",
    },
    we_sent_a_code_to: {
      en: "We found your account and sent a 6-digit code to {email}.",
      de: "Wir haben deinen Account gefunden und an {email} einen 6-stelligen Code gesendet.",
    },
    we_sent_a_code_to_new_user: {
      en:
        "We created your account and sent a 6-digit code to {email} to verify your email address.",
      de:
        "Wir haben deinen Account erstellt und einen 6-stelligen Code an {email} gesendet, um deine E-Mail-Adresse zu bestätigen.",
    },
    verify: {
      en: "Verify",
      de: "Bestätigen",
    },
    resend_code: {
      en: "Resend code",
      de: "Code erneut senden",
    },
    back: {
      en: "Back",
      de: "Zurück",
    },
    this_code_has_expired_please_request_a_new_one: {
      en: "This code has expired. Please request a new one.",
      de: "Dieser Code ist abgelaufen. Bitte fordere einen neuen an.",
    },
    too_many_attempts_please_request_a_new_code: {
      en: "Too many attempts. Please request a new code.",
      de: "Zu viele Versuche. Bitte fordere einen neuen Code an.",
    },
    incorrect_code_please_try_again: {
      en: "Incorrect code. Please try again.",
      de: "Falscher Code. Bitte versuche es erneut.",
    },
    please_wait_before_requesting_a_new_code: {
      en: "Please wait before requesting a new code.",
      de: "Bitte warte, bevor du einen neuen Code anforderst.",
    },
    connection_error_please_try_again: {
      en: "Connection error. Please try again.",
      de: "Verbindungsfehler. Bitte versuche es erneut.",
    },
    // --- Auth unification (US-7, US-8 etc.) ---
    reset_password: {
      en: "Reset password",
      de: "Passwort zurücksetzen",
    },
    sending_reset_link: {
      en: "Sending a reset link to {email}…",
      de: "Sende einen Link zum Zurücksetzen an {email}…",
    },
    check_your_inbox: {
      en: "Check your inbox",
      de: "Überprüfe deinen Posteingang",
    },
    reset_link_sent_to: {
      en:
        "We've sent a password reset link to {email}. Follow the link in the email to set a new password.",
      de:
        "Wir haben einen Link zum Zurücksetzen des Passworts an {email} gesendet. Folge dem Link in der E-Mail, um ein neues Passwort festzulegen.",
    },
    use_a_code_instead: {
      en: "Use a code instead",
      de: "Stattdessen mit Code einloggen",
    },
    server_error: {
      en: "Something went wrong. Please try again.",
      de: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    },
    please_enter_your_password: {
      en: "Please enter your password.",
      de: "Bitte gib dein Passwort ein.",
    },
    too_many_attempts: {
      en: "Too many attempts. Please try again later.",
      de: "Zu viele Versuche. Bitte versuche es später erneut.",
    },
    code_delivery_note: {
      en:
        "Haven't received an email yet? It may take a few minutes—especially when logging in for the first time. In the meantime, feel free to check your spam folder. You'll be able to resend it shortly.",
      de:
        "Noch keine E-Mail angekommen? Das kann – besonders beim ersten Login – ein paar Minuten dauern. Schau in der Zwischenzeit gern im Spam-Ordner nach. Ein erneuter Versand ist in Kürze möglich.",
    },
    // --- Signup Flow ---
    create_your_account: {
      en: "Create your account",
      de: "Erstelle deinen Account",
    },
    signup_step_1_headline: {
      en:
        "You don't have an account yet. Please enter tell us your name and where you live to get started. You will have an opportunity to create/add an organisation once signed up.",
      de:
        "Du hast noch keinen persönlichen Account. Verrate uns bitte, wie du heißt und wo do wohnst, um loszulegen. Du hast die Möglichkeit, eine Organisation zu erstellen/hinzuzufügen, sobald du dich angemeldet hast.",
    },
    event_signup_step_1_headline: {
      en:
        "You don't have an account yet. Please enter tell us your name and where you live to register for this event.",
      de:
        "Du hast noch keinen persönlichen Account. Verrate uns bitte wie du heißt und in welcher Stadt du wohnst, um dich zur Veranstaltung anzumelden.",
    },
    email_cannot_be_changed: {
      en: "This is the email you'll use to log in",
      de: "Dies ist die E-Mail-Adresse, mit der du dich einloggst",
    },
    first_name_is_required: {
      en: "First name is required",
      de: "Vorname ist erforderlich",
    },
    last_name_is_required: {
      en: "Last name is required",
      de: "Nachname ist erforderlich",
    },
    agree_to_tos_and_privacy_policy_with_email_consent: {
      en: (
        <>
          I agree to the{" "}
          <Link href={appHref("/terms", { locale })} target="_blank" rel="noreferrer">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href={appHref("/privacy", { locale })} target="_blank" rel="noreferrer">
            Privacy policy
          </Link>
          . I consent to the processing of my personal data and to receiving emails containing
          necessary information and updates on local climate projects.
        </>
      ),
      de: (
        <>
          Ich stimme den{" "}
          <Link href={appHref("/terms", { locale })} target="_blank" rel="noreferrer">
            Nutzungsbedingungen
          </Link>{" "}
          und der{" "}
          <Link href={appHref("/privacy", { locale })} target="_blank" rel="noreferrer">
            Datenschutzerklärung
          </Link>{" "}
          zu. Ich willige ein, dass meine personenbezogenen Daten verarbeitet werden und ich per
          E-mail über funktionell notwendige Informationen und lokale Klimaprojekte informiert
          werde.
        </>
      ),
    },
    you_must_accept_terms_and_privacy_policy: {
      en: "You must accept the terms of service and privacy policy",
      de: "Du musst die Nutzungsbedingungen und Datenschutzrichtlinien akzeptieren",
    },
    continue: {
      en: "Continue",
      de: "Weiter",
    },
    no_location: {
      en: "No location",
      de: "Kein Standort",
    },
    name: {
      en: "Name",
      de: "Name",
    },
    select_your_interest_areas: {
      en: "Select your interest areas (optional)",
      de: "Wähle deine Interessensbereiche (optional)",
    },
    creating_account: {
      en: "Creating account...",
      de: "Konto wird erstellt...",
    },
    create_account: {
      en: "Create account",
      de: "Konto erstellen",
    },
  };
}

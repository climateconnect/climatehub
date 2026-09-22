import { Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { useRouter } from "next/router";
import React, { useContext, useEffect, useState } from "react";
import ROLE_TYPES from "../../../public/data/role_types";
import { apiRequest } from "../../../public/lib/apiOperations";
import getTexts from "../../../public/texts/texts";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import UserContext from "../context/UserContext";
import GenericDialog from "../dialogs/GenericDialog";
import TranslateTexts from "../general/TranslateTexts";
import StepsTracker from "./../general/StepsTracker";
import AddTeam from "./AddTeam";
import EnterDetails from "./EnterDetails";
import ProjectSubmittedPage from "./ProjectSubmittedPage";
import ShareProject from "./ShareProject";
import { Project, Role, Organization, Sector } from "../../types";
import { parseLocation } from "../../../public/lib/locationOperations";
import SelectSectors from "./SelectSectors";
import EventRegistrationStep from "./EventRegistrationStep";
import dayjs from "dayjs";

/**
 * Flatten a DRF validation error response into a human-readable string.
 *
 * DRF errors can be:
 *  - {"message": "…"}                        → top-level message
 *  - {"field_name": ["error 1", "error 2"]}  → per-field errors
 *  - {"fields": [{"options": ["…"]}]}        → nested list errors
 *  - Deeply nested dicts / arrays             → recursive extraction
 */
function flattenDrfErrors(data: unknown, prefix = ""): string[] {
  if (!data) return [];
  if (typeof data === "string") return [prefix ? `${prefix}: ${data}` : data];
  if (Array.isArray(data)) {
    return data.flatMap((item) => flattenDrfErrors(item, prefix));
  }
  if (typeof data === "object") {
    return Object.entries(data as Record<string, unknown>).flatMap(([key, value]) => {
      // Top-level "message" key — use as-is.
      if (key === "message" && typeof value === "string") return [value];
      const label = prefix ? `${prefix} → ${key}` : key;
      return flattenDrfErrors(value, label);
    });
  }
  return [String(data)];
}

/**
 * Extract the best error message from an Axios error for display to the user.
 */
function extractErrorMessage(error: unknown): string | null {
  const axiosError = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
  };
  if (!axiosError.response?.data) return null;
  const messages = flattenDrfErrors(axiosError.response.data);
  if (messages.length === 0) return null;
  const status = axiosError.response.status;
  return status ? `Error ${status}: ${messages.join("; ")}` : messages.join("; ");
}

const useStyles = makeStyles((theme) => {
  return {
    stepsTracker: {
      maxWidth: 600,
      margin: "0 auto",
    },
    headline: {
      textAlign: "center",
      marginTop: theme.spacing(4),
      color: theme.palette.background.default_contrastText,
    },
  };
});

const getSteps = (texts, project, projectTypeTexts, showRegistrationStep: boolean = false) => {
  const steps: Array<{ key: string; text: any; headline?: any }> = [
    {
      key: "share",
      text: texts.basic_info,
      headline: texts.share_your_climate_project,
    },
    {
      key: "selectSector",
      text: texts.project_category,
      headline: projectTypeTexts.selectSector[project?.project_type?.type_id],
    },
  ];

  if (showRegistrationStep) {
    steps.push({
      key: "registration",
      text: texts.registration,
      headline: texts.registration,
    });
  }

  steps.push(
    {
      key: "enterDetails",
      text: texts.project_details,
      headline: undefined,
    },
    {
      key: "addTeam",
      text: texts.add_team,
      headline: texts.add_your_team,
    }
  );

  /*if (sourceLocale === "de") {
    steps.push({
      key: "translate",
      text: texts.languages,
      headline: texts.translate,
      sourceLocale: ["de"],
    })
  }*/
  return steps;
};

type availabilityOptionsProps = {
  id: number;
  key: string;
  name: string;
};

type ShareProjectRootProps = {
  availabilityOptions: availabilityOptionsProps[];
  userOrganizations: Organization[];
  rolesOptions: Role[];
  user: any;
  token: string;
  // eslint-disable-next-line no-unused-vars
  setMessage: (message: string) => void;
  projectTypeOptions: any[];
  hubName?: string;
  sectorOptions: Sector[];
};

export default function ShareProjectRoot({
  availabilityOptions,
  userOrganizations,
  rolesOptions,
  user,
  token,
  setMessage,
  projectTypeOptions,
  hubName,
  sectorOptions,
}: ShareProjectRootProps) {
  const classes = useStyles();
  const { locale, locales } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  const projectTypeTexts = getProjectTypeTexts(texts);

  const [project, setProject] = useState(
    getDefaultProjectValues(
      {
        ...user,
        role: rolesOptions.find((r) => r.role_type === ROLE_TYPES.all_type),
        role_in_project: "",
      },
      projectTypeOptions,
      userOrganizations,
      locale,
      hubName
    )
  );

  // Dynamic steps: include registration step only for events
  const isEvent = project.project_type?.type_id === "event";
  const showRegistrationStep = isEvent;
  const steps = getSteps(texts, project, projectTypeTexts, showRegistrationStep);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingSubmitDraft, setLoadingSubmitDraft] = useState(false);

  const getStep = (stepNumber) => {
    if (stepNumber >= steps.length) return steps[steps.length - 1];
    return steps[stepNumber];
  };

  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const targetLanguage = locales.find((l) => l !== locale);
  const [translations, setTranslations] = useState({});
  const [curStep, setCurStep] = useState(getStep(0));
  const [finished, setFinished] = useState(false);

  // TODO: Allow changing sourceLanguage, targetLanguage
  const router = useRouter();
  useEffect(() => {
    if (window) {
      const location = window.location.href;
      router.beforePopState(({ as }) => {
        if (location.includes("/share") && as != "/share") {
          const result = window.confirm(
            texts.are_you_sure_you_want_to_leave_you_will_lose_your_project
          );
          if (!result) {
            return false;
          }
        }
        return true;
      });
    }
  });

  const handleChangeTranslationContent = (locale, newTranslations, isManualChange) => {
    const newTranslationsObject = {
      ...translations,
      [locale]: {
        ...translations[locale],
        ...newTranslations,
        is_manual_translation: isManualChange ? true : false,
      },
    };
    setTranslations({ ...newTranslationsObject });
  };

  const goToNextStep = () => {
    const curStepIndex = steps.findIndex((s) => s.key === curStep.key);
    if (curStepIndex === -1) {
      // Current step no longer in steps (e.g. project type changed) — go to first step
      setCurStep(getStep(0));
      setMessage("");
      window.scrollTo(0, 0);
      return;
    }
    setCurStep(getStep(curStepIndex + 1));
    setMessage("");
    //scroll to top when navigating to another step
    window.scrollTo(0, 0);
  };

  const goToPreviousStep = () => {
    const curStepIndex = steps.findIndex((s) => s.key === curStep.key);
    if (curStepIndex === -1) {
      setCurStep(getStep(0));
      setMessage("");
      window.scrollTo(0, 0);
      return;
    }
    setCurStep(getStep(curStepIndex - 1));
    setMessage("");
    //scroll to top when navigating to another step
    window.scrollTo(0, 0);
  };

  // TODO: save as draft and submit project share a lot of logic. I could be refactored
  const submitProject = async (event) => {
    event.preventDefault();
    setLoadingSubmit(true);
    setErrorMessage("");

    try {
      const payload = await formatProjectForRequest(project, translations);
      payload.sectors = project.sectors?.map((sector) => sector.key);

      const resp = await apiRequest({
        method: "post",
        url: "/api/create_project/",
        payload: payload,
        token: token,
        locale: locale,
      });
      setProject({ ...project, error: false, url_slug: resp.data.url_slug });
      setLoadingSubmit(false);
      setFinished(true);
    } catch (error: any) {
      console.log(error?.response?.data);
      const detailedMessage = extractErrorMessage(error);
      if (detailedMessage) {
        setErrorMessage(detailedMessage);
      }
      setErrorDialogOpen(true);
      setProject({ ...project, error: true });
      setLoadingSubmit(false);
    }
  };
  const saveAsDraft = async (event) => {
    event.preventDefault();
    setLoadingSubmitDraft(true);
    setErrorMessage("");

    try {
      const payload = await formatProjectForRequest({ ...project, is_draft: true }, translations);
      payload.sectors = project.sectors?.map((sector) => sector.key);
      const response = await apiRequest({
        method: "post",
        url: "/api/create_project/",
        payload: payload,
        token: token,
        locale: locale,
      });

      setProject({ ...project, url_slug: response.data.url_slug, is_draft: true });
      setLoadingSubmitDraft(false);
      setFinished(true);
    } catch (error: any) {
      console.log(error);
      const detailedMessage = extractErrorMessage(error);
      if (detailedMessage) {
        setErrorMessage(detailedMessage);
      }
      setErrorDialogOpen(true);
      setProject({ ...project, error: true });
      setLoadingSubmitDraft(false);
    }
  };

  const handleSetProject = (newProjectData) => {
    setProject({ ...project, ...newProjectData });
  };

  const handleCloseErrorDialog = () => {
    setErrorMessage("");
    setErrorDialogOpen(false);
  };

  const textsToTranslate = [
    {
      textKey: "name",
      rows: 1,
      headlineTextKey: "project_name",
    },
    {
      textKey: "short_description",
      rows: 5,
      headlineTextKey: "short_description",
      maxCharacters: 280,
      showCharacterCounter: true,
    },
    {
      textKey: "description",
      rows: 15,
      headlineTextKey: "description",
    },
  ];

  const onSelectNewSector = (event) => {
    event.preventDefault();
    const sector = sectorOptions.find((sector) => sector.name === event.target.value);
    if (
      sector &&
      project?.sectors &&
      project.sectors.filter((h) => h.name === sector.name)?.length === 0
    ) {
      setProject({
        ...project,
        sectors: [...project.sectors, sector],
      });
    }
  };

  const onClickRemoveSector = (sector) => {
    const sectorsAfterRemoval = project?.sectors?.filter((h) => h.name !== sector.name);
    setProject({
      ...project,
      sectors: sectorsAfterRemoval,
    });
  };

  return (
    <>
      {!finished ? (
        <>
          <StepsTracker
            grayBackground={true}
            /*TODO(undefined) className={classes.stepsTracker} */
            steps={steps}
            activeStep={curStep.key}
          />
          <Typography variant="h4" className={classes.headline}>
            {curStep.headline && curStep.headline}
          </Typography>
          {/* paddingBottom reserves space above the sticky navigation bar */}
          <div style={{ paddingBottom: 80 }}>
            {curStep.key === "share" && (
              <ShareProject
                project={project}
                handleSetProjectData={handleSetProject}
                userOrganizations={userOrganizations}
                projectTypeOptions={projectTypeOptions}
                goToNextStep={goToNextStep}
                hubName={hubName}
              />
            )}
            {curStep.key === "selectSector" && (
              <SelectSectors
                project={project}
                goToNextStep={goToNextStep}
                goToPreviousStep={goToPreviousStep}
                sectorsToSelectFrom={sectorOptions.filter(
                  (sector) =>
                    project?.sectors?.filter((addedSector) => addedSector.name === sector.name)
                      .length === 0
                )}
                onSelectNewSector={onSelectNewSector}
                onClickRemoveSector={onClickRemoveSector}
              />
            )}
            {curStep.key === "registration" && showRegistrationStep && (
              <EventRegistrationStep
                projectData={project}
                handleSetProjectData={handleSetProject}
                goToNextStep={goToNextStep}
                goToPreviousStep={goToPreviousStep}
              />
            )}
            {curStep.key === "enterDetails" && (
              <EnterDetails
                projectData={project}
                handleSetProjectData={handleSetProject}
                goToNextStep={goToNextStep}
                goToPreviousStep={goToPreviousStep}
                setMessage={setMessage}
                saveAsDraft={saveAsDraft}
                loadingSubmit={loadingSubmit}
                loadingSubmitDraft={loadingSubmitDraft}
              />
            )}
            {curStep.key === "addTeam" && (
              <AddTeam
                projectData={project}
                handleSetProjectData={handleSetProject}
                goToPreviousStep={goToPreviousStep}
                goToNextStep={goToNextStep}
                availabilityOptions={availabilityOptions}
                rolesOptions={rolesOptions}
                onSubmit={submitProject}
                saveAsDraft={saveAsDraft}
                isLastStep={steps[steps.length - 1].key === "addTeam"}
                loadingSubmit={loadingSubmit}
                loadingSubmitDraft={loadingSubmitDraft}
              />
            )}
            {curStep.key === "translate" && (
              <TranslateTexts
                data={project}
                handleSetData={handleSetProject}
                onSubmit={submitProject}
                goToPreviousStep={goToPreviousStep}
                handleChangeTranslationContent={handleChangeTranslationContent}
                translations={translations}
                targetLanguage={targetLanguage}
                pageName="project"
                textsToTranslate={textsToTranslate}
                arrayTranslationKeys={[]}
                introTextKey="translate_project_intro"
                submitButtonText={texts.submit}
                saveAsDraft={saveAsDraft}
                loadingSubmit={loadingSubmit}
                loadingSubmitDraft={loadingSubmitDraft}
              />
            )}
          </div>
          {/* end sticky nav spacer */}
        </>
      ) : (
        <>
          <ProjectSubmittedPage
            user={user}
            isDraft={project.is_draft}
            url_slug={project.url_slug}
            hubName={hubName}
            hasError={project.error}
            projectTypeId={project.project_type?.type_id}
            projectName={project.name}
          />
        </>
      )}
      {project.error && (
        <GenericDialog
          open={errorDialogOpen}
          onClose={handleCloseErrorDialog}
          title={texts.internal_server_error}
        >
          <Typography>
            {errorMessage ? errorMessage : texts.error_when_publishing_project}
          </Typography>
        </GenericDialog>
      )}
    </>
  );
}

//TODO: remove some of these default values as they are just for testing
const getDefaultProjectValues = (
  loggedInUser,
  projectTypeOptions,
  userOrganizations,
  locale,
  hubName
): Project => {
  return {
    name: "",
    short_description: "",
    description: "",
    collaborators_welcome: true,
    collaborating_organizations: [],
    loc: {},
    parent_organization: userOrganizations ? userOrganizations[0] : null,
    isPersonalProject: !(userOrganizations && userOrganizations.length > 0),
    is_organization_project: userOrganizations && userOrganizations.length > 0,
    //TODO: Should contain the logged in user as the creator and parent_user by default
    team_members: [{ ...loggedInUser }],
    website: "",
    language: locale,
    project_type: projectTypeOptions.find((t) => t.type_id === "project"),
    hubName: hubName,
    sectors: [],
    is_online: false,
    // Event registration defaults
    registrationEnabled: false,
    max_participants: null,
    registration_end_date: null,
  };
};

const formatProjectForRequest = async (project, translations) => {
  const { blobFromObjectUrl } = await import("../../../public/lib/imageOperations");
  // Destructure UI-only registration fields to exclude from the spread
  const {
    registrationEnabled,
    max_participants,
    registration_end_date,
    registration_fields,
    ...projectRest
  } = project;
  const hasLocation = project.loc && Object.keys(project.loc).length > 0;
  return {
    ...projectRest,
    loc: hasLocation ? parseLocation(project.loc, true) : undefined,
    team_members: project.team_members.map((m) => ({
      url_slug: m.url_slug,
      role: m.role.id,
      availability: m.availability?.id,
      id: m.id,
      role_in_project: m.role_in_project,
    })),
    parent_organization: project?.parent_organization?.id,
    collaborating_organizations: project.collaborating_organizations.map((o) => o.id),
    image: project.image ? await blobFromObjectUrl(project.image) : undefined,
    thumbnail_image: project.thumbnail_image
      ? await blobFromObjectUrl(project.thumbnail_image)
      : undefined,
    source_language: project.language,
    translations: translations ? translations : {},
    // Include registration_config only when toggle is on and both fields are present
    registration_config:
      registrationEnabled && project.project_type?.type_id === "event"
        ? {
            max_participants: max_participants ? Number(max_participants) : undefined,
            registration_end_date: registration_end_date
              ? dayjs(registration_end_date).toISOString()
              : undefined,
            // Strip client-only _clientKey and empty unfilled option rows before sending to the API
            fields: registration_fields?.map(({ _clientKey, ...field }) => ({
              ...field,
              options: field.options?.filter((opt) => {
                if (field.field_type === "time_slot_select") {
                  return !!(opt.start_time || opt.end_time);
                }
                return opt.title.trim() !== "";
              }),
            })),
          }
        : undefined,
  };
};

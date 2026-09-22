import { Button, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { useRouter } from "next/router";
import React, { useContext, useState, useEffect, useRef } from "react";
import Cookies from "universal-cookie";
import DeleteIcon from "@mui/icons-material/Delete";
import { apiRequest } from "../../../public/lib/apiOperations";
import { appHref } from "../../../public/lib/appLink";
import { arraysEqual } from "../../../public/lib/generalOperations";
import { blobFromObjectUrl } from "../../../public/lib/imageOperations";
import { indicateWrongLocation, isLocationValid } from "../../../public/lib/locationOperations";
import {
  getTranslationsFromObject,
  getTranslationsWithoutRedundantKeys,
} from "../../../public/lib/translationOperations";
import getTexts from "../../../public/texts/texts";
import EditAccountPage from "../account/EditAccountPage";
import UserContext from "../context/UserContext";
import PageNotFound from "../general/PageNotFound";
import TranslateTexts from "../general/TranslateTexts";
import DeleteOrganizationDialog from "./DeleteOrganizationDialog";

import Alert from "@mui/material/Alert";

import { parseOrganization } from "../../../public/lib/organizationOperations";
import FeedbackContext from "../context/FeedbackContext";
import ROLE_TYPES from "../../../public/data/role_types";

const useStyles = makeStyles((theme) => ({
  headline: {
    textAlign: "center",
    marginTop: theme.spacing(4),
  },
  alert: {
    textAlign: "center",
    maxWidth: 1280,
    margin: "0 auto",
  },
  deleteButtonContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: theme.spacing(2),
  },
  deleteButton: {
    minWidth: theme.spacing(28),
  },
}));

export default function EditOrganizationRoot({
  allSectors,
  errorMessage,
  existingName,
  existingUrlSlug,
  handleSetErrorMessage,
  handleSetExistingName,
  handleSetExistingUrlSlug,
  handleSetLocationOptionsOpen,
  infoMetadata,
  initialTranslations,
  locationInputRef,
  organization,
  tagOptions,
  hubUrl,
  user_role,
}) {
  const classes = useStyles();
  const cookies = new Cookies();
  const token = cookies.get("auth_token");
  const { locale, locales, user } = useContext(UserContext);
  const router = useRouter();
  const STEPS = ["edit_organization", "edit_translations"];
  const [editedOrganization, setEditedOrganization] = useState({ ...organization });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const texts = getTexts({
    page: "organization",
    locale: locale,
    organization: editedOrganization,
  });
  const [step, setStep] = useState(STEPS[0]);
  const [translations, setTranslations] = useState(
    initialTranslations ? getTranslationsFromObject(initialTranslations, "organization") : {}
  );
  const [sourceLanguage] = useState(organization.language);
  const [targetLanguage] = useState(locales.find((l) => l !== sourceLanguage));
  const visibleProjectsCount = organization?.projects_count ?? 0;
  const hasVisibleProjects = visibleProjectsCount > 0;

  const handleSetEditedOrganization = (newOrganizationData) => {
    setEditedOrganization({ ...editedOrganization, ...newOrganizationData });
  };

  const handleChangeTranslations = (locale, newTranslations, isManualChange) => {
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

  const getChanges = (o, oldO) => {
    const finalProfile = {};
    const org = { ...o, ...o.info };
    delete org.info;
    const oldOrg = { ...oldO, ...oldO.info };
    delete oldOrg.info;
    Object.keys(org).map((k) => {
      if (oldOrg[k] && org[k] && Array.isArray(oldOrg[k]) && Array.isArray(org[k])) {
        if (!arraysEqual(oldOrg[k], org[k])) finalProfile[k] = org[k];
      } else if (oldOrg[k] !== org[k] && !(!oldOrg[k] && !org[k])) finalProfile[k] = org[k];
    });
    return finalProfile;
  };

  const saveChanges = async (editedOrg, isTranslationsStep) => {
    const error = verifyChanges(editedOrg, texts).error;
    //verify location is valid and notify user if it's not
    if (
      editedOrg?.info?.location !== organization?.info?.location &&
      !isLocationValid(editedOrg?.info?.location) &&
      !isTranslationsStep
    )
      indicateWrongLocation(
        locationInputRef,
        handleSetLocationOptionsOpen,
        handleSetErrorMessage,
        texts
      );
    if (error) {
      handleSetErrorMessage(error);
    } else {
      editedOrg.language = sourceLanguage;
      const oldOrg = await getOrganizationByUrlIfExists(organization.url_slug, token, locale);
      const payload = await parseForRequest(getChanges(editedOrg, oldOrg));
      if (isTranslationsStep)
        payload.translations = getTranslationsWithoutRedundantKeys(
          getTranslationsFromObject(initialTranslations, "organization"),
          translations
        );
      apiRequest({
        method: "patch",
        url: "/api/organizations/" + encodeURI(organization.url_slug) + "/",
        payload: payload,
        token: token,
        locale: locale,
      })
        .then(function () {
          router.push({
            pathname: "/organizations/" + organization.url_slug,
            query: {
              message: texts.successfully_edited_organization,
              hub: hubUrl,
            },
          });
        })
        .catch(function (error) {
          console.log(error);
          if (error) console.log(error.response);
          if (error?.response?.data?.message) handleSetErrorMessage(error?.response?.data?.message);
          if (error?.response?.data?.url_slug)
            handleSetExistingUrlSlug(error?.response?.data?.url_slug);
          if (error?.response?.data?.existing_name)
            handleSetExistingName(error?.response.data?.existing_name);
        });
    }
  };
  const handleCancel = () => {
    router.push("/organizations/" + organization.url_slug);
  };

  const deleteOrganization = () => {
    apiRequest({
      method: "delete",
      url: "/api/organizations/" + encodeURI(organization.url_slug) + "/",
      token: token,
      locale: locale,
    })
      .then(function () {
        const profileUrlSlug = user?.url_slug || organization?.creator?.url_slug;
        const query = new URLSearchParams({
          message: texts.you_have_successfully_deleted_your_organization,
          ...(hubUrl ? { hub: hubUrl } : {}),
        });
        router.push(`/profiles/${profileUrlSlug}?${query.toString()}`);
      })
      .catch(function (error) {
        console.log(error);
        if (error) console.log(error.response);
        showFeedbackMessage({
          message: error?.response?.data?.message || texts.server_error,
          isError: true,
        });
      });
  };

  const handleDeleteDialogClose = (confirmed) => {
    if (confirmed && !hasVisibleProjects) {
      deleteOrganization();
    }
    setDeleteDialogOpen(false);
  };

  const handleGoToPreviousStep = () => {
    setStep(STEPS[STEPS.indexOf(step) - 1]);
  };

  const onClickCheckTranslations = async (editedAccount) => {
    setEditedOrganization(editedAccount);
    setStep(STEPS[1]);
  };

  const handleTranslationsSubmit = async (event) => {
    event.preventDefault();
    await saveChanges(editedOrganization, true);
  };

  const standardTextsToTranslate = [
    {
      textKey: "name",
      rows: 2,
      headlineTextKey: "organization_name",
    },
    {
      textKey: "info.short_description",
      rows: 5,
      headlineTextKey: "short_description",
      maxCharacters: 280,
      showCharacterCounter: true,
    },
    {
      textKey: "info.about",
      rows: 9,
      headlineTextKey: "about",
    },
  ];

  const getInvolvedText = [
    {
      textKey: "info.get_involved",
      rows: 5,
      headlineTextKey: "get_involved",
      maxCharacters: 250,
      showCharacterCounter: true,
    },
  ];
  const checkTranslationsButtonRef = useRef<HTMLButtonElement | null>(null);

  const hideGetInvolvedField =
    editedOrganization.types.map((type) => type.hide_get_involved).includes(true) ||
    editedOrganization.types.length === 0;

  const textsToTranslate = hideGetInvolvedField
    ? standardTextsToTranslate
    : standardTextsToTranslate.concat(getInvolvedText);

  const { showFeedbackMessage } = useContext(FeedbackContext);
  const canDeleteOrganization = !!user_role && user_role.role_type === ROLE_TYPES.all_type;

  useEffect(() => {
    if (organization.language && organization.language !== locale) {
      showFeedbackMessage({
        message: ` ${texts.editing_org_in_wrong_language}.`,
      });
      if (checkTranslationsButtonRef.current) {
        checkTranslationsButtonRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, []);

  return (
    <>
      {organization ? (
        step === "edit_organization" ? (
          <>
            <EditAccountPage
              account={organization}
              possibleAccountTypes={tagOptions}
              infoMetadata={infoMetadata}
              accountHref={appHref("/organizations/" + organization.url_slug, { hubUrl, locale })}
              maxAccountTypes={2}
              handleSubmit={saveChanges}
              handleCancel={handleCancel}
              errorMessage={errorMessage}
              existingName={existingName}
              existingUrlSlug={existingUrlSlug}
              onClickCheckTranslations={onClickCheckTranslations}
              allSectors={allSectors}
              type="organization"
              checkTranslationsRef={checkTranslationsButtonRef}
            />
            {canDeleteOrganization && (
              <div className={classes.deleteButtonContainer}>
                <Button
                  className={classes.deleteButton}
                  color="error"
                  variant="contained"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                  aria-label={texts.delete_organization}
                >
                  {texts.delete_organization}
                </Button>
              </div>
            )}
            <DeleteOrganizationDialog
              open={deleteDialogOpen}
              onClose={handleDeleteDialogClose}
              cancelText={texts.cancel}
              confirmText={texts.delete_organization}
              title={texts.do_you_really_want_to_delete_your_organization}
              text={
                hasVisibleProjects
                  ? texts.organization_has_projects_cannot_delete.replace(
                      "{count}",
                      String(visibleProjectsCount)
                    )
                  : texts.deleting_organization_is_irreversible
              }
              showConfirmButton={!hasVisibleProjects}
            />
          </>
        ) : (
          <>
            {errorMessage && (
              <Alert severity="error" className={classes.alert}>
                {errorMessage}
              </Alert>
            )}
            <Typography color="primary" className={classes.headline} component="h1" variant="h4">
              {texts.translate}
            </Typography>

            <TranslateTexts
              data={editedOrganization}
              handleSetData={handleSetEditedOrganization}
              onSubmit={handleTranslationsSubmit}
              goToPreviousStep={handleGoToPreviousStep}
              handleChangeTranslationContent={handleChangeTranslations}
              translations={translations}
              targetLanguage={targetLanguage}
              organization={organization}
              pageName="organization"
              introTextKey="translate_organization_intro"
              submitButtonText={texts.save}
              textsToTranslate={textsToTranslate}
            />
          </>
        )
      ) : (
        <PageNotFound itemName={texts.organization} />
      )}
    </>
  );
}

async function getOrganizationByUrlIfExists(organizationUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/organizations/" + organizationUrl + "/",
      token: token,
      locale: locale,
    });
    return parseOrganization(resp.data, true);
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

const parseForRequest = async (org) => {
  const parsedOrg = {
    ...org,
  };
  // Only include location if it's a structured object (selected from the location picker).
  // A plain string means the location was not re-selected and should not be sent to the backend.
  if (typeof parsedOrg.location === "string") {
    delete parsedOrg.location;
  }
  if (org.organization_size) parsedOrg.organization_size = org.organization_size;
  if (org.get_involved) parsedOrg.get_involved = org.get_involved;
  if (org.short_description) parsedOrg.short_description = org.short_description;
  if (org.parent_organization)
    parsedOrg.parent_organization = org.parent_organization ? org.parent_organization.id : null;
  if (org.background_image)
    parsedOrg.background_image = await blobFromObjectUrl(org.background_image);
  if (org.thumbnail_image) parsedOrg.thumbnail_image = await blobFromObjectUrl(org.thumbnail_image);
  if (org.image) parsedOrg.image = await blobFromObjectUrl(org.image);
  if (org.sectors) parsedOrg.sectors = org.sectors.map((h) => h.key);
  return parsedOrg;
};

const verifyChanges = (newOrg, texts) => {
  const requiredPropErrors = {
    image: texts.image_required_error,
    types: texts.type_required_errror,
    name: texts.name_required_error,
  };
  const requiredInfoPropErrors = {
    location: texts.location_required_error,
  };
  for (const prop of Object.keys(requiredPropErrors)) {
    if (!newOrg[prop] || (Array.isArray(newOrg[prop]) && newOrg[prop].length <= 0)) {
      return {
        error: requiredPropErrors[prop],
      };
    }
  }
  for (const prop of Object.keys(requiredInfoPropErrors)) {
    if (!newOrg.info[prop] || (Array.isArray(newOrg.info[prop]) && newOrg.info[prop].length <= 0)) {
      return {
        error: requiredInfoPropErrors[prop],
      };
    }
  }
  return true;
};

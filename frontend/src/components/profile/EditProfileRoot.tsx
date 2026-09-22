import { Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { useRouter } from "next/router";
import React, { useContext, useState } from "react";
import Cookies from "universal-cookie";

import { apiRequest } from "../../../public/lib/apiOperations";
import { appHref } from "../../../public/lib/appLink";
import { HubContext } from "../context/HubContext";
import { blobFromObjectUrl, getImageUrl } from "../../../public/lib/imageOperations";
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

const useStyles = makeStyles((theme) => ({
  headline: {
    textAlign: "center",
    marginTop: theme.spacing(4),
  },
}));

export default function EditAccountRoot({
  profile,
  user,
  skillsOptions,
  infoMetadata,
  initialTranslations,
  locationInputRef,
  handleSetLocationOptionsOpen,
  setErrorMessage,
  availabilityOptions,
  allSectors,
}) {
  const { locale, locales } = useContext(UserContext);
  const { hubUrl } = useContext(HubContext);
  const cookies = new Cookies();
  const token = cookies.get("auth_token");
  const classes = useStyles();
  const [translations, setTranslations] = useState(
    initialTranslations ? getTranslationsFromObject(initialTranslations, "user_profile") : {}
  );
  const [sourceLanguage] = useState(profile.language);
  const [targetLanguage] = useState(locales.find((l) => l !== sourceLanguage)!);
  const [editedProfile, setEditedProfile] = useState({ ...profile });
  const STEPS = ["edit_profile", "edit_translations"];
  const [step, setStep] = useState(STEPS[0]);
  const texts = getTexts({ page: "profile", locale: locale });
  const router = useRouter();
  const handleSetEditedProfile = (newProfileData) => {
    setEditedProfile({ ...editedProfile, ...newProfileData });
  };

  const handleCancel = () => {
    router.push(appHref(`/profiles/${profile.url_slug}`, { hubUrl, locale }));
  };

  const handleGoToPreviousStep = () => {
    setStep(STEPS[STEPS.indexOf(step) - 1]);
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

  const saveChanges = async (editedAccount, isTranslationsStep = false) => {
    if (
      editedAccount?.info?.location === user?.info?.location &&
      !isLocationValid(editedAccount?.info?.location) &&
      !isTranslationsStep
    ) {
      indicateWrongLocation(locationInputRef, handleSetLocationOptionsOpen, setErrorMessage, texts);
      return;
    }
    editedAccount.language = sourceLanguage;
    const parsedProfile = parseProfileForRequest(editedAccount, availabilityOptions, user);
    const payload = await getProfileWithoutRedundantOptions(user, parsedProfile);
    payload.translations = parseTranslationsForRequest(
      getTranslationsWithoutRedundantKeys(
        getTranslationsFromObject(initialTranslations, "user_profile"),
        translations
      )
    );

    apiRequest({
      method: "post",
      url: "/api/edit_profile/",
      payload: payload,
      token: token,
      locale: locale,
    })
      .then(function (response) {
        router.push({
          pathname: `/profiles/${response.data.url_slug}`,
          query: {
            message: texts.you_have_successfully_updated_your_profile,
            hub: hubUrl,
          },
        });
      })
      .catch(function (error) {
        console.log(error);
        if (error && error.reponse) console.log(error.response);
      });
  };

  const handleTranslationsSubmit = async (event) => {
    event.preventDefault();
    await saveChanges(editedProfile, true);
  };

  const handleEditAccountPageSubmit = async (editedAccount) => {
    if (translations[targetLanguage]?.is_manual_translation && sourceLanguage !== "en") {
      setEditedProfile(editedAccount);
      setStep(STEPS[1]);
    } else {
      await saveChanges(editedAccount);
    }
  };

  const onClickCheckTranslations = async (editedAccount) => {
    setEditedProfile(editedAccount);
    setStep(STEPS[1]);
  };

  return (
    <>
      {profile ? (
        step === "edit_profile" ? (
          <EditAccountPage
            account={editedProfile}
            deleteEmail="support@climatehub.org"
            handleCancel={handleCancel}
            handleSubmit={handleEditAccountPageSubmit}
            infoMetadata={infoMetadata}
            skillsOptions={skillsOptions}
            splitName
            /*TODO(unused) type="profile" */
            onClickCheckTranslations={onClickCheckTranslations}
            allSectors={allSectors}
            sectorsTitle={texts.area_of_interest}
          />
        ) : (
          <>
            <Typography color="primary" className={classes.headline} component="h1" variant="h4">
              {texts.translate}
            </Typography>
            <TranslateTexts
              data={editedProfile}
              handleSetData={handleSetEditedProfile}
              onSubmit={handleTranslationsSubmit}
              goToPreviousStep={handleGoToPreviousStep}
              handleChangeTranslationContent={handleChangeTranslations}
              translations={translations}
              targetLanguage={targetLanguage}
              pageName="profile"
              introTextKey="translate_profile_intro"
              submitButtonText={texts.save}
              textsToTranslate={[
                {
                  textKey: "info.bio",
                  rows: 5,
                  headlineTextKey: "bio",
                  maxCharacters: 280,
                  showCharacterCounter: true,
                },
              ]}
            />
          </>
        )
      ) : (
        <PageNotFound itemName={texts.profile} />
      )}
    </>
  );
}

const parseProfileForRequest = (profile, availabilityOptions, user) => {
  const availability = availabilityOptions?.find((o) => o.key == profile.info.availability);
  const image = profile.image;
  const thumbnail = profile.thumbnail_image;
  const background = profile.background_image;

  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    image: image,
    thumbnail_image: thumbnail,
    background_image: background,
    country: profile.info.country,
    location: profile.info.location,
    biography: profile.info.bio,
    availability: availability ? availability.id : user.availability ? user.availability.id : null,
    skills: profile.info.skills.map((s) => s.id),
    website: profile.info.website,
    sectors: profile.info.sectors.map((s) => s.key),
  };
};

const getProfileWithoutRedundantOptions = async (user, newProfile) => {
  const oldProfile = {
    ...user,
    skills: user.skills.map((s) => s.id),
    image: getImageUrl(user.image),
    thumbnail_image: getImageUrl(user.thumbnail_image),
    background_image: getImageUrl(user.background_image),
    availability: user.availability && user.availability.id,
    sectors: user.sectors.map((s) => s.key),
  };

  const finalProfile: any = {};
  Object.keys(newProfile).map((k) => {
    if (
      oldProfile[k] &&
      newProfile[k] &&
      Array.isArray(oldProfile[k]) &&
      Array.isArray(newProfile[k])
    ) {
      if (!arraysEqual(oldProfile[k], newProfile[k])) finalProfile[k] = newProfile[k];
    } else if (oldProfile[k] !== newProfile[k] && !(!oldProfile[k] && !newProfile[k]))
      finalProfile[k] = newProfile[k];
  });
  if (finalProfile.image) finalProfile.image = await blobFromObjectUrl(finalProfile.image);
  if (finalProfile.thumbnail_image)
    finalProfile.thumbnail_image = await blobFromObjectUrl(finalProfile.thumbnail_image);
  if (finalProfile.background_image)
    finalProfile.background_image = await blobFromObjectUrl(finalProfile.background_image);

  return finalProfile;
};

const parseTranslationsForRequest = (translations) => {
  const finalTranslations = { ...translations };
  for (const key of Object.keys(translations)) {
    finalTranslations[key] = {
      ...translations[key],
    };
    if (translations[key].bio) finalTranslations[key].biography = translations[key].bio;
  }
  return finalTranslations;
};

function arraysEqual(_arr1, _arr2) {
  if (!Array.isArray(_arr1) || !Array.isArray(_arr2) || _arr1.length !== _arr2.length) return false;

  var arr1 = _arr1.concat().sort();
  var arr2 = _arr2.concat().sort();
  for (var i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }

  return true;
}

import { Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import NextCookies from "next-cookies";
import { useRouter } from "next/router";
import React, { useContext, useRef, useState } from "react";
import Cookies from "universal-cookie";
import ROLE_TYPES from "../public/data/role_types";
import { apiRequest, getLocalePrefix } from "../public/lib/apiOperations";
import { getSectorOptions } from "../public/lib/getOptions";
import { blobFromObjectUrl } from "../public/lib/imageOperations";
import {
  getLocationValue,
  indicateWrongLocation,
  isLocationValid,
  parseLocation,
} from "../public/lib/locationOperations";
import getTexts from "../public/texts/texts";
import UserContext from "../src/components/context/UserContext";
import LoginNudge from "../src/components/general/LoginNudge";
import TranslateTexts from "../src/components/general/TranslateTexts";
import WideLayout from "./../src/components/layouts/WideLayout";
import EnterBasicOrganizationInfo from "./../src/components/organization/EnterBasicOrganizationInfo";
import EnterDetailledOrganizationInfo from "./../src/components/organization/EnterDetailledOrganizationInfo";
import Alert from "@mui/material/Alert";
import getHubTheme from "../src/themes/fetchHubTheme";
import { transformThemeData } from "../src/themes/transformThemeData";
import theme from "../src/themes/theme";

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
}));

export async function getServerSideProps(ctx: {
  locale?: any;
  query?: any;
  req?: { headers: { cookie?: string | undefined } } | undefined;
}) {
  const { auth_token } = NextCookies(ctx);
  const hubUrl = ctx.query.hub;
  const hubThemeData = await getHubTheme(hubUrl);
  const [tagOptions, rolesOptions, allSectors] = await Promise.all([
    await getTags(auth_token, ctx.locale),
    await getRolesOptions(auth_token, ctx.locale),
    getSectorOptions(ctx.locale, hubUrl),
  ]);
  return {
    props: {
      tagOptions: tagOptions,
      rolesOptions: rolesOptions,
      allSectors: allSectors,
      hubUrl: hubUrl ?? null,
      hubThemeData: hubThemeData,
    },
  };
}

export default function CreateOrganization({
  tagOptions,
  rolesOptions,
  allSectors,
  hubUrl,
  hubThemeData,
}) {
  const token = new Cookies().get("auth_token");
  const classes = useStyles();
  const router = useRouter();
  const [errorMessages, setErrorMessages] = useState({
    basicOrganizationInfo: "",
    detailledOrganizationInfo: "",
  });

  const handleSetErrorMessages = (newErrorMessages) => {
    setErrorMessages(newErrorMessages);
    window.scrollTo(0, 0);
  };
  const { user, locale, locales } = useContext(UserContext);
  const texts = getTexts({ page: "organization", locale: locale });
  const steps = ["basicorganizationinfo", "detailledorganizationinfo", "checktranslations"];
  const [curStep, setCurStep] = useState(steps[0]);
  const locationInputRef = useRef(null);
  const [locationOptionsOpen, setLocationOptionsOpen] = useState(false);
  const [translations, setTranslations] = useState({});
  const [sourceLanguage] = useState(locale);
  const [targetLanguage] = useState(locales.find((l) => l !== locale));
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingSubmitDraft, setLoadingSubmitDraft] = useState(false);
  const [existingUrlSlug, setExistingUrlSlug] = useState("");
  const [existingName, setExistingName] = useState("");

  const [organizationInfo, setOrganizationInfo] = useState<any>({
    name: "",
    hasparentorganization: false,
    parentorganization: "",
    image: "",
    thumbnail_image: "",
    verified: false,
    info: {
      location: {},
      short_description: "",
      about: "",
      get_involved: "",
      organization_size: 0,
      website: "",
      sectors: [],
    },
    types: [] as any[],
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

  const handleSetLocationOptionsOpen = (bool) => {
    setLocationOptionsOpen(bool);
  };

  const handleSetLocationErrorMessage = (newMessage) => {
    handleSetErrorMessages({
      ...errorMessages,
      basicOrganizationInfo: newMessage,
    });
  };

  const handleSetDetailledErrorMessage = (newMessage) => {
    handleSetErrorMessages({
      ...errorMessages,
      detailledOrganizationInfo: newMessage,
    });
  };

  const handleSetExistingUrlSlug = (urlSlug) => {
    setExistingUrlSlug(urlSlug);
  };

  const handleSetExistingName = (name) => {
    setExistingName(name);
  };

  const handleBasicInfoSubmit = async (event, values) => {
    event.preventDefault();
    try {
      //Short circuit if there is no parent organization
      if (values.hasparentorganization && !values.parentOrganization) {
        handleSetErrorMessages({
          ...errorMessages,
          basicOrganizationInfo: texts.you_have_not_selected_a_parent_organization_either_untick,
        });
        return;
      }

      //short circuit if the location is invalid
      if (!isLocationValid(values.location)) {
        indicateWrongLocation(
          locationInputRef,
          setLocationOptionsOpen,
          handleSetLocationErrorMessage,
          texts
        );
        return;
      }
      const url = `/api/look_up_organization/?search=${values.organizationname}`;
      await apiRequest({
        method: "get",
        url: url,
        locale: locale,
      });

      const location = getLocationValue(values, "location");
      setOrganizationInfo({
        ...organizationInfo,
        name: values.organizationname,
        parentorganization: values.parentorganizationname,
        location: parseLocation(location),
        types: values.types,
      });
      /* This is required in the case that the user first inputs a name that is taken 
      then later submits with a valid name. Should they then edit the name to another taken name in the detailed view (German page)
      and then go Erstellen it will open up the auto translate screen with the old error message from the basic view.
      */
      handleSetErrorMessages({
        ...errorMessages,
        basicOrganizationInfo: "",
      });
      setCurStep(steps[1]);
    } catch (err: any) {
      if (err?.response?.data?.message) {
        handleSetErrorMessages({
          ...errorMessages,
          basicOrganizationInfo: (
            <div>
              {texts.an_organization_with_this_name_already_exists}{" "}
              <a
                href={getLocalePrefix(locale) + "/organizations/" + err?.response?.data?.url}
                target="_blank"
              >
                {texts.click_here}
              </a>{" "}
              {texts.to_see_it}
            </div>
          ),
        });
      } else {
        const location = getLocationValue(values, "location");

        setOrganizationInfo({
          ...organizationInfo,
          name: values.organizationname,
          parentorganization: values.parentorganizationname,
          location: parseLocation(location),
          types: values.orgtypes,
        });
        setCurStep(steps[1]);
      }
      if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
      return null;
    }
  };

  // Draft creation only requires a name - it can be triggered from the very
  // first step, before location/parent-organization/type validation (which
  // block progressing to the next step) even runs.
  const handleSaveAsDraftFromBasicInfo = async (values) => {
    if (!values.organizationname?.trim()) {
      handleSetErrorMessages({
        ...errorMessages,
        basicOrganizationInfo: texts.organization_name_required_to_save_as_draft,
      });
      return;
    }
    const payload: any = {
      is_draft: true,
      name: values.organizationname,
      team_members: [
        {
          user_id: user!.id,
          permission_type_id: rolesOptions.find((r) => r.role_type === ROLE_TYPES.all_type).id,
        },
      ],
    };
    if (values.hasparentorganization && values.parentOrganization) {
      payload.parent_organization = values.parentOrganization.id;
    }
    if (values.location && typeof values.location === "object") {
      const parsedLocation = parseLocation(values.location);
      if (hasResolvableLocation(parsedLocation)) {
        payload.location = parsedLocation;
      }
    }
    if (values.types?.length) {
      payload.organization_tags = values.types;
    }
    if (hubUrl) {
      payload.created_in_hub = hubUrl;
    }

    setLoadingSubmitDraft(true);
    await makeCreateOrganizationRequest(payload, true);
  };

  const requiredPropErrors = {
    image: texts.image_required_error,
    organization_tags: texts.type_required_errror,
    name: texts.name_required_error,
    location: texts.location_required_error,
  };

  const handleSetOrganizationInfo = (newOrganizationData) => {
    setOrganizationInfo({ ...setOrganizationInfo, ...newOrganizationData });
  };
  const handleDetailledInfoSubmit = async (account) => {
    //If the language is not language, short circuit and allow users to check the english translations for their texts

    const organizationToSubmit = await parseOrganizationForRequest(
      account,
      user,
      rolesOptions,
      translations,
      sourceLanguage,
      hubUrl
    );

    if (!isLocationValid(organizationToSubmit.location)) {
      indicateWrongLocation(
        locationInputRef,
        setLocationOptionsOpen,
        handleSetDetailledErrorMessage,
        texts
      );
      return;
    }
    for (const prop of Object.keys(requiredPropErrors)) {
      if (
        !organizationToSubmit[prop] ||
        (Array.isArray(organizationToSubmit[prop]) && organizationToSubmit[prop].length <= 0)
      ) {
        handleSetErrorMessages({
          errorMessages,
          detailledOrganizationInfo: requiredPropErrors[prop],
        });
        return;
      }
    }

    /*if (locale !== "en") {
      console.log(account);
      setOrganizationInfo({
        ...account,
        parentorganization: organizationInfo.parentorganization,
      });
      setCurStep(steps[2]);
      return;
    }*/
    setLoadingSubmit(true);
    await makeCreateOrganizationRequest(organizationToSubmit);
  };

  const goToPreviousStep = () => {
    setCurStep(steps[steps.indexOf(curStep) - 1]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const organizationToSubmit = await parseOrganizationForRequest(
      organizationInfo,
      user,
      rolesOptions,
      translations,
      sourceLanguage,
      hubUrl
    );
    await makeCreateOrganizationRequest(organizationToSubmit);
  };

  // A location is only safe to send to the backend once it has been resolved
  // to a real place (has a place_id or a full OSM composite key) - an empty
  // or partially-typed location object would make the backend's location
  // lookup throw. Drafts skip the stricter isLocationValid() check used for
  // normal creation, so this stands in as the minimal safety check.
  const hasResolvableLocation = (location) =>
    !!location &&
    typeof location !== "string" &&
    (!!location.place_id || (!!location.osm_id && !!location.osm_type && !!location.osm_class));

  const handleSaveAsDraft = async (account) => {
    const organizationToSubmit: any = await parseOrganizationForRequest(
      account,
      user,
      rolesOptions,
      translations,
      sourceLanguage,
      hubUrl
    );
    organizationToSubmit.is_draft = true;
    if (!hasResolvableLocation(organizationToSubmit.location)) {
      delete organizationToSubmit.location;
    }
    setLoadingSubmitDraft(true);
    await makeCreateOrganizationRequest(organizationToSubmit, true);
  };

  const makeCreateOrganizationRequest = (organizationToSubmit, isDraft = false) => {
    apiRequest({
      method: "post",
      url: "/api/create_organization/",
      payload: organizationToSubmit,
      token: token,
      locale: locale,
    })
      .then(function (response) {
        setLoadingSubmit(false);
        setLoadingSubmitDraft(false);
        if (isDraft) {
          router.push({
            pathname: `/editOrganization/${response.data.url_slug}`,
            query: {
              message: texts.you_have_successfully_saved_your_organization_as_a_draft,
              hub: hubUrl ? hubUrl : "",
            },
          });
        } else {
          router.push({
            pathname: `/manageOrganizationMembers/${response.data.url_slug}`,
            query: {
              message: texts.you_have_successfully_created_an_organization_you_can_add_members,
              isCreationStage: true,
              hub: hubUrl ? hubUrl : "",
            },
          });
        }
        return;
      })
      .catch(function (error) {
        console.log(error);
        setLoadingSubmit(false);
        setLoadingSubmitDraft(false);
        if (error) console.log(error?.response?.data);
        if (error?.response?.data?.message)
          handleSetErrorMessages({
            errorMessages,
            detailledOrganizationInfo: error?.response?.data?.message,
          });
        if (error?.response?.data?.url_slug)
          handleSetExistingUrlSlug(error?.response?.data?.url_slug);
        if (error?.response?.data?.existing_name)
          handleSetExistingName(error?.response.data?.existing_name);
        return;
      });
  };

  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;
  const layoutProps = {
    hubUrl: hubUrl,
    customTheme: customTheme,
    headerBackground: customTheme
      ? customTheme.palette.header.background
      : theme.palette.background.default,
  };

  if (!user)
    return (
      <WideLayout
        {...layoutProps}
        title={texts.please_log_in + " " + texts.to_create_an_organization}
      >
        <LoginNudge fullPage whatToDo={texts.to_create_an_organization} />
      </WideLayout>
    );
  else if (curStep === "basicorganizationinfo")
    return (
      <WideLayout {...layoutProps} title={texts.create_an_organization}>
        <EnterBasicOrganizationInfo
          errorMessage={errorMessages.basicOrganizationInfo}
          handleSubmit={handleBasicInfoSubmit}
          organizationInfo={organizationInfo}
          locationInputRef={locationInputRef}
          locationOptionsOpen={locationOptionsOpen}
          handleSetLocationOptionsOpen={handleSetLocationOptionsOpen}
          tagOptions={tagOptions}
          handleSaveAsDraft={handleSaveAsDraftFromBasicInfo}
          loadingSubmitDraft={loadingSubmitDraft}
        />
      </WideLayout>
    );
  else if (curStep === "detailledorganizationinfo")
    return (
      <WideLayout {...layoutProps} title={texts.create_an_organization}>
        <EnterDetailledOrganizationInfo
          errorMessage={errorMessages.detailledOrganizationInfo}
          existingName={existingName}
          existingUrlSlug={existingUrlSlug}
          handleSubmit={handleDetailledInfoSubmit}
          organizationInfo={organizationInfo}
          tagOptions={tagOptions}
          locationInputRef={locationInputRef}
          locationOptionsOpen={locationOptionsOpen}
          handleSetLocationOptionsOpen={handleSetLocationOptionsOpen}
          loadingSubmit={loadingSubmit}
          allSectors={allSectors}
          handleSaveAsDraft={handleSaveAsDraft}
          loadingSubmitDraft={loadingSubmitDraft}
        />
      </WideLayout>
    );
  else if (curStep === "checktranslations") {
    const hideGetInvolvedField =
      organizationInfo.types.map((type) => type.hide_get_involved).includes(true) ||
      organizationInfo.types.length === 0;

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

    const textsToTranslate = hideGetInvolvedField
      ? standardTextsToTranslate
      : standardTextsToTranslate.concat(getInvolvedText);

    return (
      <WideLayout {...layoutProps} title={texts.languages}>
        {errorMessages.detailledOrganizationInfo && (
          <Alert severity="error" className={classes.alert}>
            {errorMessages.detailledOrganizationInfo}
          </Alert>
        )}
        {errorMessages.basicOrganizationInfo && (
          <Alert severity="error" className={classes.alert}>
            {errorMessages.basicOrganizationInfo}
          </Alert>
        )}
        <Typography color="primary" className={classes.headline} component="h1" variant="h4">
          {texts.translate}
        </Typography>
        <TranslateTexts
          data={organizationInfo}
          pageName="organization"
          handleSetData={handleSetOrganizationInfo}
          onSubmit={handleSubmit}
          translations={translations}
          targetLanguage={targetLanguage}
          handleChangeTranslationContent={handleChangeTranslationContent}
          goToPreviousStep={goToPreviousStep}
          introTextKey="translate_organization_intro"
          textsToTranslate={textsToTranslate}
          organization={organizationInfo}
        />
      </WideLayout>
    );
  }
}

const getRolesOptions = async (token, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/roles/",
      token: token,
      locale: locale,
    });
    if (resp.data.results.length === 0) return null;
    else {
      return resp.data.results;
    }
  } catch (err: any) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
};

async function getTags(token: string | undefined, locale: any) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/organizationtags/",
      token: token,
      locale: locale,
    });
    if (resp.data.results.length === 0) return null;
    else {
      return resp.data.results.map((t) => {
        return { ...t, key: t.id, additionalInfo: t.additional_info ? t.additional_info : [] };
      });
    }
  } catch (err: any) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

type RequestOrganization = any;

const parseOrganizationForRequest = async (
  o,
  user,
  rolesOptions,
  translations,
  sourceLanguage,
  hubUrl
) => {
  console.log(hubUrl);
  console.log(hubUrl === undefined);
  console.log(typeof hubUrl === "string");
  const organization: RequestOrganization = {
    team_members: [
      {
        user_id: user.id,
        permission_type_id: rolesOptions.find((r) => r.role_type === ROLE_TYPES.all_type).id,
      },
    ],
    name: o.name,
    background_image: o.background_image,
    image: o.image,
    thumbnail_image: o.thumbnail_image,
    location: o.info.location,
    short_description: o.info.short_description,
    get_involved: o.info.get_involved,
    organization_size: o.info.organization_size,
    website: o.info.website,
    sectors: o.info.sectors.map((h) => h.key),
    about: o.info.about,
    organization_tags: o.types,
    translations: {
      ...translations,
    },
    source_language: sourceLanguage,
    parent_organization: undefined,
    school: undefined,
  };
  if (o.parentorganization) organization.parent_organization = o.parentorganization;
  if (o.background_image)
    organization.background_image = await blobFromObjectUrl(o.background_image);
  if (o.thumbnail_image) organization.thumbnail_image = await blobFromObjectUrl(o.thumbnail_image);
  if (o.image) organization.image = await blobFromObjectUrl(o.image);
  if (o.info.school) organization.school = o.info.school;
  if (hubUrl) {
    organization.created_in_hub = hubUrl;
  }
  return organization;
};

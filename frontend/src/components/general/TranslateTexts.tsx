import {
  Button,
  CircularProgress,
  Container,
  TextField,
  Typography,
  AppBar,
  Toolbar,
  Tooltip,
  Theme,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import _ from "lodash";
import React, { useContext, useEffect, useState } from "react";
import { apiRequest } from "../../../public/lib/apiOperations";
import { getNestedValue } from "../../../public/lib/generalOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ConfirmDialog from "../dialogs/ConfirmDialog";
import useMediaQuery from "@mui/material/useMediaQuery";
import VisibleFooterHeight from "../hooks/VisibleFooterHeight";
import SaveIcon from "@mui/icons-material/Save";
import KeyboardBackspaceIcon from "@mui/icons-material/KeyboardBackspace";
import ProjectDescriptionEditor from "../editProject/ProjectDescriptionEditor";

const RootContainer = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

const Explanation = styled(Typography)({
  margin: "0 auto",
  textAlign: "center",
});

const SectionHeader = styled(Typography)(({ theme }) => ({
  fontSize: 22,
  fontWeight: "bold",
  marginTop: theme.spacing(1.5),
  overflowWrap: "break-word",
}));

const TranslationBlocksHeader = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

const TranslationBlockWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  marginBottom: theme.spacing(2),

  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "center",
    border: `1px solid ${theme.palette.grey[500]}`,
    borderRadius: 15,
    padding: theme.spacing(1),
  },
}));

const TranslationBlockElementWrapper = styled("div")(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    flexGrow: 0.48,
    flexBasis: 400,
  },
  [theme.breakpoints.down("md")]: {
    flexGrow: 0.48,
    width: "100%",
  },
}));

const TopButtonRow = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "flex-start",
  width: "100%",
  justifyContent: "center",
  marginTop: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    marginTop: theme.spacing(0),
  },
}));

const StyledTranslateButton = styled(Button)(({ theme }) => ({
  marginRight: theme.spacing(1),
  marginLeft: theme.spacing(1),
  [theme.breakpoints.down("md")]: {
    minWidth: 100,
  },
  width: 265,
}));

const TranslationLoader = styled(CircularProgress)({
  color: "white",
});

const SubmitOptions = styled("div")({
  display: "flex",
  flexDirection: "column",
});

const SaveAsDraftButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const ActionBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "$visibleFooterHeight",
})<{ $visibleFooterHeight?: number }>(({ $visibleFooterHeight }) => ({
  backgroundColor: "#ECECEC",
  top: "auto",
  bottom: $visibleFooterHeight,
  boxShadow: "-3px -3px 6px #00000029",
  zIndex: 1,
}));

const ContainerButtonsActionBar = styled(Toolbar)({
  display: "flex",
  justifyContent: "space-around",
});

const StyledBackButton = styled(Button)({
  border: `1px solid #000000`,
});

type Props = {
  data?;
  handleSetData?;
  onSubmit?;
  goToPreviousStep?;
  handleChangeTranslationContent?;
  translations?;
  targetLanguage?;
  pageName?;
  textsToTranslate?;
  arrayTranslationKeys?;
  introTextKey?;
  submitButtonText?;
  saveAsDraft?;
  loadingSubmit?;
  loadingSubmitDraft?;
  organization?;
};
// @textsToTranslate: Metadata object showing which keys of the data object are translateable.
// Example: [{textKey: "short_description", rows: 5, headlineTextKey: "summary"}]
export default function TranslateTexts({
  data,
  handleSetData,
  onSubmit,
  goToPreviousStep,
  handleChangeTranslationContent,
  translations,
  targetLanguage,
  pageName,
  textsToTranslate,
  arrayTranslationKeys,
  introTextKey,
  submitButtonText,
  saveAsDraft,
  loadingSubmit,
  loadingSubmitDraft,
  organization,
}: Props) {
  const visibleFooterHeight = VisibleFooterHeight({});
  const { locale } = useContext(UserContext);
  //For the organization page, we need to retrieve the organization name to get the german text.
  //Therefore we pass organization even it this might not make sense in most cases.
  const texts = getTexts({
    page: pageName,
    locale: data.language ? data.language : locale,
    organization: organization,
  });
  const targetLanguageTexts = getTexts({
    page: pageName,
    locale: targetLanguage,
    organization: organization,
  });

  const localeTexts = getTexts({
    page: pageName,
    locale: locale,
    organization: organization,
  });
  const [waitingForTranslation, setWaitingForTranslation] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const belowSmall = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));

  useEffect(() => {
    initializeTranslationsObject();
  }, []);

  const initializeTranslationsObject = () => {
    if (!translations[targetLanguage]) {
      const initializedObject = {};
      if (arrayTranslationKeys) {
        for (const key of arrayTranslationKeys) {
          initializedObject[key] = [];
        }
      }
      handleChangeTranslationContent(targetLanguage, { ...initializedObject }, false);
    }
  };

  const handleOriginalTextChange = (newValue, dataKey, data) => {
    const obj = data;
    _.set(obj, dataKey, newValue);
    handleSetData(obj);
  };

  const handleTranslationChange = (newValue, dataKey, indexInArray) => {
    const flatKey = dataKey.includes(".")
      ? dataKey.split(".")[dataKey.split(".").length - 1]
      : dataKey;
    const newTranslationsObject = {
      [flatKey]: newValue,
    };
    //If it's an array, pass the whole array as the value
    if (indexInArray || indexInArray === 0) {
      const arrayValue = [...translations[targetLanguage][flatKey]];
      arrayValue[indexInArray] = newValue;
      newTranslationsObject[flatKey] = [...arrayValue];
    }
    handleChangeTranslationContent(targetLanguage, { ...newTranslationsObject }, true);
  };

  const areTextsToTranslateEmpty = () => {
    const textsWithContent = textsToTranslate.filter((t) => {
      const key = t.dataKey || t.textKey;
      return getNestedValue(data, key) && getNestedValue(data, key).length > 0;
    });
    if (textsWithContent.length === 0) return "all";
    if (textsWithContent.length === textsToTranslate.length) {
      return "none";
    } else {
      return "some";
    }
  };

  const automaticallyTranslateTexts = async (force) => {
    if (areTextsToTranslateEmpty() === "all") {
      return;
    }
    if (
      force !== true &&
      areTextsToTranslateEmpty() !== "all" &&
      translations[targetLanguage].is_manual_translation
    ) {
      setConfirmDialogOpen(true);
      return;
    }
    setWaitingForTranslation(true);
    try {
      const payloadTexts = textsToTranslate.reduce((obj, textToTranslate) => {
        const effectiveKey = textToTranslate.dataKey || textToTranslate.textKey;
        const flatKey = effectiveKey.includes(".")
          ? effectiveKey.split(".")[effectiveKey.split(".").length - 1]
          : effectiveKey;
        obj[flatKey] = getNestedValue(data, effectiveKey);
        return obj;
      }, {});
      const response = await apiRequest({
        method: "post",
        url: "/api/translate_many/",
        payload: {
          texts: payloadTexts,
          target_language: "en",
        },
        locale: locale,
      });
      const translations = response.data.translations;
      const translationsObject = Object.keys(translations).reduce(function (obj, key) {
        if (Array.isArray(translations[key]))
          obj[key] = translations[key].map((t) => t?.translated_text);
        else obj[key] = translations[key]?.translated_text;
        return obj;
      }, {});
      console.log(translationsObject);
      handleChangeTranslationContent(targetLanguage, translationsObject);
      setWaitingForTranslation(false);
    } catch (e: any) {
      console.log(e);
      console.log(e?.response?.data);
      setWaitingForTranslation(false);
    }
  };

  const onConfirmDialogClose = async (confirmed) => {
    setConfirmDialogOpen(false);
    if (confirmed) await automaticallyTranslateTexts(true);
  };
  return (
    <RootContainer>
      <form onSubmit={onSubmit}>
        <Explanation color="secondary">{introTextKey && localeTexts[introTextKey]}</Explanation>

        <TranslationActionButtonBar
          belowSmall={belowSmall}
          waitingForTranslation={waitingForTranslation}
          automaticallyTranslateTexts={automaticallyTranslateTexts}
          goToPreviousStep={goToPreviousStep}
          localeTexts={localeTexts}
          loadingSubmit={loadingSubmit}
          loadingSubmitDraft={loadingSubmitDraft}
          submitButtonText={submitButtonText}
          saveAsDraft={saveAsDraft}
          visibleFooterHeight={visibleFooterHeight}
        />
        <TranslationBlocksHeader>
          {textsToTranslate.map((textObj, index) => {
            const effectiveDataKey = textObj.dataKey || textObj.textKey;
            if (textObj.isArray) {
              return data[textObj.textKey].map((entry, index) => (
                <TranslationBlock
                  key={index}
                  data={data}
                  headlineTextKey={textObj.headlineTextKey}
                  dataKey={effectiveDataKey}
                  indexInArray={index}
                  isInArray
                  rows={textObj.rows}
                  handleOriginalTextChange={handleOriginalTextChange}
                  handleTranslationChange={handleTranslationChange}
                  translations={translations}
                  targetLanguage={targetLanguage}
                  texts={texts}
                  targetLanguageTexts={targetLanguageTexts}
                />
              ));
            } else
              return (
                <TranslationBlock
                  key={index}
                  data={data}
                  headlineTextKey={textObj.headlineTextKey}
                  dataKey={effectiveDataKey}
                  rows={textObj.rows}
                  handleOriginalTextChange={handleOriginalTextChange}
                  handleTranslationChange={handleTranslationChange}
                  translations={translations}
                  targetLanguage={targetLanguage}
                  texts={texts}
                  targetLanguageTexts={targetLanguageTexts}
                  maxCharacters={textObj.maxCharacters}
                  showCharacterCounter={textObj.showCharacterCounter}
                  richText={textObj.richText}
                />
              );
          })}
        </TranslationBlocksHeader>
      </form>
      <ConfirmDialog
        onClose={onConfirmDialogClose}
        open={confirmDialogOpen}
        cancelText={texts.no}
        confirmText={texts.yes}
        text={texts.confirm_overwrite_all_texts}
        title={texts.confirm_overwrite_all_texts_headline}
      />
    </RootContainer>
  );
}

//@textKey: the key of the headline text in public/texts/project_texts.js
function TranslationBlock({
  headlineTextKey,
  rows,
  data,
  dataKey,
  handleOriginalTextChange,
  handleTranslationChange,
  translations,
  targetLanguage,
  isInArray,
  indexInArray,
  noHeadline,
  texts,
  targetLanguageTexts,
  maxCharacters,
  showCharacterCounter,
  richText,
}: any) {
  const flatDataKey = dataKey.includes(".")
    ? dataKey.split(".")[dataKey.split(".").length - 1]
    : dataKey;

  const changeOriginalText = (newValue, dataKey) => {
    if (!isInArray) {
      handleOriginalTextChange(newValue, dataKey, data);
    } else {
      const newArrayValue = data[dataKey];
      newArrayValue[indexInArray] = newValue;
      handleOriginalTextChange(newArrayValue, dataKey, data);
    }
  };

  const originalContent = isInArray
    ? getNestedValue(data, dataKey)[indexInArray]
    : getNestedValue(data, dataKey);

  const translationContent =
    translations[targetLanguage] &&
    (isInArray
      ? translations[targetLanguage][flatDataKey][indexInArray]
      : translations[targetLanguage][flatDataKey]);

  return (
    <TranslationBlockWrapper>
      {richText ? (
        <>
          <TranslationBlockElementWrapper>
            {!noHeadline && <SectionHeader color="primary">{texts[headlineTextKey]}</SectionHeader>}
            <ProjectDescriptionEditor
              descriptionHtml={originalContent || ""}
              onChange={(html) => changeOriginalText(html, dataKey)}
            />
          </TranslationBlockElementWrapper>
          <TranslationBlockElementWrapper>
            {!noHeadline && (
              <SectionHeader color="primary">{targetLanguageTexts[headlineTextKey]}</SectionHeader>
            )}
            <ProjectDescriptionEditor
              descriptionHtml={translationContent || ""}
              onChange={(html) => handleTranslationChange(html, dataKey, indexInArray)}
            />
          </TranslationBlockElementWrapper>
        </>
      ) : (
        <>
          <TranslationBlockElement
            headline={texts[headlineTextKey]}
            noHeadline={noHeadline}
            rows={rows}
            content={originalContent}
            handleContentChange={(event) => {
              changeOriginalText(event.target.value, dataKey);
            }}
            maxCharacters={maxCharacters}
            characterText={texts.characters}
            showCharacterCounter={showCharacterCounter}
          />
          <TranslationBlockElement
            headline={targetLanguageTexts[headlineTextKey]}
            noHeadline={noHeadline}
            rows={rows}
            content={translationContent}
            handleContentChange={(event) => {
              handleTranslationChange(event.target.value, dataKey, indexInArray);
            }}
            maxCharacters={maxCharacters * 1.2}
            characterText={texts.characters}
            showCharacterCounter={showCharacterCounter}
          />
        </>
      )}
    </TranslationBlockWrapper>
  );
}

function TranslationBlockElement({
  headline,
  rows,
  content,
  handleContentChange,
  noHeadline,
  showCharacterCounter,
  maxCharacters,
  characterText,
}) {
  return (
    <TranslationBlockElementWrapper>
      {!noHeadline && <SectionHeader color="primary">{headline}</SectionHeader>}

      <TextField
        rows={rows}
        maxRows={50}
        variant="outlined"
        fullWidth
        multiline
        inputProps={{ maxLength: maxCharacters }}
        helperText={
          showCharacterCounter &&
          "( " + content?.length + " / " + maxCharacters + " " + characterText + " ) "
        }
        value={content}
        onChange={handleContentChange}
      />
    </TranslationBlockElementWrapper>
  );
}

function TranslationActionButtonBar({
  belowSmall,
  waitingForTranslation,
  automaticallyTranslateTexts,
  goToPreviousStep,
  localeTexts,
  loadingSubmit,
  loadingSubmitDraft,
  submitButtonText,
  saveAsDraft,
  visibleFooterHeight,
}) {
  return (
    <>
      {!belowSmall ? (
        <TopButtonRow>
          <BackButton
            goToPreviousStep={goToPreviousStep}
            label={{ label: localeTexts.back }}
            localeTexts={localeTexts}
          />
          <TranslateButton
            automaticallyTranslateTexts={automaticallyTranslateTexts}
            waitingForTranslation={waitingForTranslation}
            label={localeTexts.automatically_translate}
          />
          <SubmitOptions>
            <SaveButtons
              loadingSubmit={loadingSubmit}
              loadingSubmitDraft={loadingSubmitDraft}
              localeTexts={localeTexts}
              label={{ label: submitButtonText }}
              saveAsDraft={saveAsDraft}
            />
          </SubmitOptions>
        </TopButtonRow>
      ) : (
        <ActionBar $visibleFooterHeight={visibleFooterHeight} position="fixed" elevation={0}>
          <ContainerButtonsActionBar variant="dense">
            {" "}
            <TopButtonRow>
              <BackButton
                goToPreviousStep={goToPreviousStep}
                label={{ icon: KeyboardBackspaceIcon }}
                localeTexts={localeTexts}
              />
              <TranslateButton
                automaticallyTranslateTexts={automaticallyTranslateTexts}
                waitingForTranslation={waitingForTranslation}
                label={localeTexts.translate}
              />
              <SubmitOptions>
                <SaveButtons
                  loadingSubmit={loadingSubmit}
                  loadingSubmitDraft={loadingSubmitDraft}
                  localeTexts={localeTexts}
                  label={{ icon: SaveIcon }}
                  saveAsDraft={saveAsDraft}
                />
              </SubmitOptions>
            </TopButtonRow>
          </ContainerButtonsActionBar>
        </ActionBar>
      )}
    </>
  );
}

function BackButton({ goToPreviousStep, label, localeTexts }) {
  return (
    <StyledBackButton onClick={goToPreviousStep} variant="contained">
      {label.icon ? (
        <Tooltip arrow placement="top" title={localeTexts.back}>
          <label.icon />
        </Tooltip>
      ) : (
        label.label
      )}
    </StyledBackButton>
  );
}

function TranslateButton({ automaticallyTranslateTexts, waitingForTranslation, label }) {
  return (
    <StyledTranslateButton
      variant="contained"
      color="primary"
      onClick={() => automaticallyTranslateTexts()}
      disabled={waitingForTranslation}
    >
      {waitingForTranslation ? <TranslationLoader size={23} /> : label}
    </StyledTranslateButton>
  );
}

function SaveButtons({ loadingSubmit, loadingSubmitDraft, localeTexts, label, saveAsDraft }) {
  return (
    <>
      <Button
        variant="contained"
        color="primary"
        type="submit"
        disabled={loadingSubmit || loadingSubmitDraft}
      >
        {loadingSubmit ? (
          <TranslationLoader size={23} />
        ) : label ? (
          label.icon ? (
            <Tooltip arrow placement="top" title={localeTexts.save}>
              <label.icon />
            </Tooltip>
          ) : (
            label.label
          )
        ) : (
          localeTexts.skip_and_publish
        )}
      </Button>
      {saveAsDraft && (
        <SaveAsDraftButton
          variant="contained"
          disabled={loadingSubmit || loadingSubmitDraft}
          onClick={saveAsDraft}
        >
          {loadingSubmitDraft ? <TranslationLoader size={23} /> : localeTexts.save_as_draft}
        </SaveAsDraftButton>
      )}
    </>
  );
}

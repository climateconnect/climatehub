import { Button, Container, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useState } from "react";
import { apiRequest } from "../../../public/lib/apiOperations";
import getProjectTexts from "../../../public/texts/project_texts";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import NavigationButtons from "../general/NavigationButtons";
import ButtonLoader from "../general/ButtonLoader";
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
  marginBottom: theme.spacing(1.5),
}));

const TranslationBlocksHeader = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

const TranslationBlockRoot = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  marginBottom: theme.spacing(2),
}));

const TranslationBlockElementRoot = styled("div")({
  flexGrow: 0.48,
});

const TopButtonRow = styled("div")(({ theme }) => ({
  display: "inline-flex",
  width: "100%",
  justifyContent: "center",
  marginTop: theme.spacing(2),
}));

const TranslateButton = styled(Button)(({ theme }) => ({
  marginRight: theme.spacing(1),
  marginLeft: theme.spacing(1),
  width: 265,
}));

export default function TranslateProject({
  projectData,
  handleSetProjectData,
  onSubmit,
  saveAsDraft,
  goToPreviousStep,
  handleChangeTranslationContent,
  translations,
  targetLanguage,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const [waitingForTranslation, setWaitingForTranslation] = useState(false);

  if (translations[targetLanguage]) console.log(translations[targetLanguage]);

  const onClickPreviousStep = () => {
    goToPreviousStep();
  };

  const handleOriginalTextChange = (newValue, projectDataKey) => {
    handleSetProjectData({
      [projectDataKey]: newValue,
    });
  };

  const handleTranslationChange = (newValue, projectDataKey, indexInArray) => {
    const newTranslationsObject = {
      [projectDataKey]: newValue,
    };
    //If it's an array, pass the whole array as the value
    if (indexInArray || indexInArray === 0) {
      const arrayValue = [...translations[targetLanguage][projectDataKey]];
      arrayValue[indexInArray] = newValue;
      newTranslationsObject[projectDataKey] = [...arrayValue];
    }
    handleChangeTranslationContent(targetLanguage, { ...newTranslationsObject }, true);
  };

  const automaticallyTranslateProject = async () => {
    setWaitingForTranslation(true);
    try {
      const response = await apiRequest({
        method: "post",
        url: "/api/translate_many/",
        payload: {
          texts: {
            name: projectData.name,
            short_description: projectData.short_description,
            description_html: projectData.description_html,
          },
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
    } catch (e) {
      console.log(e);
      console.log(e?.response?.data);
      setWaitingForTranslation(false);
    }
  };

  return (
    <RootContainer>
      <form onSubmit={onSubmit}>
        <Explanation color="secondary">{texts.translate_project_intro}</Explanation>
        <TopButtonRow>
          <Button onClick={goToPreviousStep} variant="contained">
            {texts.back}
          </Button>
          <TranslateButton
            variant="contained"
            color="primary"
            onClick={automaticallyTranslateProject}
          >
            {waitingForTranslation ? <ButtonLoader /> : texts.automatically_translate}
          </TranslateButton>
          <Button variant="contained" color="primary" type="submit">
            {texts.skip_and_publish}
          </Button>
        </TopButtonRow>
        <TranslationBlocksHeader>
          <TranslationBlock
            projectData={projectData}
            headlineTextKey="project_name"
            projectDataKey="name"
            rows={1}
            handleOriginalTextChange={handleOriginalTextChange}
            handleTranslationChange={handleTranslationChange}
            translations={translations}
            targetLanguage={targetLanguage}
          />
          <TranslationBlock
            projectData={projectData}
            headlineTextKey="summary"
            projectDataKey="short_description"
            rows={5}
            handleOriginalTextChange={handleOriginalTextChange}
            handleTranslationChange={handleTranslationChange}
            translations={translations}
            targetLanguage={targetLanguage}
          />
          <TranslationBlock
            projectData={projectData}
            projectDataKey="description_html"
            headlineTextKey="project_description"
            rows={15}
            handleOriginalTextChange={handleOriginalTextChange}
            handleTranslationChange={handleTranslationChange}
            translations={translations}
            targetLanguage={targetLanguage}
            richText
          />
        </TranslationBlocksHeader>
        <NavigationButtons
          onClickPreviousStep={onClickPreviousStep}
          nextStepButtonType="publish"
          saveAsDraft={saveAsDraft}
        />
      </form>
    </RootContainer>
  );
}

//@textKey: the key of the headline text in public/texts/project_texts.js
function TranslationBlock({
  headlineTextKey,
  rows,
  projectData,
  projectDataKey,
  handleOriginalTextChange,
  handleTranslationChange,
  translations,
  targetLanguage,
  isInArray,
  indexInArray,
  noHeadline,
  richText,
}) {
  const texts = getProjectTexts({});

  const originalContent = isInArray
    ? projectData[projectDataKey][indexInArray]
    : projectData[projectDataKey];

  const translationContent =
    translations[targetLanguage] &&
    (isInArray
      ? translations[targetLanguage][projectDataKey][indexInArray]
      : translations[targetLanguage][projectDataKey]);

  return (
    <TranslationBlockRoot>
      {richText ? (
        <>
          <TranslationBlockElementRoot>
            {!noHeadline && (
              <SectionHeader color="primary">
                {texts[headlineTextKey][targetLanguage]}
              </SectionHeader>
            )}
            <ProjectDescriptionEditor
              descriptionHtml={originalContent || ""}
              onChange={(html) => handleOriginalTextChange(html, projectDataKey)}
            />
          </TranslationBlockElementRoot>
          <TranslationBlockElementRoot>
            {!noHeadline && (
              <SectionHeader color="primary">
                {texts[headlineTextKey][targetLanguage]}
              </SectionHeader>
            )}
            <ProjectDescriptionEditor
              descriptionHtml={translationContent || ""}
              onChange={(html) => handleTranslationChange(html, projectDataKey, indexInArray)}
            />
          </TranslationBlockElementRoot>
        </>
      ) : (
        <>
          <TranslationBlockElement
            headline={texts[headlineTextKey][targetLanguage]}
            noHeadline={noHeadline}
            rows={rows}
            content={originalContent}
            handleContentChange={(event) =>
              handleOriginalTextChange(event.target.value, projectDataKey)
            }
          />
          <TranslationBlockElement
            headline={texts[headlineTextKey][targetLanguage]}
            noHeadline={noHeadline}
            rows={rows}
            isTranslation
            content={translationContent}
            handleContentChange={(event) =>
              handleTranslationChange(event.target.value, projectDataKey, indexInArray)
            }
          />
        </>
      )}
    </TranslationBlockRoot>
  );
}

function TranslationBlockElement({ headline, rows, content, handleContentChange, noHeadline }) {
  return (
    <TranslationBlockElementRoot>
      {!noHeadline && <SectionHeader color="primary">{headline}</SectionHeader>}
      <TextField
        rows={rows}
        variant="outlined"
        fullWidth
        multiline
        value={content}
        onChange={handleContentChange}
      />
    </TranslationBlockElementRoot>
  );
}

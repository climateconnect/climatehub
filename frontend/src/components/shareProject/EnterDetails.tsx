import { Container, IconButton, TextField, Tooltip, Typography, Switch } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import React, { useContext, useEffect, useRef, useState } from "react";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import NavigationButtons from "../general/NavigationButtons";
import RequiredFieldsNotice from "../general/RequiredFieldsNotice";
import ProjectTimeAndPlaceSectionAndCustomHub from "./TimeAndPlaceSection";
import AddPhotoSection from "./AddPhotoSection";
import AddSummarySection from "./AddSummarySection";
import ProjectNameSection from "./ProjectNameSection";
import ProjectDescriptionEditor from "../editProject/ProjectDescriptionEditor";
import { checkProjectDatesValid } from "../../../public/lib/dateOperations";
import { indicateWrongLocation, isLocationValid } from "../../../public/lib/locationOperations";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";
import { useTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import EventRegistrationSection from "./EventRegistrationSection";
import { validateRegistrationFields } from "../../utils/eventRegistrationHelpers";

const useStyles = makeStyles((theme) => {
  return {
    headline: {
      textAlign: "center",
      marginTop: theme.spacing(8),
      marginBottom: theme.spacing(8),
    },
    stepsTracker: {
      maxWidth: 600,
      margin: "0 auto",
    },
    subHeader: {
      marginBottom: theme.spacing(2),
      fontSize: 20,
      color: theme.palette.background.default_contrastText,
    },
    inlineSubHeader: {
      display: "inline-block",
      marginRight: theme.spacing(4),
    },
    inlineBlock: {
      display: "inline-block",
    },
    block: {
      marginBottom: theme.spacing(4),
    },
    datePicker: {
      marginTop: 0,
      marginLeft: theme.spacing(4),
    },
    photoContainer: {
      paddingRight: theme.spacing(2),
    },
    summaryContainer: {
      paddingLeft: theme.spacing(2),
    },
    inlineOnBigScreens: {
      width: "50%",
      marginTop: theme.spacing(4),
      verticalAlign: "top",
      [theme.breakpoints.down("md")]: {
        width: "100%",
        padding: 0,
      },
    },
    tooltip: {
      fontSize: 16,
    },
    requiredFieldsNotice: {
      display: "block",
      marginBottom: theme.spacing(2),
    },
  };
});

const getHelpTexts = (projectTypeTexts, typeId) => ({
  addPhoto: projectTypeTexts.addPhoto[typeId],
  shortDescription: projectTypeTexts.shortDescription[typeId],
  description: projectTypeTexts.description[typeId],
  collaboration: projectTypeTexts.collaboration[typeId],
});

export default function EnterDetails({
  projectData,
  handleSetProjectData,
  goToNextStep,
  goToPreviousStep,
  setMessage,
  saveAsDraft,
  loadingSubmit,
  loadingSubmitDraft,
}) {
  const [open, setOpen] = useState({
    avatarDialog: false,
  });
  const [errors, setErrors] = useState({
    start_date: "",
    end_date: "",
    location: "",
    max_participants: "",
    registration_end_date: "",
    description_html: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const locationInputRef = useRef(null);
  const [locationOptionsOpen, setLocationOptionsOpen] = useState(false);
  const classes = useStyles(projectData);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: projectData });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const helpTexts = getHelpTexts(projectTypeTexts, projectData.project_type.type_id);
  const topRef = useRef<null | HTMLFormElement>(null);
  const theme = useTheme();

  //scroll to top if there is an error
  useEffect(() => {
    if (topRef?.current && Object.values(errors).some((e) => e)) {
      topRef.current.scrollIntoView();
    }
  }, [errors]);

  // If the user clears the location field after an invalid value,
  // remove stale location errors (empty location is allowed for drafts).
  useEffect(() => {
    if (!projectData.loc || isLocationValid(projectData.loc)) {
      setErrors((prev) => (prev.location ? { ...prev, location: "" } : prev));
      if (!projectData.loc) {
        setMessage("");
      }
    }
  }, [projectData.loc, setMessage]);

  const onClickPreviousStep = () => {
    goToPreviousStep();
  };

  // Validates event registration settings and custom fields.
  // isDraft=false: required fields must be present and valid.
  // isDraft=true:  only validates fields that have a value (skips required checks).
  // Returns true when valid, false and sets inline errors when invalid.
  const validateRegistrationSettings = (project, isDraft = false): boolean => {
    if (!project.registrationEnabled || project.project_type?.type_id !== "event") {
      return true;
    }

    const hasParticipants =
      project.max_participants !== null &&
      project.max_participants !== undefined &&
      project.max_participants !== "";

    if (
      isDraft
        ? hasParticipants && Number(project.max_participants) < 1
        : !project.max_participants || Number(project.max_participants) <= 0
    ) {
      setErrors((prev) => ({
        ...prev,
        max_participants: texts.max_participants_must_be_greater_than_0,
      }));
      return false;
    }

    const hasEndDate = !!project.registration_end_date;

    if (
      isDraft
        ? hasEndDate && !dayjs(project.registration_end_date).isValid()
        : !hasEndDate || !dayjs(project.registration_end_date).isValid()
    ) {
      setErrors((prev) => ({
        ...prev,
        registration_end_date: isDraft
          ? `${texts.invalid_value}: ${texts.registration_end_date}`
          : `${texts.please_fill_out_this_field}: ${texts.registration_end_date}`,
      }));
      return false;
    }

    if (
      project.end_date &&
      hasEndDate &&
      dayjs(project.registration_end_date).isAfter(dayjs(project.end_date))
    ) {
      setErrors((prev) => ({
        ...prev,
        registration_end_date: texts.registration_end_date_must_be_before_event_end_date,
      }));
      return false;
    }

    if (!isDraft) {
      const { errors: fe, hasError } = validateRegistrationFields(
        project.registration_fields,
        false,
        texts.this_field_is_required
      );
      setFieldErrors(fe);
      if (hasError) return false;
    }

    return true;
  };

  // Validate registration fields for draft saves:
  // required fields are skipped, but if a value was entered it must be valid.
  const handleSaveAsDraft = (event) => {
    if (projectData.loc && !isLocationValid(projectData.loc)) {
      setErrors((prev) => ({
        ...prev,
        location: texts.please_choose_one_of_the_location_options,
      }));
      indicateWrongLocation(locationInputRef, setLocationOptionsOpen, setMessage, texts);
      return;
    }
    setErrors((prev) => ({ ...prev, location: "" }));
    if (!validateRegistrationSettings(projectData, true)) return;
    saveAsDraft(event);
  };

  const onClickNextStep = (event) => {
    event.preventDefault();
    if (isProjectDataValid(projectData)) {
      handleSetProjectData({ ...projectData });
      goToNextStep();
    }
  };

  const handleSetOpen = (newOpenObject) => {
    setOpen({ ...open, ...newOpenObject });
  };

  const validation = {
    short_description: {
      name: texts.short_summary,
      maxLength: 280,
    },
    description: {
      name: texts.description,
      maxLength: 4000,
    },
    website: {
      name: projectTypeTexts.website[projectData.project_type.type_id],
      maxLength: 256,
    },
  };

  const onTextChange = (event, descriptionType) => {
    handleSetProjectData({
      [descriptionType]: event.target.value.substring(0, validation[descriptionType].maxLength),
    });
  };

  const isProjectDataValid = (project) => {
    if (!project.image) {
      alert(texts.please_add_an_image);
      return false;
    }
    const projectDatesValid = checkProjectDatesValid(project, texts);
    if (projectDatesValid.error) {
      setErrors({
        ...errors,
        [projectDatesValid.error.key]: projectDatesValid.error.value,
      });
      return false;
    }
    if (!isLocationValid(project.loc)) {
      setErrors((prev) => ({
        ...prev,
        location: texts.please_choose_one_of_the_location_options,
      }));
      indicateWrongLocation(locationInputRef, setLocationOptionsOpen, setMessage, texts);
      return false;
    }
    setErrors((prev) => ({ ...prev, location: "" }));
    // Validate event registration settings when enabled
    if (!validateRegistrationSettings(project)) return false;
    return true;
  };

  const onAllowCollaboratorsChange = (event) => {
    handleSetProjectData({ collaborators_welcome: event.target.checked });
  };

  const backgroundContrastColor = getBackgroundContrastColor(theme);

  return (
    <>
      <Container maxWidth="lg">
        <form ref={topRef} onSubmit={onClickNextStep}>
          <RequiredFieldsNotice className={classes.requiredFieldsNotice} />
          <ProjectNameSection
            projectData={projectData}
            handleSetProjectData={handleSetProjectData}
          />
          <ProjectTimeAndPlaceSectionAndCustomHub
            projectData={projectData}
            handleSetProjectData={handleSetProjectData}
            locationInputRef={locationInputRef}
            locationOptionsOpen={locationOptionsOpen}
            setLocationOptionsOpen={setLocationOptionsOpen}
            errors={errors}
          />
          <div className={classes.block}>
            <AddPhotoSection
              projectData={projectData}
              handleSetProjectData={handleSetProjectData}
              className={`${classes.inlineBlock} ${classes.inlineOnBigScreens} ${classes.photoContainer}`}
              subHeaderClassname={classes.subHeader}
              toolTipClassName={classes.tooltip}
              helpTexts={helpTexts}
              ToolTipIcon={HelpOutlineIcon}
              open={open}
              handleSetOpen={handleSetOpen}
            />
            <AddSummarySection
              projectData={projectData}
              onDescriptionChange={onTextChange}
              className={`${classes.inlineBlock} ${classes.inlineOnBigScreens} ${classes.summaryContainer}`}
              subHeaderClassname={classes.subHeader}
              toolTipClassName={classes.tooltip}
              helpTexts={helpTexts}
              ToolTipIcon={HelpOutlineIcon}
            />
          </div>
          <div className={classes.block}>
            <Typography
              component="h2"
              variant="subtitle2"
              color="primary"
              className={classes.subHeader}
            >
              {texts.project_description}
              <Tooltip title={helpTexts.description} className={classes.tooltip}>
                <IconButton size="large">
                  <HelpOutlineIcon />
                </IconButton>
              </Tooltip>
            </Typography>
            <ProjectDescriptionEditor
              descriptionHtml={projectData.description_html ?? ""}
              onChange={(html) => handleSetProjectData({ description_html: html })}
              error={errors?.description_html}
            />
          </div>
          <div className={classes.block}>
            <Typography
              component="h2"
              variant="subtitle2"
              color="primary"
              className={classes.subHeader}
            >
              {projectTypeTexts.website[projectData.project_type.type_id]}
            </Typography>
            <TextField
              variant="outlined"
              color={backgroundContrastColor}
              onChange={(event) => onTextChange(event, "website")}
              placeholder={projectTypeTexts.website[projectData.project_type.type_id]}
              value={projectData.website}
              helperText={projectTypeTexts.website_helper[projectData.project_type.type_id]}
            />
          </div>
          {projectData.registrationEnabled && projectData.project_type?.type_id === "event" && (
            <div className={classes.block}>
              <EventRegistrationSection
                projectData={projectData}
                handleSetProjectData={handleSetProjectData}
                errors={{
                  max_participants: errors.max_participants,
                  registration_end_date: errors.registration_end_date,
                }}
                fieldErrors={fieldErrors}
                onClearFieldError={(key: string) =>
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  })
                }
              />
            </div>
          )}
          {false && (
            <div className={classes.block}>
              <Typography
                component="h2"
                variant="subtitle2"
                color="primary"
                className={classes.subHeader}
              >
                {projectTypeTexts.allow[projectData.project_type.type_id]}
                <Tooltip title={helpTexts.collaboration} className={classes.tooltip}>
                  <IconButton size="large">
                    <HelpOutlineIcon />
                  </IconButton>
                </Tooltip>
              </Typography>
              <Switch
                checked={projectData.collaborators_welcome}
                onChange={onAllowCollaboratorsChange}
                name="checkedA"
                inputProps={{ "aria-label": "secondary checkbox" }}
                color={backgroundContrastColor}
              />
            </div>
          )}
          {/* The Draft button appears after the project name is filled out */}
          <NavigationButtons
            onClickPreviousStep={onClickPreviousStep}
            nextStepButtonType="submit"
            saveAsDraft={projectData.name ? handleSaveAsDraft : undefined}
            loadingSubmit={loadingSubmit}
            loadingSubmitDraft={loadingSubmitDraft}
            sticky
          />
        </form>
      </Container>
    </>
  );
}

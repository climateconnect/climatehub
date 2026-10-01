import React, { useContext } from "react";
import { Box, Divider, FormControlLabel, Switch, TextField, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { useTheme } from "@mui/material/styles";
import dayjs, { Dayjs } from "dayjs";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import DatePicker from "../general/DatePicker";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";
import { Project, RegistrationField } from "../../types";
import RegistrationFieldList from "./RegistrationFieldList";

const useStyles = makeStyles((theme) => ({
  subHeader: {
    marginBottom: theme.spacing(2),
    fontSize: 20,
    color: theme.palette.background.default_contrastText,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.palette.background.default_contrastText,
  },
  datePicker: {
    marginTop: 0,
    display: "block",
    width: "100%",
  },
}));

type RegistrationErrors = {
  max_participants?: string;
  registration_end_date?: string;
};

type Props = {
  projectData: Project;
  handleSetProjectData: Function;
  errors: RegistrationErrors;
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (_key: string) => void;
};

export default function EventRegistrationSection({
  projectData,
  handleSetProjectData,
  errors,
  fieldErrors,
  onClearFieldError,
}: Props) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });
  const theme = useTheme();
  const backgroundContrastColor = getBackgroundContrastColor(theme);
  const handleMaxParticipantsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    handleSetProjectData({ max_participants: value });
  };

  const handleRegistrationEndDateChange = (value: Dayjs) => {
    handleSetProjectData({ registration_end_date: value });
  };

  const handleNotifyAdminsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSetProjectData({ notify_admins: e.target.checked });
  };

  const handleFieldsChange = (fields: RegistrationField[]) => {
    handleSetProjectData({ registration_fields: fields });
  };

  return (
    <>
      <Typography component="h2" variant="subtitle2" color="primary" className={classes.subHeader}>
        {texts.registration_settings}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: { xs: "wrap", md: "nowrap" }, gap: 2 }}>
        <Box sx={{ width: { xs: "100%", md: 240 } }}>
          <TextField
            variant="outlined"
            color={backgroundContrastColor}
            type="number"
            label={texts.max_participants}
            value={projectData.max_participants ?? ""}
            onChange={handleMaxParticipantsChange}
            inputProps={{ min: 1 }}
            error={!!errors.max_participants}
            helperText={errors.max_participants}
            required
          />
        </Box>
        <Box sx={{ width: { xs: "100%", md: 240 } }}>
          <DatePicker
            required
            className={classes.datePicker}
            label={texts.registration_end_date}
            enableTime={true}
            handleChange={handleRegistrationEndDateChange}
            date={
              projectData.registration_end_date ? dayjs(projectData.registration_end_date) : null
            }
            maxDate={projectData.end_date ? dayjs(projectData.end_date) : undefined}
            error={errors.registration_end_date as any}
          />
        </Box>
      </Box>
      <Box sx={{ width: "100%", mt: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={projectData.notify_admins !== false}
              onChange={handleNotifyAdminsChange}
              color="primary"
              aria-label={texts.notify_admins_on_registration}
            />
          }
          label={texts.notify_admins_on_registration}
        />
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography component="h3" className={classes.sectionHeader} gutterBottom>
        {texts.registration_custom_fields}
      </Typography>
      <RegistrationFieldList
        fields={projectData.registration_fields ?? []}
        onFieldsChange={handleFieldsChange}
        isDraft={projectData.is_draft}
        fieldErrors={fieldErrors}
        onClearFieldError={onClearFieldError}
        eventStartDate={projectData.start_date}
        eventEndDate={projectData.end_date}
      />
    </>
  );
}

import React, { useContext } from "react";
import { getProjectTypeDateOptions } from "../../../public/data/projectTypeOptions";
import dayjs, { Dayjs } from "dayjs";
import DatePicker from "../general/DatePicker";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { styled } from "@mui/material/styles";

const StyledDatePicker = styled(DatePicker)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  display: "block",
  width: "100%",
}));

const DatePickerContainer = styled("div")(({ theme }) => ({
  width: "50%",
  paddingRight: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    paddingRight: 0,
  },
}));

export default function ProjectDateSection({ projectData, handleSetProjectData, errors }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ locale: locale, page: "project" });
  const PROJECT_TYPE_DATE_OPTIONS = getProjectTypeDateOptions(texts);

  type DateChangeProp = "start_date" | "end_date";
  //TODO: Make sure end date is after start date (in both frontend and backend)
  const handleDateChange = (value: Dayjs | any, prop: DateChangeProp) => {
    const noEndDateSet = prop === "start_date" && !isNaN(value?.$d) && !projectData.end_date;
    //This only does a check if we're changing the start date
    const endDateBeforeStartDate =
      prop === "start_date" && projectData.end_date && projectData.end_date < value;
    const shouldAutoSetRegistrationEndDate =
      prop === "start_date" &&
      projectData.registrationEnabled &&
      projectData.project_type.type_id === "event" &&
      !projectData.registration_end_date;
    if (
      PROJECT_TYPE_DATE_OPTIONS[projectData.project_type.type_id].enableEndDate &&
      (noEndDateSet || endDateBeforeStartDate)
    ) {
      const endDateSuggestion = value.add(1, "h");
      handleSetProjectData({
        start_date: value,
        end_date: endDateSuggestion,
        ...(shouldAutoSetRegistrationEndDate && { registration_end_date: value }),
      });
    } else {
      handleSetProjectData({
        [prop || "start_date"]: value,
        ...(shouldAutoSetRegistrationEndDate && { registration_end_date: value }),
      });
    }
  };

  return (
    <>
      {
        //Don't display a date for ideas. We'll assume the person sharing just had the idea
        PROJECT_TYPE_DATE_OPTIONS[projectData.project_type.type_id].enableStartDate && (
          <DatePickerContainer>
            <StyledDatePicker
              label={PROJECT_TYPE_DATE_OPTIONS[projectData.project_type.type_id].startDateLabel}
              enableTime={PROJECT_TYPE_DATE_OPTIONS[projectData.project_type.type_id].enableTime}
              handleChange={(newDate) => handleDateChange(newDate, "start_date")}
              date={projectData.start_date && dayjs(projectData.start_date)}
              error={errors.start_date}
            />
            {PROJECT_TYPE_DATE_OPTIONS[projectData.project_type.type_id].enableEndDate && (
              <StyledDatePicker
                label={PROJECT_TYPE_DATE_OPTIONS[projectData.project_type.type_id].endDateLabel}
                enableTime={PROJECT_TYPE_DATE_OPTIONS[projectData.project_type.type_id].enableTime}
                handleChange={(newDate) => handleDateChange(newDate, "end_date")}
                minDate={dayjs(projectData.start_date) || null}
                date={projectData.end_date && dayjs(projectData.end_date)}
                error={errors.end_date}
              />
            )}
          </DatePickerContainer>
        )
      }
    </>
  );
}

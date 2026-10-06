import React, { useContext } from "react";
import { Project } from "../../types";
import ProjectDateSection from "./ProjectDateSection";
import { styled } from "@mui/material/styles";
import ProjectLocationSearchBar from "./ProjectLocationSearchBar";
import { FormControlLabel, Switch, Typography } from "@mui/material";
import CustomHubSelection from "../project/CustomHubSelection";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const Root = styled("div")(({ theme }) => ({
  [theme.breakpoints.up("md")]: {
    display: "flex",
    justifyContent: "space-between",
  },
}));

const VerticalFlex = styled("div")({
  flexGrow: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "left",
});

const SubHeader = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  fontSize: 20,
  color: theme.palette.background.default_contrastText,
  marginBottom: theme.spacing(1),
}));

type Args = {
  projectData: Project;
  handleSetProjectData: Function;
  locationInputRef: any;
  locationOptionsOpen: boolean;
  setLocationOptionsOpen: Function;
  errors: any;
};

export default function ProjectTimeAndPlaceSectionAndCustomHub({
  projectData,
  handleSetProjectData,
  locationInputRef,
  locationOptionsOpen,
  setLocationOptionsOpen,
  errors,
}: Args) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  function handleUpdateSelectedHub(hubName: string) {
    handleSetProjectData({ hubName: hubName });
  }

  const locationSubHeaderByType = {
    event: texts.event_location_section,
    idea: texts.idea_location,
    project: texts.project_location,
  };

  const onlineLabelByType = {
    event: texts.this_event_takes_place_online,
    idea: texts.this_idea_takes_place_online,
    project: texts.this_project_takes_place_online,
  };

  const typeId = projectData.project_type?.type_id ?? "project";

  return (
    <Root>
      <ProjectDateSection
        projectData={projectData}
        handleSetProjectData={handleSetProjectData}
        errors={errors}
      />
      <VerticalFlex>
        <SubHeader component="h2" variant="subtitle2" color="primary">
          {locationSubHeaderByType[typeId] ?? texts.project_location}
        </SubHeader>
        <FormControlLabel
          control={
            <Switch
              checked={projectData.is_online ?? false}
              onChange={() =>
                handleSetProjectData({ ...projectData, is_online: !projectData.is_online })
              }
              color="primary"
            />
          }
          label={onlineLabelByType[typeId] ?? texts.this_project_takes_place_online}
        />
        <ProjectLocationSearchBar
          projectData={projectData}
          handleSetProjectData={handleSetProjectData}
          helperText={errors?.location || undefined}
          error={!!errors?.location}
          locationInputRef={locationInputRef}
          locationOptionsOpen={locationOptionsOpen}
          handleSetLocationOptionsOpen={setLocationOptionsOpen}
        />
        <CustomHubSelection
          currentHubName={projectData.hubName ?? ""}
          handleUpdateSelectedHub={handleUpdateSelectedHub}
          typeId={typeId}
        />
      </VerticalFlex>
    </Root>
  );
}

import { Container, IconButton } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import React, { useContext } from "react";
import ROLE_TYPES from "../../../public/data/role_types";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import NavigationButtons from "../general/NavigationButtons";
import AutoCompleteSearchBar from "../search/AutoCompleteSearchBar";
import AddProjectMembersContainer from "./AddProjectMembersContainer";
import OrganizersContainer from "./OrganizersContainer";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";
import { styled, useTheme } from "@mui/material/styles";

// Static class names are handed to the child components (which take *ClassName props)
// and styled via descendant selectors from the root.
const SEARCH_BAR_CONTAINER_CLASS = "AddTeam-searchBarContainer";
const SEARCH_BAR_CLASS = "AddTeam-searchBar";
const BLOCK_CLASS = "AddTeam-block";

const Root = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(4),
  [`& .${SEARCH_BAR_CONTAINER_CLASS}`]: {
    marginTop: theme.spacing(4),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 100,
  },
  [`& .${SEARCH_BAR_CLASS}`]: {
    width: 800,
    display: "flex",
  },
  [`& .${BLOCK_CLASS}`]: {
    marginBottom: theme.spacing(4),
  },
}));

export default function AddTeam({
  projectData,
  handleSetProjectData,
  goToPreviousStep,
  goToNextStep,
  availabilityOptions,
  rolesOptions,
  onSubmit,
  saveAsDraft,
  isLastStep,
  loadingSubmit,
  loadingSubmitDraft,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const theme = useTheme();
  const onClickPreviousStep = () => {
    goToPreviousStep();
  };

  const onClickNextStep = () => {
    goToNextStep();
  };

  //Prevent double entries
  const handleAddMember = (member) => {
    handleSetProjectData({
      team_members: [
        ...projectData.team_members,
        {
          ...member,
          role: rolesOptions.find((r) => r.role_type === ROLE_TYPES.read_only_type),
          role_in_project: "",
        },
      ],
    });
  };

  const handleRemoveMember = (member) => {
    handleSetProjectData({
      team_members: projectData.team_members
        .slice(0, projectData.team_members.indexOf(member))
        .concat(
          projectData.team_members.slice(
            projectData.team_members.indexOf(member) + 1,
            projectData.team_members.length
          )
        ),
    });
  };

  //prevent double entries
  const handleAddOrganization = (organization) => {
    handleSetProjectData({
      collaborating_organizations: [...projectData.collaborating_organizations, organization],
    });
  };

  const handleRemoveOrganization = (organization) => {
    handleSetProjectData({
      collaborating_organizations: projectData.collaborating_organizations
        .slice(0, projectData.collaborating_organizations.indexOf(organization))
        .concat(
          projectData.collaborating_organizations.slice(
            projectData.collaborating_organizations.indexOf(organization) + 1,
            projectData.collaborating_organizations.length
          )
        ),
    });
  };

  const renderSearchOption = ({ key, ...props }, option) => {
    return (
      <li key={key} {...props}>
        <IconButton size="large">
          <AddCircleOutlineIcon />
        </IconButton>
        {option.first_name + " " + option.last_name}
      </li>
    );
  };

  const backgroundContrastColor = getBackgroundContrastColor(theme);

  return (
    <Root maxWidth="lg">
      <form onSubmit={isLastStep ? onSubmit : onClickNextStep}>
        <div className={SEARCH_BAR_CONTAINER_CLASS}>
          <AutoCompleteSearchBar
            label={texts.search_for_your_team_members}
            color={backgroundContrastColor}
            className={`${SEARCH_BAR_CLASS} ${BLOCK_CLASS}`}
            baseUrl={process.env.API_URL + "/api/members/?search="}
            clearOnSelect
            freeSolo
            filterOut={[...projectData.team_members]}
            onSelect={handleAddMember}
            renderOption={renderSearchOption}
            getOptionLabel={(option) => option.first_name + " " + option.last_name}
            helperText={texts.type_the_name_of_the_team_member_you_want_to_add_next}
          />
        </div>
        <AddProjectMembersContainer
          projectData={projectData}
          blockClassName={BLOCK_CLASS}
          handleRemoveMember={handleRemoveMember}
          availabilityOptions={availabilityOptions}
          rolesOptions={rolesOptions}
          handleSetProjectData={handleSetProjectData}
        />
        <OrganizersContainer
          projectData={projectData}
          blockClassName={BLOCK_CLASS}
          searchBarClassName={SEARCH_BAR_CLASS}
          searchBarContainerClassName={SEARCH_BAR_CONTAINER_CLASS}
          handleAddOrganization={handleAddOrganization}
          handleRemoveOrganization={handleRemoveOrganization}
        />
        {isLastStep ? (
          <NavigationButtons
            onClickPreviousStep={onClickPreviousStep}
            nextStepButtonType="publish"
            saveAsDraft={saveAsDraft}
            loadingSubmit={loadingSubmit}
            loadingSubmitDraft={loadingSubmitDraft}
            sticky
          />
        ) : (
          <NavigationButtons
            onClickPreviousStep={onClickPreviousStep}
            nextStepButtonType="submit"
            saveAsDraft={projectData.name ? saveAsDraft : undefined}
            loadingSubmit={loadingSubmit}
            loadingSubmitDraft={loadingSubmitDraft}
            sticky
          />
        )}
      </form>
    </Root>
  );
}

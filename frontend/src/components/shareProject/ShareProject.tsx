import { Typography } from "@mui/material";
import React, { useContext, useState } from "react";
import { Project, Organization } from "../../types";
import ProjectTypeSelector from "./ProjectTypeSelector";
import getTexts from "../../../public/texts/texts";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import UserContext from "../context/UserContext";
import Switcher from "../general/Switcher";
import SelectField from "../general/SelectField";
import RequiredFieldsNotice from "../general/RequiredFieldsNotice";
import { styled, useTheme } from "@mui/material/styles";
import NavigationButtons from "../general/NavigationButtons";

// ProjectTypeSelector is still on makeStyles, so the shared "field" spacing is applied
// through a static class + descendant selector from the form root.
const FIELD_CLASS_NAME = "shareProjectField";

const Form = styled("div")(({ theme }) => ({
  maxWidth: 700,
  margin: "0 auto",
  padding: theme.spacing(4),
  paddingTop: theme.spacing(2),
  [`& .${FIELD_CLASS_NAME}`]: {
    marginTop: theme.spacing(3),
  },
}));

const StyledRequiredFieldsNotice = styled(RequiredFieldsNotice)(({ theme }) => ({
  marginTop: theme.spacing(2),
  color: theme.palette.text.secondary,
}));

const OrgBottomLink = styled(Typography)(({ theme }) => ({
  textAlign: "center",
  marginTop: theme.spacing(0.5),
}));

type Args = {
  project: Project;
  handleSetProjectData: Function;
  goToNextStep: Function;
  userOrganizations: Array<Organization>;
  projectTypeOptions: any;
  hubName?: string;
};

export default function Share({
  project,
  handleSetProjectData,
  userOrganizations,
  projectTypeOptions,
  goToNextStep,
  hubName,
}: Args) {
  const organizationOptions = !userOrganizations
    ? []
    : userOrganizations.map((org) => {
        return {
          key: org.url_slug,
          ...org,
        };
      });
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, hubName: hubName });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const theme = useTheme();
  const [organizationError, setOrganizationError] = useState("");

  const onChangeSwitch = () => {
    setOrganizationError("");
    handleSetProjectData({
      is_organization_project: !project.is_organization_project,
      isPersonalProject: !project.isPersonalProject,
      parent_organization: project.is_organization_project ? null : organizationOptions[0] ?? null,
    });
  };
  const onChangeParentOrganization = (e) => {
    const selectedOrg = (userOrganizations ?? []).find((o) => o.name === e.target.value);
    setOrganizationError("");
    handleSetProjectData({
      parent_organization: selectedOrg,
    });
  };

  const onChangeProjectType = (newValue) => {
    handleSetProjectData({ project_type: projectTypeOptions.find((t) => t.type_id === newValue) });
  };

  const onClickNextStep = () => {
    if (project.is_organization_project && !project.parent_organization) {
      setOrganizationError(texts.please_select_an_organization);
      return;
    }
    goToNextStep();
  };

  //This line is specifically for the prio1 hub
  const mainColor =
    theme.palette.background.default_contrastText === theme.palette.secondary.main
      ? "secondary"
      : "primary";

  return (
    <Form>
      <Switcher
        trueLabel={projectTypeTexts.organizations[project.project_type?.type_id]}
        falseLabel={projectTypeTexts.personal[project.project_type?.type_id]}
        value={project.is_organization_project}
        required={false}
        className={FIELD_CLASS_NAME}
        handleChangeValue={onChangeSwitch}
        color={mainColor}
      />
      {project.is_organization_project && <StyledRequiredFieldsNotice variant="body2" />}
      {project.is_organization_project && (
        <>
          {organizationOptions.length === 0 && (
            <Typography color="error" variant="body2" className={FIELD_CLASS_NAME}>
              {texts.you_are_not_a_member_of_any_organization_yet}
            </Typography>
          )}
          <SelectField
            controlled
            controlledValue={project.parent_organization}
            required
            error={!!organizationError}
            helperText={organizationError}
            options={organizationOptions}
            label={texts.organization}
            className={FIELD_CLASS_NAME}
            onChange={onChangeParentOrganization}
          />
          <OrgBottomLink>{texts.if_your_organization_does_not_exist_yet_click_here}</OrgBottomLink>
        </>
      )}
      <ProjectTypeSelector
        className={FIELD_CLASS_NAME}
        value={project.project_type}
        onChange={onChangeProjectType}
        types={projectTypeOptions}
        color={mainColor}
      />
      <NavigationButtons onClickNextStep={onClickNextStep} sticky />
    </Form>
  );
}

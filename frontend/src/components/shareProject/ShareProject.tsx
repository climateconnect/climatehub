import { Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext, useState } from "react";
import { Project, Organization } from "../../types";
import ProjectTypeSelector from "./ProjectTypeSelector";
import getTexts from "../../../public/texts/texts";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import UserContext from "../context/UserContext";
import Switcher from "../general/Switcher";
import SelectField from "../general/SelectField";
import RequiredFieldsNotice from "../general/RequiredFieldsNotice";
import { useTheme } from "@mui/material/styles";
import NavigationButtons from "../general/NavigationButtons";

const useStyles = makeStyles((theme) => ({
  orgBottomLink: {
    textAlign: "center",
    marginTop: theme.spacing(0.5),
  },
  bold: {
    fontWeight: "bold",
  },
  appealText: {
    textAlign: "center",
  },
  appealBox: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  form: {
    maxWidth: 700,
    margin: "0 auto",
    padding: theme.spacing(4),
    paddingTop: theme.spacing(2),
  },
  requiredFieldsNotice: {
    marginTop: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  field: {
    marginTop: theme.spacing(3),
  },
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
  const classes = useStyles();
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
    <div className={classes.form}>
      <Switcher
        trueLabel={projectTypeTexts.organizations[project.project_type?.type_id]}
        falseLabel={projectTypeTexts.personal[project.project_type?.type_id]}
        value={project.is_organization_project}
        required={false}
        className={classes.field}
        handleChangeValue={onChangeSwitch}
        color={mainColor}
      />
      {project.is_organization_project && (
        <RequiredFieldsNotice variant="body2" className={classes.requiredFieldsNotice} />
      )}
      {project.is_organization_project && (
        <>
          {organizationOptions.length === 0 && (
            <Typography color="error" variant="body2" className={classes.field}>
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
            className={classes.field}
            onChange={onChangeParentOrganization}
          />
          <Typography className={classes.orgBottomLink}>
            {texts.if_your_organization_does_not_exist_yet_click_here}
          </Typography>
        </>
      )}
      <ProjectTypeSelector
        className={classes.field}
        value={project.project_type}
        onChange={onChangeProjectType}
        types={projectTypeOptions}
        color={mainColor}
      />
      <NavigationButtons onClickNextStep={onClickNextStep} sticky />
    </div>
  );
}

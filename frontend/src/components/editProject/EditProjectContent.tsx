import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Switch,
  Typography,
  useMediaQuery,
  Theme,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import React, { RefObject, useContext, useState } from "react";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import { apiRequest } from "../../../public/lib/apiOperations";
import Cookies from "universal-cookie";
import ROLE_TYPES from "../../../public/data/role_types";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import SelectField from "../general/SelectField";
import MiniProfilePreview from "../profile/MiniProfilePreview";
import ProjectDescriptionEditor from "./ProjectDescriptionEditor";
import { Project, Role } from "../../types";
import { EditProjectTypeSelector } from "./EditProjectTypeSelector";
import ProjectDateSection from "../shareProject/ProjectDateSection";
import SettingsIcon from "@mui/icons-material/Settings";
import EditEventRegistrationModal from "../project/EditEventRegistrationModal";

const useStyles = makeStyles<Theme>((theme) => ({
  select: {
    maxWidth: 250,
  },
  startDate: {
    marginRight: theme.spacing(4),
    [theme.breakpoints.down("md")]: {
      marginBottom: theme.spacing(2),
    },
  },
  creator: {
    display: "inline-block",
    marginLeft: theme.spacing(2),
  },
  inlineBlock: {
    marginBottom: theme.spacing(2),
    display: "inline-block",
  },
  block: {
    marginBottom: theme.spacing(2),
  },
  subHeader: {
    fontWeight: "bold",
    color: theme.palette.background.default_contrastText,
  },
  skill: {
    display: "flex",
    border: "1px solid black",
    height: theme.spacing(5),
    minWidth: 220,
    maxWidth: "100%",
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    background: "none",
    borderRadius: 0,
    fontSize: 16,
  },
  flexContainer: {
    display: "flex",
    flexDirection: "row",
    padding: 0,
    flexWrap: "wrap",
    marginTop: theme.spacing(2),
  },
  spacer: {
    marginBottom: theme.spacing(1),
  },
  addButton: {
    marginTop: theme.spacing(2),
  },
  buttonsContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  warning: {
    color: theme.palette.error.main,
  },
}));

type Args = {
  project: Project;
  handleSetProject: Function;
  userOrganizations: any;
  user_role: Role;
  errors: any;
  contentRef?: RefObject<any>;
  projectTypeOptions?: any;
  savedIsEventType: boolean;
};

export default function EditProjectContent({
  project,
  handleSetProject,
  userOrganizations,
  user_role,
  errors,
  contentRef,
  projectTypeOptions,
  savedIsEventType,
}: Args) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: project });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const typeId = project.project_type?.type_id ?? "project";
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const [editRegistrationOpen, setEditRegistrationOpen] = useState(false);

  const handleChangeProject = (newValue, key) => {
    handleSetProject({ ...project, [key]: newValue });
  };
  /*
    This is a helper function just for <ProjectDateSection>
    It's a bit of a hack to be able to use the same code even though handleSetProject
    is implemented differently in EditProject and ShareProject
  */
  const handleSetProjectData = (newData) => {
    handleSetProject({
      ...project,
      ...newData,
    });
  };

  const handleSwitchChange = (event) => {
    const nextIsPersonal = !event.target.checked;
    const nextParentOrganization = nextIsPersonal
      ? null
      : project?.project_parents?.parent_organization ?? userOrganizations[0] ?? null;

    handleSetProject({
      ...project,
      project_parents: {
        ...(project?.project_parents ?? {}),
        parent_organization: nextParentOrganization,
      },
      is_personal_project: nextIsPersonal,
    });
  };

  const handleChangeProjectType = (newProjectType) => {
    handleSetProject({
      ...project,
      project_type: newProjectType,
    });
  };

  const handleRegistrationSaved = (updated) => {
    handleSetProject({ ...project, registration_config: updated });
  };
  const isEventType = project.project_type?.type_id === "event";
  const hasRegistrationConfig = !!project.registration_config;
  const registrationEnabled =
    hasRegistrationConfig && project.registration_config?.registration_enabled !== false;
  const isPastEvent = project.end_date ? new Date(project.end_date) < new Date() : false;
  const showEditRegistrationButton =
    user_role.role_type === ROLE_TYPES.all_type && isEventType && registrationEnabled;
  const canToggleRegistration = isEventType && savedIsEventType;

  const [registrationToggleLoading, setRegistrationToggleLoading] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const token = new Cookies().get("auth_token");

  const handleRegistrationToggle = async (checked: boolean) => {
    if (checked) {
      setRegistrationToggleLoading(true);
      try {
        const resp = await apiRequest({
          method: "post",
          url: `/api/projects/${project.url_slug}/registration-config/`,
          payload: {},
          token,
        });
        handleSetProject({ ...project, registration_config: resp.data });
      } catch (error) {
        console.error("Failed to enable registration:", error);
      } finally {
        setRegistrationToggleLoading(false);
      }
    } else {
      const rc = project.registration_config;
      const hasActiveRegistrations =
        rc?.max_participants != null &&
        rc?.available_seats != null &&
        rc.available_seats < rc.max_participants;
      if (hasActiveRegistrations) {
        setConfirmDisableOpen(true);
      } else {
        await doDisableRegistration();
      }
    }
  };

  const doDisableRegistration = async () => {
    setConfirmDisableOpen(false);
    setRegistrationToggleLoading(true);
    try {
      await apiRequest({
        method: "patch",
        url: `/api/projects/${project.url_slug}/registration-config/`,
        payload: { registration_enabled: false },
        token,
      });
      handleSetProject({ ...project, registration_config: null });
    } catch (error) {
      console.error("Failed to disable registration:", error);
    } finally {
      setRegistrationToggleLoading(false);
    }
  };

  return (
    <div ref={contentRef}>
      <div className={classes.block}>
        <div className={classes.block}>
          <Typography component="span">
            {isNarrowScreen ? texts.personal : projectTypeTexts.personal[typeId]}
          </Typography>
          <Switch
            checked={!project.is_personal_project}
            onChange={handleSwitchChange}
            name="checkedA"
            inputProps={{ "aria-label": "secondary checkbox" }}
            color="primary"
          />
          <Typography component="span">{projectTypeTexts.organizations[typeId]}</Typography>
        </div>
        <div className={classes.block}>
          {project.is_personal_project ? (
            <>
              {texts.created_by}
              <MiniProfilePreview
                className={classes.creator}
                profile={project?.project_parents?.parent_user}
                size="small"
              />
            </>
          ) : (
            <SelectField
              controlled
              controlledValue={
                project?.project_parents?.parent_organization
                  ? project?.project_parents?.parent_organization
                  : userOrganizations[0]
              }
              onChange={(event) =>
                handleChangeProject(
                  {
                    ...project.project_parents,
                    parent_organization: userOrganizations.find(
                      (o) => o.name === event.target.value
                    ),
                  },
                  "project_parents"
                )
              }
              options={userOrganizations}
              label={texts.created_by}
              className={classes.select}
              required
            />
          )}
        </div>
        <div className={classes.block}>
          <EditProjectTypeSelector
            project={project}
            projectTypeOptions={projectTypeOptions}
            onChangeProjectType={handleChangeProjectType}
          />
        </div>
        {canToggleRegistration && user_role.role_type === ROLE_TYPES.all_type && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Switch
              checked={registrationEnabled}
              onChange={(e) => handleRegistrationToggle(e.target.checked)}
              disabled={registrationToggleLoading || (isPastEvent && !hasRegistrationConfig)}
              inputProps={{ "aria-label": texts.online_registration }}
            />
            <Typography component="span">{texts.allow_online_registration}</Typography>
            {showEditRegistrationButton && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  ml: "auto",
                }}
              >
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<SettingsIcon />}
                  onClick={() => setEditRegistrationOpen(true)}
                  aria-label={texts.edit_registration_settings}
                >
                  {texts.edit_registration_settings}
                </Button>
                {project.registration_config?.is_draft && (
                  <Typography variant="body2" color="warning.main" sx={{ mt: 0.5 }}>
                    {texts.registration_config_still_draft_warning}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
        <div className={classes.block}>
          <ProjectDateSection
            projectData={project}
            handleSetProjectData={handleSetProjectData}
            errors={errors}
          />
        </div>
        <div className={classes.block}>
          <div className={classes.spacer} />
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {texts.project_description}
          </Typography>
          <ProjectDescriptionEditor
            descriptionHtml={project.description_html ?? ""}
            onChange={(html) => handleChangeProject(html, "description_html")}
            error={errors?.description_html}
          />
          <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
            {texts.describe_your_project_in_detail_please_only_use_english}
          </Typography>
        </div>
      </div>
      {showEditRegistrationButton && editRegistrationOpen && (
        <EditEventRegistrationModal
          open={editRegistrationOpen}
          onClose={() => setEditRegistrationOpen(false)}
          onSaved={handleRegistrationSaved}
          project={project}
          eventRegistration={project.registration_config}
        />
      )}
      <Dialog open={confirmDisableOpen} onClose={() => setConfirmDisableOpen(false)}>
        <DialogTitle>{texts.online_registration}</DialogTitle>
        <DialogContent>
          <Typography>{texts.disable_registration_confirm}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDisableOpen(false)}>{texts.cancel}</Button>
          <Button onClick={doDisableRegistration} color="error" variant="contained">
            {texts.disable_registration}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

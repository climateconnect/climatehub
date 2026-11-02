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
import { styled } from "@mui/material/styles";
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

const Block = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const Spacer = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

const StyledSelectField = styled(SelectField)({
  maxWidth: 250,
});

const CreatorPreview = styled(MiniProfilePreview)(({ theme }) => ({
  display: "inline-block",
  marginLeft: theme.spacing(2),
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
    const organizations = Array.isArray(userOrganizations) ? userOrganizations : [];
    const nextParentOrganization = nextIsPersonal
      ? null
      : project?.project_parents?.parent_organization ?? organizations[0] ?? null;

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
      <Block>
        <Block>
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
        </Block>
        <Block>
          {project.is_personal_project ? (
            <>
              {texts.created_by}
              <CreatorPreview profile={project?.project_parents?.parent_user} size="small" />
            </>
          ) : (
            <>
              {(!Array.isArray(userOrganizations) || userOrganizations.length === 0) && (
                <>
                  <Typography color="error" variant="body2" sx={{ marginBottom: 2 }}>
                    {texts.you_are_not_a_member_of_any_organization_yet}
                  </Typography>
                  <Typography variant="body2" sx={{ marginBottom: 2 }}>
                    {texts.if_your_organization_does_not_exist_yet_click_here}
                  </Typography>
                </>
              )}
              <StyledSelectField
                controlled
                controlledValue={
                  project?.project_parents?.parent_organization
                    ? project?.project_parents?.parent_organization
                    : (userOrganizations ?? [])[0]
                }
                onChange={(event) =>
                  handleChangeProject(
                    {
                      ...project.project_parents,
                      parent_organization: (userOrganizations ?? []).find(
                        (o) => o.name === event.target.value
                      ),
                    },
                    "project_parents"
                  )
                }
                options={userOrganizations ?? []}
                label={texts.created_by}
                error={!!errors?.parent_organization}
                helperText={errors?.parent_organization}
                required
              />
            </>
          )}
        </Block>
        <Block>
          <EditProjectTypeSelector
            project={project}
            projectTypeOptions={projectTypeOptions}
            onChangeProjectType={handleChangeProjectType}
          />
        </Block>
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
        <Block>
          <ProjectDateSection
            projectData={project}
            handleSetProjectData={handleSetProjectData}
            errors={errors}
          />
        </Block>
        <Block>
          <Spacer />
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
        </Block>
      </Block>
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

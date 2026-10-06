import { Avatar, Button, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import React, { useContext, useEffect, useState } from "react";

import ROLE_TYPES from "../../../public/data/role_types";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ConfirmDialog from "../dialogs/ConfirmDialog";
import SelectField from "../general/SelectField";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";
import { useTheme } from "@emotion/react";

const NameText = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(1),
  paddingBottom: 0,
}));

const ProfileAvatar = styled(Avatar)(({ theme }) => ({
  height: theme.spacing(7),
  width: theme.spacing(7),
  margin: "0 auto",
  fontSize: 50,
}));

const fieldStyles = ({ theme }: { theme: Theme }) => ({
  width: theme.spacing(34),
  marginBottom: theme.spacing(1),
});

const PermissionSelectField = styled(SelectField)(fieldStyles);

const RoleTextField = styled(TextField)(fieldStyles);

const HoursSelectField = styled(SelectField)(fieldStyles);

const FieldLabel = styled(Typography)(({ theme }) => ({
  textAlign: "left",
  marginBottom: theme.spacing(0.5),
  color: theme.palette.background.default_contrastText,
}));

const TooltipIcon = styled(HelpOutlineIcon)({
  fontSize: 16,
});

const RemoveButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.error.main,
  color: "white",
  marginTop: theme.spacing(2),
  "&:hover": {
    backgroundColor: theme.palette.error.main,
  },
}));

const DialogText = styled(Typography)({
  textAlign: "center",
}) as typeof Typography;

const CantEditText = styled(Typography)({
  color: "red",
  fontSize: 14,
});

const AppointCreatorButton = styled(Button)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

export default function MiniProfileInput({
  className,
  profile,
  onDelete,
  availabilityOptions,
  rolesOptions,
  onChange,
  hideHoursPerWeek,
  editDisabled,
  isOrganization,
  allowAppointingCreator,
  creatorRole,
  fullRolesOptions,
  dontPickRole,
  typeId,
}: any) {
  const type = typeId || "project";
  const [open, setOpen] = useState(false);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "profile", locale: locale, profile: profile });
  const theme = useTheme();

  useEffect(() => {
    if (
      profile.role.id !== creatorRole.id &&
      options.filter((o) => o.id === creatorRole.id).length > 0
    ) {
      setOptions(
        rolesOptions
          .map((r) => ({ ...r, key: r.id }))
          .filter((r) => r.role_type !== ROLE_TYPES.all_type)
      );
    }
  });

  const [options, setOptions] = useState(
    profile.role.role_type === ROLE_TYPES.all_type
      ? fullRolesOptions.map((r) => ({ ...r, key: r.id }))
      : rolesOptions
          .map((r) => ({ ...r, key: r.id }))
          .filter((r) => r.role_type !== ROLE_TYPES.all_type)
  );

  const handleChangeRolePermissions = (event) => {
    onChange({ ...profile, role: rolesOptions.find((r) => r.name === event.target.value) });
  };

  const handleChangeRoleInProject = (event) => {
    onChange({ ...profile, role_in_project: event.target.value });
  };

  const handleChangeRoleInOrganization = (event) => {
    onChange({ ...profile, role_in_organization: event.target.value });
  };
  const handleChangeAvailability = (event) => {
    onChange({
      ...profile,
      availability: availabilityOptions.find((a) => a.name === event.target.value),
    });
  };
  const handleOpenConfirmCreatorDialog = () => {
    setOpen(true);
  };
  const handleConfirmTransferCreator = (shouldBeTransfered) => {
    setOpen(false);
    if (shouldBeTransfered) {
      setOptions(fullRolesOptions);
      onChange({
        ...profile,
        role: creatorRole,
        changeCreator: true,
      });
    }
  };

  const backgroundContrastColor = getBackgroundContrastColor(theme);

  return (
    <div className={className}>
      <ProfileAvatar
        alt={profile.name}
        /*TODO(unused) size="large" */
        src={getImageUrl(profile.image)}
      />
      <NameText variant="h6">{profile.first_name + " " + profile.last_name}</NameText>
      <FieldLabel>
        {texts.permissions}
        <Tooltip title={texts.choose_what_permissions_the_user_should_have}>
          <IconButton size="large">
            <TooltipIcon />
          </IconButton>
        </Tooltip>
      </FieldLabel>
      <PermissionSelectField
        label={texts.pick_users_permissions}
        color={backgroundContrastColor}
        size="small"
        disabled={
          profile.edited && profile.role.role_type !== ROLE_TYPES.all_type
            ? false
            : editDisabled || profile.role.role_type === ROLE_TYPES.all_type
        }
        options={options}
        controlledValue={profile.role}
        controlled
        required
        onChange={handleChangeRolePermissions}
      />
      {allowAppointingCreator && (
        <AppointCreatorButton onClick={handleOpenConfirmCreatorDialog}>
          {texts.make_this_user_the_creator}
        </AppointCreatorButton>
      )}
      {!dontPickRole && (
        <>
          <FieldLabel>
            {isOrganization
              ? texts.role_in_organization
              : type === "idea"
              ? texts.role_in_idea
              : type === "event"
              ? texts.role_in_event
              : texts.role_in_project}
            <Tooltip
              title={
                isOrganization
                  ? texts.pick_or_describe_role_in_organization
                  : type === "idea"
                  ? texts.pick_or_describe_role_in_idea
                  : type === "event"
                  ? texts.pick_or_describe_role_in_event
                  : texts.pick_or_describe_role_in_project
              }
            >
              <IconButton size="large">
                <TooltipIcon />
              </IconButton>
            </Tooltip>
          </FieldLabel>
          <RoleTextField
            size="small"
            color={backgroundContrastColor}
            variant="outlined"
            label={texts.pick_or_type_users_role}
            onChange={isOrganization ? handleChangeRoleInOrganization : handleChangeRoleInProject}
            value={isOrganization ? profile.role_in_organization : profile.role_in_project}
            disabled={profile.added ? false : editDisabled}
          />
        </>
      )}
      {!hideHoursPerWeek && (
        <>
          <FieldLabel>
            {texts.hours_contributed_per_week}
            <Tooltip
              title={
                isOrganization
                  ? texts.pick_how_many_hours_user_contributes_to_org
                  : texts.pick_how_many_hours_user_contributes_to_project
              }
            >
              <IconButton size="large">
                <TooltipIcon />
              </IconButton>
            </Tooltip>
          </FieldLabel>
          <HoursSelectField
            label={texts.hours}
            size="small"
            options={availabilityOptions}
            onChange={handleChangeAvailability}
            defaultValue={profile.availability}
            color={backgroundContrastColor}
          />
        </>
      )}
      {editDisabled && !profile.added && (
        <CantEditText color="secondary">{texts.cant_edit_or_remove_member}</CantEditText>
      )}
      {onDelete && (
        <RemoveButton variant="contained" startIcon={<DeleteIcon />} onClick={onDelete}>
          {texts.remove}
        </RemoveButton>
      )}
      <ConfirmDialog
        open={open}
        onClose={handleConfirmTransferCreator}
        title={texts.do_you_really_want_to_lose_creators_permissions}
        text={
          <DialogText component="div">
            {isOrganization
              ? texts.there_is_always_one_org_member_with_creator_privileges
              : texts.there_is_always_one_project_member_with_creator_privileges}
            <br />
            {texts.creator_can_add_remove_and_edit_admins}
            <br />
            <p>
              <Typography component="span" color="error">
                {texts.if_you_make_person_admin_you_will_lose_privileges}
              </Typography>
            </p>
            {texts.do_you_really_want_to_do_this}
          </DialogText>
        }
        cancelText={texts.no}
        confirmText={texts.yes}
      />
    </div>
  );
}

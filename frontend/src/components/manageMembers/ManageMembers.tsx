import { IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import React, { useContext } from "react";
import ROLE_TYPES from "../../../public/data/role_types";
import { getRoleWeight } from "../../../public/lib/manageMembers";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import MiniProfileInput from "../profile/MiniProfileInput";
import AutoCompleteSearchBar from "../search/AutoCompleteSearchBar";

const SearchBarContainer = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(4),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexGrow: 100,
}));

const StyledAutoCompleteSearchBar = styled(AutoCompleteSearchBar)(({ theme }) => ({
  width: 800,
  display: "flex",
  marginBottom: theme.spacing(4),
}));

const MembersWrapper = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  marginBottom: theme.spacing(2),
}));

const StyledMiniProfileInput = styled(MiniProfileInput)(({ theme }) => ({
  width: theme.spacing(34),
  textAlign: "center",
  marginRight: theme.spacing(4),
  marginTop: theme.spacing(2),
}));

export default function ManageMembers({
  currentMembers,
  rolesOptions,
  setCurrentMembers,
  setUserRole,
  setMembersAndUserRoleAtomically,
  availabilityOptions,
  user,
  canEdit,
  user_role,
  role_property_name,
  hideHoursPerWeek,
  isOrganization,
  label,
  dontPickRole,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "organization", locale: locale });
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

  const handleAddMember = (member) => {
    setCurrentMembers([
      ...currentMembers,
      {
        ...member,
        role: rolesOptions.find((r) => r.role_type === ROLE_TYPES.read_only_type),
        [role_property_name]: "",
        edited: true,
      },
    ]);
  };
  const handleChangeMember = (m) => {
    if (m.changeCreator) {
      handleCreatorChange(m);
    } else {
      if (m.id === user.id) {
        setCurrentMembers(
          [
            ...currentMembers.map((c) => {
              if (c.url_slug === m.url_slug) return m;
              else return c;
            }),
          ],
          m.role
        );
      }
      setCurrentMembers([
        ...currentMembers.map((c) => {
          if (c.url_slug === m.url_slug) return m;
          else return c;
        }),
      ]);
    }
  };

  const handleCreatorChange = (m) => {
    if (setMembersAndUserRoleAtomically) {
      setCurrentMembers(
        [
          ...currentMembers.map((c) => {
            if (c.url_slug === m.url_slug) return { ...m, edited: true };
            else if (c.id === user.id)
              return {
                ...c,
                role: rolesOptions.find((r) => r.role_type === ROLE_TYPES.read_write_type),
                edited: true,
              };
            else return c;
          }),
        ],
        rolesOptions.find((r) => r.role_type === ROLE_TYPES.read_write_type)
      );
    } else {
      setCurrentMembers([
        ...currentMembers.map((c) => {
          if (c.url_slug === m.url_slug) return { ...m, edited: true };
          else if (c.id === user.id)
            return {
              ...c,
              role: rolesOptions.find((r) => r.role_type === ROLE_TYPES.read_write_type),
              edited: true,
            };
          else return c;
        }),
      ]);
      setUserRole(rolesOptions.find((r) => r.role_type === ROLE_TYPES.read_write_type));
    }
  };

  const handleRemoveMember = (member) => {
    setCurrentMembers([...currentMembers.filter((m) => m.id !== member.id)]);
  };

  return (
    <div>
      <SearchBarContainer>
        <StyledAutoCompleteSearchBar
          label={label ? label : texts.search_for_your_organizations_members}
          baseUrl={process.env.API_URL + "/api/members/?search="}
          clearOnSelect
          freeSolo
          filterOut={[...currentMembers]}
          onSelect={handleAddMember}
          color="contrast"
          renderOption={renderSearchOption}
          getOptionLabel={(option) => option.first_name + " " + option.last_name}
          helperText={texts.type_name_of_next_team_member}
        />
      </SearchBarContainer>
      {currentMembers && currentMembers.length > 0 && (
        <MemberContainer
          currentMembers={currentMembers}
          rolesOptions={rolesOptions}
          user_role={user_role}
          user={user}
          canEdit={canEdit}
          handleRemoveMember={handleRemoveMember}
          handleChangeMember={handleChangeMember}
          availabilityOptions={availabilityOptions}
          hideHoursPerWeek={hideHoursPerWeek}
          isOrganization={isOrganization}
          dontPickRole={dontPickRole}
        />
      )}
    </div>
  );
}

const MemberContainer = ({
  currentMembers,
  rolesOptions,
  user_role,
  user,
  canEdit,
  handleRemoveMember,
  handleChangeMember,
  availabilityOptions,
  hideHoursPerWeek,
  isOrganization,
  dontPickRole,
}) => {
  return (
    <MembersWrapper>
      {currentMembers.map((m, index) => {
        const creatorRole = rolesOptions.find((r) => r.role_type === ROLE_TYPES.all_type);
        const profile = m.id === user.id ? { ...m, role: user_role } : m;
        return (
          <StyledMiniProfileInput
            key={index}
            profile={profile}
            onDelete={
              canEdit(m) && m.role.role_type !== ROLE_TYPES.all_type
                ? () => handleRemoveMember(m)
                : null
            }
            availabilityOptions={availabilityOptions}
            rolesOptions={
              !canEdit(m) || m.id === user.id
                ? rolesOptions
                : rolesOptions.filter(
                    (r) => getRoleWeight(r.role_type) < getRoleWeight(user_role.role_type)
                  )
            }
            fullRolesOptions={rolesOptions}
            creatorRole={creatorRole}
            onChange={handleChangeMember}
            hideHoursPerWeek={hideHoursPerWeek}
            editDisabled={!canEdit(m)}
            isOrganization={isOrganization}
            allowAppointingCreator={m.id !== user.id && user_role.role_type === ROLE_TYPES.all_type}
            dontPickRole={dontPickRole}
          />
        );
      })}
    </MembersWrapper>
  );
};

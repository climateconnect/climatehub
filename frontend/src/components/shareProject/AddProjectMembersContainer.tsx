import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import React, { useContext } from "react";
import ROLE_TYPES from "../../../public/data/role_types";
import getTexts from "../../../public/texts/texts";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import UserContext from "../context/UserContext";
import MiniProfileInput from "../profile/MiniProfileInput";

const MemberContainer = styled("div")({
  display: "flex",
  flexWrap: "wrap",
});

const Member = styled(MiniProfileInput)(({ theme }) => ({
  width: theme.spacing(40),
  textAlign: "center",
  marginRight: theme.spacing(4),
  marginTop: theme.spacing(2),
}));

const Info = styled(Typography)(({ theme }) => ({
  textAlign: "center",
  fontWeight: "bold",
  marginBottom: theme.spacing(2),
}));

const InfoIcon = styled(InfoOutlinedIcon)({
  marginBottom: -6,
});

export default function AddProjectMembersContainer({
  projectData,
  blockClassName,
  handleRemoveMember,
  availabilityOptions,
  rolesOptions,
  handleSetProjectData,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const typeId = projectData.project_type?.type_id ?? "project";

  const handleChangeMember = (m) => {
    handleSetProjectData({
      ...projectData,
      team_members: [
        ...projectData.team_members.map((t) => {
          if (t.url_slug === m.url_slug) return m;
          else return t;
        }),
      ],
    });
  };
  return (
    <div className={blockClassName}>
      <Info>
        <InfoIcon /> {projectTypeTexts.searchMembers[typeId]}
      </Info>
      <MemberContainer>
        {projectData.team_members.map((m, index) => {
          if (m)
            return (
              <Member
                key={index}
                profile={m}
                onDelete={m.role.role_type !== ROLE_TYPES.all_type && (() => handleRemoveMember(m))}
                availabilityOptions={availabilityOptions}
                rolesOptions={rolesOptions}
                onChange={handleChangeMember}
                creatorRole={rolesOptions.find((r) => r.role_type === ROLE_TYPES.all_type)}
                fullRolesOptions={rolesOptions}
                typeId={typeId}
              />
            );
        })}
      </MemberContainer>
    </div>
  );
}

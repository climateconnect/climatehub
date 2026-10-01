import { IconButton, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import MiniOrganizationPreview from "../organization/MiniOrganizationPreview";
import AutoCompleteSearchBar from "../search/AutoCompleteSearchBar";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";
import { useTheme } from "@mui/material/styles";

const useStyles = makeStyles((theme) => {
  return {
    header: {
      marginBottom: theme.spacing(2),
      fontSize: 20,
      color: theme.palette.background.default_contrastText,
    },
    info: {
      textAlign: "center",
      fontWeight: "bold",
      marginBottom: theme.spacing(2),
    },
    infoIcon: {
      marginBottom: -6,
    },
  };
});

export default function OrganizersContainer({
  projectData,
  blockClassName,
  searchBarClassName,
  searchBarContainerClassName,
  handleAddOrganization,
  handleRemoveOrganization,
}) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale, project: projectData });
  const theme = useTheme();

  const renderSearchOption = ({ key, ...props }, option) => {
    return (
      <li key={key} {...props}>
        <IconButton size="large">
          <AddCircleOutlineIcon />
        </IconButton>
        {option.name}
      </li>
    );
  };

  const allInvolvedOrgs = projectData.parent_organization
    ? [...projectData.collaborating_organizations, projectData.parent_organization]
    : [...projectData.collaborating_organizations];

  const backgroundContrastColor = getBackgroundContrastColor(theme);

  return (
    <div>
      <div className={blockClassName}>
        <div className={searchBarContainerClassName}>
          <AutoCompleteSearchBar
            label={texts.search_for_collaborating_organizations}
            className={`${searchBarClassName} ${blockClassName}`}
            baseUrl={process.env.API_URL + "/api/organizations/?search="}
            color={backgroundContrastColor}
            clearOnSelect
            freeSolo
            onSelect={handleAddOrganization}
            renderOption={renderSearchOption}
            getOptionLabel={(option) => option.name}
            filterOut={allInvolvedOrgs}
            helperText={texts.type_the_name_of_the_collaborating_organization_you_want_to_add_next}
          />
        </div>
        <div className={blockClassName}>
          <Typography className={classes.info}>
            <InfoOutlinedIcon className={classes.infoIcon} />
            {texts.use_the_search_bar_to_add_collaborating_organizations}
          </Typography>
          {projectData.isPersonalProject ? (
            <Typography component="h2" variant="subtitle2" className={classes.header}>
              {texts.personal_project}
            </Typography>
          ) : (
            <>
              <Typography component="h2" variant="subtitle2" className={classes.header}>
                {texts.responsible_organization}
              </Typography>
              <MiniOrganizationPreview
                organization={projectData.parent_organization}
                /*TODO(unused) type="parentOrganization" */
              />
            </>
          )}
        </div>
        {projectData.collaborating_organizations.length > 0 && (
          <div>
            <Typography component="h2" variant="subtitle2" className={classes.header}>
              {texts.collaborating_organizations}
            </Typography>
            {projectData.collaborating_organizations.map((o, index) => (
              <MiniOrganizationPreview
                key={index}
                organization={o}
                /*TODO(unused) type="parentOrganization" */
                onDelete={handleRemoveOrganization}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

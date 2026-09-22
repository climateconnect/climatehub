import makeStyles from "@mui/styles/makeStyles";
import Alert from "@mui/material/Alert";
import { useRouter } from "next/router";
import React, { useContext } from "react";
import { appHref } from "../../../public/lib/appLink";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import getOrganizationInfoMetadata from "./../../../public/data/organization_info_metadata";
import EditAccountPage from "./../account/EditAccountPage";

const useStyles = makeStyles(() => {
  return {
    alert: {
      textAlign: "center",
      maxWidth: 1280,
      margin: "0 auto",
    },
  };
});

const parseOrganizationInfo = (info, organization_info_metadata): any => {
  const ret = { info: {} };
  Object.keys(info).map((key) => {
    if (organization_info_metadata[key]) ret.info[key] = info[key];
    else ret[key] = info[key];
  });
  return ret;
};

export default function EnterDetailledOrganizationInfo({
  errorMessage,
  existingName,
  existingUrlSlug,
  organizationInfo,
  handleSubmit,
  tagOptions,
  locationInputRef,
  locationOptionsOpen,
  handleSetLocationOptionsOpen,
  loadingSubmit,
  allSectors,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "organization", locale: locale });
  const organization_info_metadata = getOrganizationInfoMetadata(locale, organizationInfo, true);
  const organization = parseOrganizationInfo(organizationInfo, organization_info_metadata);
  const infoMetadata = {
    ...organization_info_metadata,
    location: {
      ...organization_info_metadata.location,
      locationOptionsOpen: locationOptionsOpen,
      setLocationOptionsOpen: handleSetLocationOptionsOpen,
      locationInputRef: locationInputRef,
    },
  };
  const classes = useStyles();
  const router = useRouter();
  const handleCancel = () => {
    router.push("/organizations");
  };
  return (
    <div>
      {!errorMessage && (
        <div>
          <Alert severity="success" className={classes.alert}>
            {texts.almost_done_here_you_can_customize_your_organization_page_and_add_details}
          </Alert>
        </div>
      )}
      <EditAccountPage
        type="organization"
        account={organization}
        possibleAccountTypes={[...tagOptions]}
        infoMetadata={infoMetadata}
        maxAccountTypes={2}
        accountHref={appHref("/organizations/" + organization.url_slug, { locale })}
        handleSubmit={handleSubmit}
        submitMessage={texts.create}
        handleCancel={handleCancel}
        errorMessage={errorMessage}
        existingName={existingName}
        existingUrlSlug={existingUrlSlug}
        loadingSubmit={loadingSubmit}
        allSectors={allSectors}
      />
    </div>
  );
}

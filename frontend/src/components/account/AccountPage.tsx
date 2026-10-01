import { Button, Chip, Container, Divider, Link, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import PlaceIcon from "@mui/icons-material/Place";
import React, { Fragment, useContext, useEffect, useState } from "react";
import Linkify from "react-linkify";
import Cookies from "universal-cookie";
import FeedbackContext from "../context/FeedbackContext";
import { apiRequest, getLocalePrefix } from "../../../public/lib/apiOperations";
import DetailledDescription from "./DetailledDescription";
import getTexts from "../../../public/texts/texts";
import MessageContent from "../communication/MessageContent";
import SectorsPreview from "../hub/SectorsPreview";
import MiniOrganizationPreview from "../organization/MiniOrganizationPreview";
import ProfileBadge from "../profile/ProfileBadge";
import SocialMediaShareButton from "../shareContent/SocialMediaShareButton";
import UserContext from "../context/UserContext";
import EditSharpIcon from "@mui/icons-material/EditSharp";
import IconButton from "@mui/material/IconButton";

import ConfirmDialog from "../dialogs/ConfirmDialog";
import FollowersDialog from "../dialogs/FollowersDialog";
import { useLongPress } from "use-long-press";
import { getParams } from "../../../public/lib/generalOperations";
import FollowButton from "../general/FollowButton";
import { NOTIFICATION_TYPES } from "../communication/notifications/Notification";

import SelectWithText from "./SelectWithText";
import SubTitleWithContent from "../general/SubTitleWithContent";
import { UserAvatar } from "./UserAvatar";

const noTransient = (prop: PropertyKey) => !(typeof prop === "string" && prop.startsWith("$"));

const AvatarContainer = styled("div")(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    marginRight: theme.spacing(5),
    marginLeft: theme.spacing(5),
  },
  marginTop: theme.spacing(-11),
  marginBottom: theme.spacing(2),
  display: "inline-block",
}));

const AvatarWithInfo = styled(Container)(({ theme }) => ({
  textAlign: "center",
  width: theme.spacing(40),
  margin: "0 auto",
  [theme.breakpoints.up("sm")]: {
    margin: 0,
    marginLeft: theme.spacing(-5),
    display: "inline-block",
    width: "auto",
  },
}));

const AccountInfo = styled(Container, {
  shouldForwardProp: noTransient,
})<{ $isOwnAccount?: boolean }>(({ theme, $isOwnAccount }) => ({
  padding: 0,
  marginTop: theme.spacing(1),
  marginRight: $isOwnAccount ? theme.spacing(0.5) : 0,
}));

const EditButtonWrapper = styled("div")({
  flex: "1 0 auto",
});

const Name = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  padding: theme.spacing(1),
  paddingLeft: 0,
  paddingRight: 0,
  wordBreak: "break-word",
}));

const Subtitle = styled("div")({
  fontWeight: "bold",
  wordBreak: "break-word",
});

// subtitle + subOrgContainer
const ParentOrganizationContainer = styled("div")({
  fontWeight: "bold",
  wordBreak: "break-word",
  display: "flex",
  alignItems: "center",
});

const Content = styled("div")(({ theme }) => ({
  paddingBottom: theme.spacing(2),
  // color: `${theme.palette.secondary.main}`,
  fontSize: 16,
  wordBreak: "break-word",
}));

const NoPaddingContainer = styled(Container)({
  padding: 0,
});

const InfoContainer = styled(Container)(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    display: "flex",
    alignItems: "center",
  },
  position: "relative",
}));

const MarginTopDivider = styled(Divider)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const MarginBottom = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(1),
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  marginRight: theme.spacing(1),
}));

const EditButton = styled(IconButton)(({ theme }) => ({
  position: "relative",
  cursor: "pointer",
  color: theme.palette.background.default_contrastText,
  width: "35px",
  height: "35px",
  marginRight: theme.spacing(0.5),
  backgroundColor: "white",
  "&:hover": {
    backgroundColor: "white",
  },
  borderRadius: "50%",
  padding: "5px",
  left: "0",
}));

const InfoIcon = styled(PlaceIcon)(({ theme }) => ({
  marginBottom: -4,
  color: theme.palette.background.default_contrastText,
}));

const InnerIcon = styled(EditSharpIcon)(({ theme }) => ({
  marginRight: theme.spacing(0.5),
  marginLeft: -theme.spacing(1),
}));

const StyledDetailledDescription = styled(DetailledDescription)(({ theme }) => ({
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

const StyledShareButton = styled(SocialMediaShareButton)({
  position: "relative",
  right: "0",
});

const SmallIconContainer = styled("div")(({ theme }) => ({
  position: "absolute",
  width: "auto",
  display: "flex",
  justifyContent: "space-between",
  marginRight: theme.spacing(2),
  marginBottom: theme.spacing(2),
  right: "0%",
  bottom: "0%",
}));

const IsSubOrgText = styled(Typography)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

const StyledMiniOrganizationPreview = styled(MiniOrganizationPreview)({
  display: "flex",
});

//Generic component to display personal profiles or organization profiles
export default function AccountPage({
  account,
  default_background,
  editHref,
  //object with properties that can be changed and their types (e.g. "summary" is a "text" type)
  //  E.g. for organizations this is generated by the function in public/data/organization_info_metadata.js
  infoMetadata,
  children,
  isOwnAccount,
  isOrganization,
  editText,
  isSmallScreen,
  numberOfFollowers,
  handleFollow,
  followingChangePending,
  isUserFollowing,
  hubUrl,
}) {
  const { locale, user } = useContext(UserContext);
  const token = new Cookies().get("auth_token");
  const texts = getTexts({ page: "profile", locale: locale });
  const organizationTexts = isOrganization
    ? getTexts({ page: "organization", organization: account, locale: locale })
    : { not_an_organization: "Not an organization" };

  const componentDecorator = (href, text, key) => (
    <Link
      color="primary"
      underline="always"
      href={href}
      key={key}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text}
    </Link>
  );

  // Following codeblock handles follow button for organizations
  const [confirmDialogOpen, setConfirmDialogOpen] = useState({
    follow: false,
  });

  const onFollowDialogClose = (confirmed) => {
    if (confirmed) toggleFollowOrganization();
    setConfirmDialogOpen({ ...confirmDialogOpen, follow: false });
  };

  const { showFeedbackMessage } = useContext(FeedbackContext);

  const handleToggleFollowOrganization = () => {
    if (!token)
      showFeedbackMessage({
        message: <span>{organizationTexts.please_log_in_to_follow_an_organization}</span>,
        error: true,
        promptLogIn: true,
      });
    else if (isUserFollowing) setConfirmDialogOpen({ ...confirmDialogOpen, follow: true });
    else toggleFollowOrganization();
  };

  const toggleFollowOrganization = () => {
    handleFollow(isUserFollowing, false, true);
    apiRequest({
      method: "post",
      url: "/api/organizations/" + account.url_slug + "/set_follow/",
      payload: { following: !isUserFollowing },
      token: token,
      locale: locale,
    })
      .then(function (response) {
        handleFollow(response.data.following, true, false);
        updateFollowers();
        showFeedbackMessage({
          message: response.data.message,
        });
      })
      .catch(function (error) {
        console.log(error);
        if (error && error.reponse) console.log(error.response);
      });
  };

  const handleReadNotifications = async (notificationType) => {
    if (!notifications || notifications.length === 0) return;
    const notification_to_set_read = notifications.filter(
      (n) =>
        n.notification_type === notificationType && n.organization.url_slug === account.url_slug
    );
    await setNotificationsRead(token, notification_to_set_read, locale);
    await refreshNotifications();
  };

  const { notifications, setNotificationsRead, refreshNotifications } = useContext(UserContext);

  const [initiallyCaughtFollowers, setInitiallyCaughtFollowers] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);

  const toggleShowFollowers = async () => {
    setShowFollowers(!showFollowers);
    if (!initiallyCaughtFollowers) {
      await updateFollowers();
      handleReadNotifications(NOTIFICATION_TYPES.indexOf("organization_follower"));
      setInitiallyCaughtFollowers(true);
    }
  };
  const updateFollowers = async () => {
    const retrievedFollowers = await getFollowers(account, token, locale);
    setFollowers(retrievedFollowers);
  };

  const [gotParams, setGotParams] = useState(false);
  useEffect(() => {
    if (!gotParams) {
      const params = getParams(window.location.href);
      if (params.show_followers && !showFollowers) toggleShowFollowers();
      setGotParams(true);
    }
  });

  const bindFollow = useLongPress(() => {
    toggleShowFollowers();
  }); // end of follow organizations codeblock

  const renderParentOrganization = (value: any, index: number) => {
    if (!value.name) return null;
    return (
      <ParentOrganizationContainer key={index}>
        <IsSubOrgText>
          {account.name} {texts.is_a_suborganization_of}{" "}
        </IsSubOrgText>
        <StyledMiniOrganizationPreview organization={value} size="tiny" />
      </ParentOrganizationContainer>
    );
  };

  const renderChildOrganizations = (infoItem: any, index: number) => {
    if (!Array.isArray(infoItem.value) || infoItem.value.length === 0) return null;

    const subOrgLabel =
      infoItem.value.length === 1 ? texts.suborganization_of : texts.suborganizations_of;

    return (
      <Subtitle key={index}>
        <IsSubOrgText>
          {subOrgLabel} {account.name}:
        </IsSubOrgText>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "left" }}>
          {infoItem.value.map((org, orgIndex) => (
            <Fragment key={org.id}>
              {orgIndex > 0 && <span style={{ flexShrink: 0 }}>,</span>}
              <div style={{ flexShrink: 0 }}>
                <StyledMiniOrganizationPreview organization={org} size="tiny" />
              </div>
            </Fragment>
          ))}
        </div>
      </Subtitle>
    );
  };

  const displayAccountInfo = (info) =>
    Object.keys(info)
      .sort((a, b) => {
        a = getFullInfoElement(infoMetadata, a, info[a]);
        b = getFullInfoElement(infoMetadata, b, info[b]);
        return b?.weight - a?.weight;
      })
      .map((key, index) => {
        if (!info[key]) return null;

        const infoElement = getFullInfoElement(infoMetadata, key, info[key]);
        const value = Array.isArray(infoElement.value)
          ? infoElement.value.join(", ")
          : infoElement.value;
        const additionalText = infoElement.additionalText ? infoElement.additionalText : "";
        if (key === "parent_organization") {
          return renderParentOrganization(value, index);
        }
        if (key === "child_organizations") {
          return renderChildOrganizations(infoElement, index);
        }
        if (infoElement.type === "selectwithtext" && value) {
          return <SelectWithText types={account.types} info={infoElement} key={index} />;
        }
        if (infoElement.type === "array" && infoElement?.value?.length > 0) {
          return (
            <div key={index}>
              <Subtitle>{infoElement.name}:</Subtitle>
              <MarginBottom>
                {infoElement && infoElement.value && infoElement.value.length > 0
                  ? infoElement.value.map((entry) => (
                      <StyledChip size="medium" color="secondary" label={entry} key={entry} />
                    ))
                  : infoElement.missingMessage && <Content>{infoElement.missingMessage}</Content>}
              </MarginBottom>
            </div>
          );
        }

        if (infoElement.linkify && value) {
          return (
            <Fragment key={index}>
              <Subtitle>{infoElement.name}:</Subtitle>
              <Linkify componentDecorator={componentDecorator}>
                <Content>{value}</Content>
              </Linkify>
            </Fragment>
          );
        }

        if (infoElement.type === "bio" && value) {
          return (
            <Content key={index}>
              <MessageContent
                content={value ? value + additionalText : infoElement.missingMessage}
              />
            </Content>
          );
        }

        if (infoElement.type === "sectors") {
          return (
            <Fragment key={index}>
              {infoElement.value.length > 0 && <Subtitle>{infoElement.name}:</Subtitle>}

              <SectorsPreview sectors={infoElement.value} />
            </Fragment>
          );
        }

        if (infoElement.type === "select" && value) {
          const textValue = infoElement.options
            ? infoElement.options.find((o) => o?.key === value).name
            : value;
          return (
            <div key={index}>
              <SubTitleWithContent
                subtitle={infoElement.name + ":"}
                content={textValue ? textValue + additionalText : infoElement.missingMessage}
              />
            </div>
          );
        }

        if (
          value &&
          !["detailled_description", "location", "checkbox"].includes(infoElement.type) &&
          !isOrganization
        ) {
          return (
            <div key={index}>
              <SubTitleWithContent
                subtitle={infoElement.name + ":"}
                content={value ? value + additionalText : infoElement.missingMessage}
              />
            </div>
          );
        }
      });
  const getDetailedDescription = () => {
    const detailled_description_obj = Object.keys(account.info).filter((i) => {
      const el = getFullInfoElement(infoMetadata, i, account.info[i]);
      return el.type === "detailled_description";
    });
    if (detailled_description_obj.length > 0) {
      const key = detailled_description_obj[0];
      return getFullInfoElement(infoMetadata, key, account.info[key]);
    } else return null;
  };
  const detailedDescription = getDetailedDescription();
  const locationKeys = Object.keys(account.info).filter((key) => {
    const infoElement = getFullInfoElement(infoMetadata, key, account.info[key]);
    return infoElement.type === "location";
  });
  const location = locationKeys.length > 0 ? account.info[locationKeys[0]] : null;
  const locationAdditionalText = location?.additionalText ? location.additionalText : "";

  return (
    <NoPaddingContainer maxWidth="lg">
      <div
        style={{
          background: `url(${
            account.background_image ? account.background_image : default_background
          })`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          width: "100%",
          height: 305,
          position: "relative",
        }}
      >
        <SmallIconContainer>
          {isOwnAccount && isSmallScreen && (
            <EditButton href={editHref} size="large">
              <EditSharpIcon />
            </EditButton>
          )}
          {isOrganization && (
            <StyledShareButton
              contentLinkPath={`${getLocalePrefix(locale)}/organizations/${account.url_slug}`}
              apiEndpoint={`/api/organizations/${account.url_slug}/set_shared_organization/`}
              messageTitle={`${organizationTexts.climate_protection_organization}${account.name}`}
              mailBody={organizationTexts.share_organization_email_body}
              texts={texts}
              dialogTitle={organizationTexts.tell_others_about_this_organization}
              switchColors={true}
              hubUrl={hubUrl}
            />
          )}
        </SmallIconContainer>
      </div>
      <InfoContainer>
        <AvatarWithInfo>
          <AvatarContainer>
            {account.badges?.length > 0 ? (
              <ProfileBadge badge={account.badges[0]}>
                <UserAvatar mode={"read"} imageUrl={account.image} alternativeText={account.name} />
              </ProfileBadge>
            ) : (
              <UserAvatar mode={"read"} imageUrl={account.image} alternativeText={account.name} />
            )}
          </AvatarContainer>
          <Name variant="h5">{account.name}</Name>
          {location && (
            <div>
              <Content>
                <Tooltip title="Location">
                  <InfoIcon color="primary" />
                </Tooltip>
                {location ? location + locationAdditionalText : location.missingMessage}
              </Content>
            </div>
          )}
          {account.types && (
            <NoPaddingContainer>
              {account.types.map((type) => (
                <StyledChip label={type.name} color="secondary" key={type.key} />
              ))}
            </NoPaddingContainer>
          )}
          {isOrganization && (
            <>
              <FollowButton
                isUserFollowing={isUserFollowing}
                handleToggleFollow={handleToggleFollowOrganization}
                toggleShowFollowers={toggleShowFollowers}
                bindFollow={bindFollow}
                numberOfFollowers={numberOfFollowers}
                texts={organizationTexts}
                followingChangePending={followingChangePending}
                isLoggedIn={user}
                showLinkUnderButton
                toolTipText={organizationTexts.follow_for_updates}
                toolTipPlacement="bottom"
              />

              <Typography>{organizationTexts.follow_this_organization_for_updates}</Typography>
            </>
          )}
        </AvatarWithInfo>

        <AccountInfo $isOwnAccount={!!isOwnAccount}>{displayAccountInfo(account.info)}</AccountInfo>
        {isOwnAccount && !isSmallScreen && (
          <EditButtonWrapper>
            <Button variant="contained" color="primary" href={editHref}>
              <InnerIcon />
              {editText ? editText : texts.edit_profile}
            </Button>
          </EditButtonWrapper>
        )}
      </InfoContainer>
      <FollowersDialog
        open={showFollowers}
        loading={!initiallyCaughtFollowers}
        followers={followers}
        object={account}
        onClose={toggleShowFollowers}
        user={user}
        url={"organization/" + account.url_slug + "?show_followers=true"}
        titleText={organizationTexts.followers_of}
        pleaseLogInText={organizationTexts.please_log_in}
        toSeeFollowerText={organizationTexts.to_see_this_organizations_followers}
        logInText={organizationTexts.log_in}
        noFollowersText={organizationTexts.this_organzation_does_not_have_any_followers_yet}
        followingSinceText={organizationTexts.following_since}
      />

      <ConfirmDialog
        open={confirmDialogOpen.follow}
        onClose={onFollowDialogClose}
        title={organizationTexts.do_you_really_want_to_unfollow}
        text={
          <span>{organizationTexts.are_you_sure_that_you_want_to_unfollow_this_organization}</span>
        }
        confirmText={organizationTexts.yes}
        cancelText={organizationTexts.no}
      />
      <MarginTopDivider />
      {detailedDescription?.value && (
        <Container>
          <StyledDetailledDescription
            title={detailedDescription.name}
            value={detailedDescription.value}
          />
        </Container>
      )}
      {children}
    </NoPaddingContainer>
  );
}

const getFollowers = async (organization, token, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/organizations/" + organization.url_slug + "/followers/",
      token: token,
      locale: locale,
    });
    return resp.data.results;
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
  }
};

const getFullInfoElement = (infoMetadata, key, value) => {
  return { ...infoMetadata[key], value: value };
};

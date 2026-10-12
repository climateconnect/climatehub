import { Button, Container, Divider, Typography, useMediaQuery } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";
import AccountBoxIcon from "@mui/icons-material/AccountBox";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import NextCookies from "next-cookies";
import { useRouter } from "next/router";
import React, { useContext, useEffect, useState } from "react";
import Cookies from "universal-cookie";
import ROLE_TYPES from "../../public/data/role_types";
import { apiRequest, getLocalePrefix, getRolesOptions } from "../../public/lib/apiOperations";
import { getImageUrl } from "../../public/lib/imageOperations";
import { startPrivateChat } from "../../public/lib/messagingOperations";
import {
  getIsUserFollowing,
  parseOrganization,
  getMembersByOrganization,
} from "../../public/lib/organizationOperations";
import { nullifyUndefinedValues } from "../../public/lib/profileOperations";
import getTexts from "../../public/texts/texts";
import AccountPage from "../../src/components/account/AccountPage";
import LoginNudge from "../../src/components/general/LoginNudge";
import PageNotFound from "../../src/components/general/PageNotFound";
import WideLayout from "../../src/components/layouts/WideLayout";
import ProfilePreviews from "../../src/components/profile/ProfilePreviews";
import ProjectPreviews from "../../src/components/project/ProjectPreviews";
import theme from "../../src/themes/theme";
import getOrganizationInfoMetadata from "./../../public/data/organization_info_metadata";
import UserContext from "./../../src/components/context/UserContext";
import IconButton from "@mui/material/IconButton";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import ControlPointSharpIcon from "@mui/icons-material/ControlPointSharp";
import getHubTheme from "../../src/themes/fetchHubTheme";
import { transformThemeData } from "../../src/themes/transformThemeData";
import { parseProjectStubs } from "../../public/lib/parsingOperations";
import HubsSubHeader from "../../src/components/indexPage/hubsSubHeader/HubsSubHeader";
import { getAllHubs } from "../../public/lib/hubOperations";

const DEFAULT_BACKGROUND_IMAGE = "/images/default_background_org.jpg";

const StyledLoginNudge = styled(LoginNudge)({
  textAlign: "center",
  margin: "0 auto",
});

const buttonIconStyles = ({ theme }: { theme: Theme }) => ({
  width: "30px",
  height: "auto",
  marginBottom: theme.spacing(1),
  color: theme.palette.background.default_contrastText,
});

const innerIconStyles = ({ theme }: { theme: Theme }) => ({
  marginRight: theme.spacing(0.5),
});

const ShareProjectButtonIcon = styled(ControlPointSharpIcon)(buttonIconStyles);
const ShareProjectInnerIcon = styled(ControlPointSharpIcon)(innerIconStyles);
const ManageMembersButtonIcon = styled(GroupAddIcon)(buttonIconStyles);
const ManageMembersInnerIcon = styled(GroupAddIcon)(innerIconStyles);

const StyledDivider = styled(Divider)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const SectionHeadline = styled(Typography)(({ theme }) => ({
  fontSize: 23,
  fontWeight: "bold",
  marginBottom: theme.spacing(1),
  wordBreak: "break-word",
  color: theme?.palette?.background?.default_contrastText,
})) as typeof Typography;

const SectionHeadlineWithButtonContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: theme.spacing(3),
}));

const NoContentYet = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(4),
  marginBottom: theme.spacing(5),
}));

export async function getServerSideProps(ctx) {
  const { auth_token } = NextCookies(ctx);
  const organizationUrl = encodeURI(ctx.query.organizationUrl);
  const hubUrl = ctx.query.hub;
  const [
    organization,
    projectsData,
    members,
    organizationTypes,
    rolesOptions,
    following,
    hubThemeData,
    hubs,
  ] = await Promise.all([
    getOrganizationByUrlIfExists(organizationUrl, auth_token, ctx.locale, hubUrl),
    getProjectsByOrganization(organizationUrl, auth_token, ctx.locale),
    getMembersByOrganization(organizationUrl, auth_token, ctx.locale),
    getOrganizationTypes(),
    getRolesOptions(auth_token, ctx.locale),
    getIsUserFollowing(organizationUrl, auth_token, ctx.locale),
    getHubTheme(hubUrl),
    getAllHubs(ctx.locale),
  ]);
  return {
    props: nullifyUndefinedValues({
      organization: organization,
      projects: projectsData?.projects ?? null,
      projectsHasMore: projectsData?.hasMore ?? false,
      members: members,
      organizationTypes: organizationTypes,
      rolesOptions: rolesOptions,
      following: following,
      hubThemeData: hubThemeData,
      hubs: hubs,
      hubUrl: hubUrl,
    }),
  };
}

export default function OrganizationPage({
  organization,
  projects,
  projectsHasMore,
  members,
  rolesOptions,
  following,
  hubThemeData,
  hubs,
  hubUrl,
}) {
  const { user, locale, CUSTOM_HUB_URLS } = useContext(UserContext);
  const infoMetadata = getOrganizationInfoMetadata(locale, organization, false);
  const texts = getTexts({ page: "organization", locale: locale, organization: organization });
  // l. 105-137 handles following Organizations
  const [numberOfFollowers, setNumberOfFollowers] = useState(organization?.number_of_followers);
  const [isUserFollowing, setIsUserFollowing] = useState(following);
  const [followingChangePending, setFollowingChangePending] = useState(false);

  const handleWindowClose = (e) => {
    if (followingChangePending) {
      e.preventDefault();
      return (e.returnValue = texts.changes_might_not_be_saved);
    }
  };

  const handleFollow = (userFollows, updateCount, pending) => {
    setIsUserFollowing(userFollows);
    if (updateCount) {
      if (userFollows) {
        setNumberOfFollowers(numberOfFollowers + 1);
      } else {
        setNumberOfFollowers(numberOfFollowers - 1);
      }
    }
    setFollowingChangePending(pending);
  };

  useEffect(() => {
    window.addEventListener("beforeunload", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
    };
  });

  const customTheme = hubThemeData ? transformThemeData(hubThemeData) : undefined;
  const isCustomHub = CUSTOM_HUB_URLS.includes(hubUrl);
  const defaultBackUrl = hubUrl ? "/" + locale + "/hubs/" + hubUrl : "/" + locale;
  return (
    <WideLayout
      title={organization ? organization.name : texts.not_found_error}
      description={organization?.name + " | " + organization?.info.short_description}
      image={getImageUrl(organization?.image)}
      customTheme={customTheme}
      headerBackground={
        customTheme ? customTheme?.palette?.header.background : theme.palette.background.default
      }
      hubUrl={hubUrl}
      showDonationGoal={true}
      subHeader={
        <HubsSubHeader
          hubs={hubs}
          onlyShowDropDown={true}
          isCustomHub={isCustomHub}
          hubSlug={hubUrl}
          defaultBackUrl={defaultBackUrl}
        />
      }
    >
      {organization ? (
        <OrganizationLayout
          numberOfFollowers={numberOfFollowers}
          handleFollow={handleFollow}
          followingChangePending={followingChangePending}
          isUserFollowing={isUserFollowing}
          organization={organization}
          projects={projects}
          projectsHasMore={projectsHasMore}
          members={members}
          /*TODO(unused) organizationTypes={organizationTypes} */
          infoMetadata={infoMetadata}
          user={user}
          texts={texts}
          locale={locale}
          rolesOptions={rolesOptions}
          hubUrl={hubUrl}
        />
      ) : (
        <PageNotFound itemName={texts.organization} />
      )}
    </WideLayout>
  );
}

function OrganizationLayout({
  numberOfFollowers,
  handleFollow,
  followingChangePending,
  isUserFollowing,
  organization,
  projects,
  projectsHasMore,
  members,
  infoMetadata,
  user,
  texts,
  locale,
  rolesOptions,
  hubUrl,
}) {
  const cookies = new Cookies();
  const router = useRouter();

  const [allProjects, setAllProjects] = useState(projects || []);
  const [hasMoreProjects, setHasMoreProjects] = useState(projectsHasMore);
  const [nextPage, setNextPage] = useState(2);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const getRoleName = (permission) => {
    const permission_to_show = permission === "all" ? "read write" : permission;
    return rolesOptions.find((o) => o.role_type === permission_to_show).name;
  };

  const getMembersWithAdditionalInfo = (members) => {
    return members.map((m) => ({
      ...m,
      additionalInfo: [
        {
          text: m.location,
          icon: LocationOnIcon,
          iconName: "LocationOnIcon",
          importance: "high",
        },
        {
          text: m.role_in_organization,
          icon: AccountBoxIcon,
          iconName: "AccountBoxIcon",
          importance: "high",
          toolTipText: texts.role_in_organization,
        },
        {
          text: getRoleName(m.permission),
          importance: "low",
        },
      ],
    }));
  };

  const handleConnectBtn = async (e) => {
    e.preventDefault();
    const token = cookies.get("auth_token");
    const creator = members.filter((m) => m.isCreator === true)[0];
    const chat = await startPrivateChat(creator, token, locale);
    const chatLink = hubUrl ? `/chat/${chat.chat_uuid}/?hub=${hubUrl}` : `/chat/${chat.chat_uuid}/`;
    router.push(chatLink);
  };
  const canEdit =
    user &&
    !!members.find((m) => m.id === user.id) &&
    [ROLE_TYPES.all_type, ROLE_TYPES.read_write_type].includes(
      members.find((m) => m.id === user.id).permission
    );

  const membersWithAdditionalInfo = getMembersWithAdditionalInfo(members);

  const handleLoadMoreProjects = async () => {
    if (isLoadingMore || !hasMoreProjects) return;
    setIsLoadingMore(true);
    try {
      const resp = await apiRequest({
        method: "get",
        url: `/api/organizations/${organization.url_slug}/projects/?page=${nextPage}`,
        token: cookies.get("auth_token"),
        locale: locale,
      });
      if (resp.data) {
        const newProjects = parseProjectStubs(resp.data.results);
        setAllProjects((prev) => [...prev, ...newProjects]);
        setHasMoreProjects(!!resp.data.next);
        setNextPage((prev) => prev + 1);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const isTinyScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const isSmallScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  return (
    <AccountPage
      numberOfFollowers={numberOfFollowers}
      handleFollow={handleFollow}
      followingChangePending={followingChangePending}
      isUserFollowing={isUserFollowing}
      account={organization}
      default_background={DEFAULT_BACKGROUND_IMAGE}
      editHref={`${getLocalePrefix(locale)}/editOrganization/${organization.url_slug}${
        hubUrl ? `?hub=${hubUrl}` : ""
      }`}
      /*TODO(unused) type="organization" */
      infoMetadata={infoMetadata}
      isOwnAccount={canEdit}
      isOrganization={true}
      editText={texts.edit_organization}
      isSmallScreen={isSmallScreen}
      hubUrl={hubUrl}
    >
      {!user && <StyledLoginNudge whatToDo={texts.to_see_this_organizations_full_information} />}
      <Container>
        {user && !canEdit && (
          <Button variant="contained" color="primary" onClick={handleConnectBtn}>
            {texts.send_message}
          </Button>
        )}
        <SectionHeadlineWithButtonContainer>
          <SectionHeadline color="primary" component="h2">
            {texts.this_organizations_projects}
          </SectionHeadline>
          {isTinyScreen ? (
            <IconButton
              href={`${getLocalePrefix(locale)}/share${hubUrl ? `?hub=${hubUrl}` : ""}`}
              size="large"
            >
              <ShareProjectButtonIcon
                /*TODO(unused) variant="contained" */
                color="primary"
              />
            </IconButton>
          ) : (
            <Button
              variant="contained"
              color="primary"
              href={`${getLocalePrefix(locale)}/share${hubUrl ? `?hub=${hubUrl}` : ""}`}
            >
              <ShareProjectInnerIcon />
              {texts.share_a_project}
            </Button>
          )}
        </SectionHeadlineWithButtonContainer>
        {allProjects && allProjects.length ? (
          <>
            <ProjectPreviews projects={allProjects} hubUrl={hubUrl} parentHandlesGridItems />
            {hasMoreProjects && (
              <Button
                variant="outlined"
                color="primary"
                onClick={handleLoadMoreProjects}
                disabled={isLoadingMore}
                fullWidth
                sx={{ mt: 2 }}
              >
                {isLoadingMore ? texts.loading : texts.load_more}
              </Button>
            )}
          </>
        ) : (
          <NoContentYet>{texts.this_organization_has_not_listed_any_projects_yet}</NoContentYet>
        )}
      </Container>
      <StyledDivider />
      <Container>
        <SectionHeadlineWithButtonContainer>
          <SectionHeadline color="primary" component="h2">
            {texts.members_of_organization}
          </SectionHeadline>
          {canEdit &&
            (isTinyScreen ? (
              <IconButton
                href={`${getLocalePrefix(locale)}/manageOrganizationMembers/${
                  organization.url_slug
                }${hubUrl ? `?hub=${hubUrl}` : ""}`}
                size="large"
              >
                <ManageMembersButtonIcon color="primary" />
              </IconButton>
            ) : (
              <Button
                variant="contained"
                color="primary"
                href={`${getLocalePrefix(locale)}/manageOrganizationMembers/${
                  organization.url_slug
                }${hubUrl ? `?hub=${hubUrl}` : ""}`}
              >
                <ManageMembersInnerIcon />
                {texts.manage_members}
              </Button>
            ))}
        </SectionHeadlineWithButtonContainer>
        {members && members.length ? (
          <ProfilePreviews
            profiles={membersWithAdditionalInfo}
            showAdditionalInfo
            hubUrl={hubUrl}
          />
        ) : (
          <Typography>
            {texts.none_of_the_members_of_this_organization_has_signed_up_yet}
          </Typography>
        )}
      </Container>
    </AccountPage>
  );
}

async function getOrganizationByUrlIfExists(organizationUrl, token, locale, hubUrl?: string) {
  let query = "";
  query += hubUrl ? `?hub=${hubUrl}` : "";

  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/organizations/" + organizationUrl + "/" + query,
      token: token,
      locale: locale,
    });

    return parseOrganization(resp.data);
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getProjectsByOrganization(organizationUrl, token, locale) {
  try {
    const resp = await apiRequest({
      method: "get",
      url: "/api/organizations/" + organizationUrl + "/projects/",
      token: token,
      locale: locale,
    });
    if (!resp.data) return null;
    else {
      return {
        projects: parseProjectStubs(resp.data.results),
        hasMore: !!resp.data.next,
      };
    }
  } catch (err) {
    console.log(err);
    if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
    return null;
  }
}

async function getOrganizationTypes() {
  return [];
}

import NextCookies from "next-cookies";
import React, { useContext, useEffect, useMemo } from "react";
import Cookies from "universal-cookie";
import {
  getOrganizationTagsOptions,
  getSectorOptions,
  getSkillsOptions,
} from "../../public/lib/getOptions";
import { getLocationFilteredBy } from "../../public/lib/locationOperations";
import { nullifyUndefinedValues } from "../../public/lib/profileOperations";
import BrowseOrganisationsContent from "../../src/components/browse/BrowseOrganisationsContent";
import UserContext from "../../src/components/context/UserContext";
import { HubContext } from "../../src/components/context/HubContext";
import WideLayout from "../../src/components/layouts/WideLayout";
import PageNav from "../../src/components/pageNav/PageNav";
import MobilePageNav from "../../src/components/pageNav/MobilePageNav";
import { FilterProvider } from "../../src/components/provider/FilterProvider";
import { useRouter } from "next/router";
import { useMediaQuery, Theme } from "@mui/material";
import getTexts from "../../public/texts/texts";

export async function getServerSideProps(ctx) {
  const { hideInfo } = NextCookies(ctx);
  const locale = ctx.locale ?? "en";
  const [organization_types, location_filtered_by, sectorOptions, skills] = await Promise.all([
    getOrganizationTagsOptions(locale),
    getLocationFilteredBy(ctx.query, locale),
    getSectorOptions(locale),
    getSkillsOptions(locale),
  ]);
  return {
    props: nullifyUndefinedValues({
      filterChoices: { organization_types, sectors: sectorOptions, skills },
      hideInfo: hideInfo === "true",
      initialLocationFilter: location_filtered_by,
    }),
  };
}

export default function OrganisationsPage({ filterChoices, initialLocationFilter }: any) {
  const cookies = new Cookies();
  const token = cookies.get("auth_token");
  const { locale, refreshUser } = useContext(UserContext);
  const { hubs } = useContext(HubContext);
  const router = useRouter();
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const texts = useMemo(() => getTexts({ page: "hub", locale }), [locale]);

  useEffect(() => {
    if (refreshUser && token) refreshUser();
  }, []);

  return (
    <WideLayout>
      <PageNav
        activeEntry="organizations"
        type_names={{
          projects: texts.projects,
          organizations: isNarrowScreen ? texts.orgs : texts.organizations,
          members: texts.members,
        }}
        hubUrl=""
        className=""
        allHubs={hubs}
        fromPage={undefined}
        subHubSegment={undefined}
      />
      <FilterProvider
        filterChoices={filterChoices}
        initialLocationFilter={initialLocationFilter}
        locale={locale}
        token={token}
      >
        <BrowseOrganisationsContent
          key={router.pathname}
          filterChoices={filterChoices}
          initialLocationFilter={initialLocationFilter}
        />
      </FilterProvider>
      {isNarrowScreen && <MobilePageNav activeEntry="organizations" hubAmbassador={null} />}
    </WideLayout>
  );
}

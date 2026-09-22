import { GetServerSideProps } from "next";
import React, { useContext } from "react";
import { useRouter } from "next/router";
import { getHubBrowseTypeServerSideProps } from "../../../public/lib/getHubBrowseTypeServerSideProps";
import HubPageLayout from "../../../src/components/hub/HubPageLayout";
import BrowseMembersContent from "../../../src/components/browse/BrowseMembersContent";
import { FilterProvider } from "../../../src/components/provider/FilterProvider";
import UserContext from "../../../src/components/context/UserContext";
import Cookies from "universal-cookie";

export const getServerSideProps: GetServerSideProps = (ctx) =>
  getHubBrowseTypeServerSideProps(ctx, "members");

export default function HubMembersPage({
  hubUrl,
  browseHubSlug,
  subHubSegment,
  filterChoices,
  initialLocationFilter,
  hubData,
  hubThemeData,
  linkedHubs,
  allHubs,
  isLocationHub,
}: any) {
  const cookies = new Cookies();
  const token = cookies.get("auth_token");
  const { locale } = useContext(UserContext);
  const router = useRouter();

  return (
    <HubPageLayout
      activeEntry="members"
      hubUrl={hubUrl}
      subHubSegment={subHubSegment}
      linkedHubs={linkedHubs}
      hubData={hubData}
      hubThemeData={hubThemeData}
      allHubs={allHubs}
      isLocationHub={isLocationHub}
    >
      <FilterProvider
        filterChoices={filterChoices}
        initialLocationFilter={initialLocationFilter}
        locale={locale}
        token={token}
        hubUrl={browseHubSlug ?? hubUrl}
      >
        <BrowseMembersContent
          key={router.pathname}
          filterChoices={filterChoices}
          initialLocationFilter={initialLocationFilter}
        />
      </FilterProvider>
    </HubPageLayout>
  );
}

import { GetServerSideProps } from "next";
import React, { useContext, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getHubBrowseTypeServerSideProps } from "../../../public/lib/getHubBrowseTypeServerSideProps";
import HubPageLayout from "../../../src/components/hub/HubPageLayout";
import BrowseProjectsContent from "../../../src/components/browse/BrowseProjectsContent";
import { FilterProvider } from "../../../src/components/provider/FilterProvider";
import UserContext from "../../../src/components/context/UserContext";
import Cookies from "universal-cookie";
import { getHubBrowsePathForType } from "../../../public/lib/urlOperations";
import { appHref } from "../../../public/lib/appLink";

export const getServerSideProps: GetServerSideProps = (ctx) =>
  getHubBrowseTypeServerSideProps(ctx, "projects");

export default function HubProjectsPage({
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
  const hashRedirectedRef = useRef(false);

  // Mount-only: handle the legacy `/hubs/.../browse#members` / `#organizations`
  // hash redirects exactly once. See `pages/browse.tsx` for the rationale.
  useEffect(() => {
    if (hashRedirectedRef.current) return;
    const hash = window.location.hash.replace("#", "");
    if (hash === "organizations" || hash === "members") {
      hashRedirectedRef.current = true;
      const targetPath = getHubBrowsePathForType(hash, hubUrl, subHubSegment);
      const localizedPath = appHref(targetPath, { locale: router.locale });
      window.location.replace(`${localizedPath}${window.location.search}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HubPageLayout
      activeEntry="projects"
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
        <BrowseProjectsContent
          key={router.pathname}
          filterChoices={filterChoices}
          initialLocationFilter={initialLocationFilter}
        />
      </FilterProvider>
    </HubPageLayout>
  );
}

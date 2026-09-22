import React, { lazy } from "react";
import BrowseContentBase from "./BrowseContentBase";

const OrganizationPreviews = lazy(() => import("../organization/OrganizationPreviews"));

type Props = {
  filterChoices: any;
  initialLocationFilter?: any;
  customSearchBarLabels?: any;
};

export default function BrowseOrganisationsContent(props: Props) {
  return (
    <BrowseContentBase
      type="organizations"
      filterChoices={props.filterChoices}
      initialLocationFilter={props.initialLocationFilter}
      customSearchBarLabels={props.customSearchBarLabels}
      renderItems={({ items, hasMore, isFetchingMoreData, handleLoadMoreData, hubUrl }) => (
        <OrganizationPreviews
          hasMore={hasMore}
          loadFunc={() => handleLoadMoreData(hubUrl)}
          organizations={items}
          parentHandlesGridItems
          isLoading={isFetchingMoreData}
        />
      )}
    />
  );
}

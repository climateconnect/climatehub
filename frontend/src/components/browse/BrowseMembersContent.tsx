import React, { lazy } from "react";
import BrowseContentBase from "./BrowseContentBase";

const ProfilePreviews = lazy(() => import("../profile/ProfilePreviews"));

type Props = {
  filterChoices: any;
  initialLocationFilter?: any;
  customSearchBarLabels?: any;
};

export default function BrowseMembersContent(props: Props) {
  return (
    <BrowseContentBase
      type="members"
      filterChoices={props.filterChoices}
      initialLocationFilter={props.initialLocationFilter}
      customSearchBarLabels={props.customSearchBarLabels}
      renderItems={({ items, hasMore, isFetchingMoreData, handleLoadMoreData, hubUrl }) => (
        <ProfilePreviews
          hasMore={hasMore}
          loadFunc={() => handleLoadMoreData(hubUrl)}
          profiles={items}
          showAdditionalInfo
          parentHandlesGridItems
          isLoading={isFetchingMoreData}
        />
      )}
    />
  );
}

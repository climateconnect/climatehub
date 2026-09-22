import React, { Suspense, lazy, useContext } from "react";
import BrowseContentBase from "./BrowseContentBase";
import { useUpcomingEvents } from "../../hooks/useUpcomingEvents";
import { HubContext } from "../context/HubContext";
import { FilterContext } from "../context/FilterContext";

const ProjectPreviews = lazy(() => import("../project/ProjectPreviews"));
const UpcomingEventsGroup = lazy(() => import("./UpcomingEventsGroup"));

type Props = {
  filterChoices: any;
  initialLocationFilter?: any;
  customSearchBarLabels?: any;
};

export default function BrowseProjectsContent(props: Props) {
  const { hubUrl } = useContext(HubContext);
  const { filters } = useContext(FilterContext);

  // The events band uses `useUpcomingEvents`, which must be called
  // unconditionally at the top level. It re-derives internally when
  // `filters` or `hubUrl` change, so we don't need to wrap it in a callback.
  const {
    visibleEvents,
    featuredProjects,
    bandEventSlugs,
    shouldRenderUpcomingBand,
  } = useUpcomingEvents(filters, hubUrl);

  return (
    <BrowseContentBase
      type="projects"
      filterChoices={props.filterChoices}
      initialLocationFilter={props.initialLocationFilter}
      customSearchBarLabels={props.customSearchBarLabels}
      belowFilterContent={
        shouldRenderUpcomingBand ? (
          <Suspense fallback={null}>
            <UpcomingEventsGroup events={visibleEvents} hubUrl={hubUrl} />
          </Suspense>
        ) : null
      }
      renderItems={({ items, hasMore, isFetchingMoreData, handleLoadMoreData }) => (
        <ProjectPreviews
          hasMore={hasMore}
          loadFunc={() => handleLoadMoreData(hubUrl)}
          parentHandlesGridItems
          projects={items.filter((p: any) => !bandEventSlugs.has(p.url_slug))}
          featuredProjects={featuredProjects}
          hubUrl={hubUrl}
          isLoading={isFetchingMoreData}
          analyticsSurface="browse_card"
        />
      )}
    />
  );
}

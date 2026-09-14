import HubEventsPage, { getHubEventsServerSideProps } from "./index";

export const getServerSideProps = getHubEventsServerSideProps;

export default function SubHubEventsFeedPage(props: any) {
  return <HubEventsPage {...props} autoOpenSubscribe />;
}

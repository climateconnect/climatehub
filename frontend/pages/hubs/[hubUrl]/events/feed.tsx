import HubEventsPage, { getHubEventsServerSideProps } from "./index";

export const getServerSideProps = getHubEventsServerSideProps;

export default function HubEventsFeedPage(props: any) {
  return <HubEventsPage {...props} autoOpenSubscribe />;
}

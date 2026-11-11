import React, { ComponentType, memo } from "react";
import { DevLinkProvider } from "../../../devlink/DevLinkProvider";

// Renders a DevLink component that runs scripts on mount (e.g. HtmlEmbed with a donation widget)
// and shields it from re-renders of the page, e.g. when accepting cookies re-renders the whole
// app. DevLink's HtmlEmbed passes a new dangerouslySetInnerHTML object on every render, so React
// rewrites its innerHTML and throws away everything the embedded scripts built in the DOM,
// without running the scripts again.
//
// The component gets its own DevLinkProvider inside the memo boundary, because the provider
// above it creates a new interactions context value on every render, which would re-render the
// component despite the memo.
const StaticDevlinkComponent = memo(function StaticDevlinkComponent({
  component: Component,
}: {
  component: ComponentType;
}) {
  return (
    <DevLinkProvider>
      <Component />
    </DevLinkProvider>
  );
});

export default StaticDevlinkComponent;

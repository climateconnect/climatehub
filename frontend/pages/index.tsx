import makeStyles from "@mui/styles/makeStyles";
import React, { useContext, useEffect } from "react";
import { CcLandingpage } from "../devlink/pageComponent/CcLandingpage";
import { EnLandingpageClimateConnect } from "../devlink/pageComponent/EnLandingpageClimateConnect";
import UserContext from "../src/components/context/UserContext";
import WideLayout from "../src/components/layouts/WideLayout";

const useStyles = makeStyles(() => ({
  container: {
    overflowAnchor: "none",
  },
}));

export default function Index() {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  // Workaround for a bug with tabs in Webflow's devlink: the generated Tabs wrapper
  // calls `.focus()` on the active tab header whenever it mounts (initial load and on
  // every locale switch, since the landing page component swaps en <-> de). Because the
  // active tab sits in the middle of this long page, the default focus behaviour scrolls
  // the viewport down to it — without any user interaction. While the cookie banner (a
  // MUI Modal that locks scroll) is open this scroll is suppressed, but it surfaces when
  // the banner is dismissed, making the page "jump to the center" after accepting
  // cookies (issue #2142). Similarly, switching the language remounts the Tabs wrapper and
  // used to jump the page as well.
  // The focus call lives in a gitignored devlink module, so we neutralise its scroll
  // side-effect here: for the whole lifetime of the landing page, force `preventScroll`
  // for tab-header focuses. The tab strip is always visible, so suppressing the scroll
  // does not harm keyboard/click tab navigation.
  useEffect(() => {
    const originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options) {
      if (this.classList?.contains("w-tab-link")) {
        return originalFocus.call(this, { ...(options || {}), preventScroll: true });
      }
      return originalFocus.apply(this, arguments as any);
    };
    return () => {
      HTMLElement.prototype.focus = originalFocus;
    };
  }, []);

  return (
    <WideLayout>
      <div className={classes.container}>
        {locale === "de" ? <CcLandingpage /> : <EnLandingpageClimateConnect />}
      </div>
    </WideLayout>
  );
}

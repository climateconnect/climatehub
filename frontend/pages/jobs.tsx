import React, { useContext, useMemo } from "react";
import { DeJobs } from "../devlink/DeJobs";
import { EnJobs } from "../devlink/EnJobs";
import UserContext from "../src/components/context/UserContext";
import WideLayout from "../src/components/layouts/WideLayout";
import getTexts from "../public/texts/texts";

export default function Jobs() {
  const { locale } = useContext(UserContext);
  const texts = useMemo(() => getTexts({ page: "navigation", locale }), [locale]);
  return (
    <WideLayout title={texts.jobs} isStaticPage noSpaceBottom>
      {locale === "de" ? <DeJobs /> : <EnJobs />}
    </WideLayout>
  );
}

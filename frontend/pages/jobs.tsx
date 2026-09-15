import React, { useContext } from "react";
import { DeJobs } from "../devlink/DeJobs";
import { EnJobs } from "../devlink/EnJobs";
import UserContext from "../src/components/context/UserContext";
import WideLayout from "../src/components/layouts/WideLayout";

export default function Jobs() {
  const { locale } = useContext(UserContext);
  return (
    <WideLayout isStaticPage noSpaceBottom>
      {locale === "de" ? <DeJobs /> : <EnJobs />}
    </WideLayout>
  );
}

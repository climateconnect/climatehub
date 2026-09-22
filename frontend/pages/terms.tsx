import React, { useContext, useMemo } from "react";
import { DeAgbs } from "../devlink/DeAgbs";
import { EnAgbs } from "../devlink/EnAgbs";
import UserContext from "../src/components/context/UserContext";
import WideLayout from "../src/components/layouts/WideLayout";
import getTexts from "../public/texts/texts";

export default function Terms() {
  const { locale } = useContext(UserContext);
  const texts = useMemo(() => getTexts({ page: "navigation", locale }), [locale]);
  return (
    <WideLayout title={texts.terms} isStaticPage noSpaceBottom>
      {locale === "de" ? <DeAgbs /> : <EnAgbs />}
    </WideLayout>
  );
}

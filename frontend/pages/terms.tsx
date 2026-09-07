import Layout from "../src/components/layouts/layout";
import React, { useContext } from "react";
import UserContext from "../src/components/context/UserContext";
import { DeAgbs } from "../devlink/DeAgbs";
import { EnAgbs } from "../devlink/EnAgbs";

export default function Terms() {
  const { locale } = useContext(UserContext);
  return (
    <Layout title={locale === "de" ? "Nutzungsbedingungen" : "Terms of Use"}>
      {locale === "de" ? <DeAgbs /> : <EnAgbs />}
    </Layout>
  );
}

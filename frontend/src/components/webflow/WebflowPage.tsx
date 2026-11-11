import { Box } from "@mui/material";
import parseHtml from "html-react-parser";
import Head from "next/head";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import WideLayout from "../layouts/WideLayout";

export default function WebflowPage({
  bodyContent,
  headContent,
  pageKey,
  className,
  hideFooter,
  noHeader,
  title,
  description,
  showDonationGoal = true,
  mobilePadding = false,
}: any) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  const content = <div dangerouslySetInnerHTML={{ __html: bodyContent }} />;
  return (
    <>
      <Head>{parseHtml(headContent)}</Head>
      <WideLayout
        rootClassName={className}
        title={title ? title : texts[pageKey]}
        description={description}
        isStaticPage
        noSpaceBottom
        hideFooter={hideFooter}
        noHeader={noHeader}
        showDonationGoal={showDonationGoal}
      >
        {mobilePadding ? <Box sx={{ px: { xs: 2, md: 0 } }}>{content}</Box> : content}
      </WideLayout>
    </>
  );
}

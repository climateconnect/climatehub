import parseHtml from "html-react-parser";
import Head from "next/head";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { Box } from "@mui/material";
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
        <Box sx={mobilePadding ? { px: { xs: 2, md: 0 } } : undefined}>
          <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
        </Box>
      </WideLayout>
    </>
  );
}

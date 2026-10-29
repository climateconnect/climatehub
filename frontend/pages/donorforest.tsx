import { styled } from "@mui/material/styles";
import NextCookies from "next-cookies";
import React, { useContext } from "react";
import { apiRequest } from "../public/lib/apiOperations";
import getTexts from "../public/texts/texts";
import UserContext from "../src/components/context/UserContext";
import DonorForestEntries from "../src/components/donation/donorForest/DonorForestEntries";
import DonorForestTransition from "../src/components/donation/donorForest/DonorForestTransition";
import WideLayout from "../src/components/layouts/WideLayout";
import TopSection from "../src/components/staticpages/TopSection";

const Forest = styled("div")({
  background: "#59B25F",
  width: "100%",
  minHeight: "100vh",
});

export async function getServerSideProps(ctx) {
  const { auth_token } = NextCookies(ctx);
  const donorsWithBadges = await getDonorsWithBadges(auth_token, ctx.locale);
  const possibleBadges = await getPossibleDonorBadges(auth_token, ctx.locale);
  return {
    props: {
      donorsWithBadges: donorsWithBadges,
      possibleBadges: possibleBadges,
    },
  };
}

export default function DonorForest({ donorsWithBadges, possibleBadges }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "donate", locale: locale });
  return (
    <WideLayout noSpaceBottom isStaticPage useFloodStdFont>
      <Forest>
        <TopSection
          headline={texts.donor_forest}
          subHeader={texts.watch_the_forest_grow}
          noMarginBottom
          fixedHeight
        />
        <DonorForestTransition possibleBadges={possibleBadges} />
        <DonorForestEntries donors={donorsWithBadges} />
      </Forest>
    </WideLayout>
  );
}

const getDonorsWithBadges = async (token, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/donors_with_badges/`,
      token: token,
      locale: locale,
    });
    return resp.data.results;
  } catch (err) {
    console.log(err);
  }
};

const getPossibleDonorBadges = async (token, locale) => {
  try {
    const resp = await apiRequest({
      method: "get",
      url: `/api/donor_badges/`,
      token: token,
      locale: locale,
    });
    return resp.data;
  } catch (err) {
    console.log(err);
  }
};

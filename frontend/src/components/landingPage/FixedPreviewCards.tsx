import { styled } from "@mui/material/styles";
import React from "react";
import LoadingSpinner from "../general/LoadingSpinner";
import HubPreview from "../hub/HubPreview";
import ProjectPreview from "../project/ProjectPreview";
//This component is to display a fixed amount of projects without  the option to load more

const Root = styled("div")({
  display: "flex",
  justifyContent: "center",
});

const Container = styled("div")(({ theme }) => ({
  whiteSpace: "nowrap",
  overflow: "auto",
  display: "flex",
  justifyContent: "space-between",
  minWidth: "100%",
  [theme.breakpoints.up("sm")]: {
    ["&::-webkit-scrollbar"]: {
      display: "block",
      height: 10,
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: "#F8F8F8",
      borderRadius: 20,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "rgba(0,0,0,0.8)",
      borderRadius: 20,
    },
  },
  [theme.breakpoints.down("lg")]: {
    display: "block",
    minWidth: 0,
  },
}));

const StyledLoadingSpinner = styled(LoadingSpinner)(({ theme }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

// The first/last overrides come after the media queries to keep the original rule order
const Project = styled("span", { shouldForwardProp })<{ $isFirst: boolean; $isLast: boolean }>(
  ({ theme, $isFirst, $isLast }) => ({
    width: 300,
    display: "inline-block",
    whiteSpace: "normal",
    [theme.breakpoints.down("xl")]: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
    },
    [theme.breakpoints.down("lg")]: {
      width: 268,
      marginLeft: theme.spacing(2),
      marginRight: theme.spacing(2),
    },
    ...($isFirst && { marginLeft: 0 }),
    ...($isLast && { marginRight: 0 }),
  })
);

export default function FixedPreviewCards({ elements, type, isLoading }) {
  return (
    <Root>
      <Container>
        {isLoading ? (
          <StyledLoadingSpinner />
        ) : (
          <>
            {elements.map((e, index) => (
              <Project
                $isFirst={index === 0}
                $isLast={index === elements.length - 1}
                key={e.url_slug}
              >
                {type === "project" ? (
                  <ProjectPreview project={e} />
                ) : (
                  type === "hub" && <HubPreview hub={e} disableBoxShadow />
                )}
              </Project>
            ))}
          </>
        )}
      </Container>
    </Root>
  );
}

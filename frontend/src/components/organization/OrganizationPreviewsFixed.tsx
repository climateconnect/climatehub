import { styled } from "@mui/material/styles";
import React from "react";
import LoadingSpinner from "../general/LoadingSpinner";
import OrganizationPreview from "./OrganizationPreview";
//This component is to display a fixed amount of projects without  the option to load more

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

const Root = styled("div")({
  display: "flex",
});

const Container = styled("div")(({ theme }) => ({
  overflow: "auto",
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
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
}));

// The first item's marginLeft: 0 comes last so it beats the margins above (as in the old stylesheet order)
const OrganizationItem = styled("span", { shouldForwardProp })<{ $first?: boolean }>(
  ({ theme, $first }) => [
    {
      minWidth: 265,
      flex: "1 1 0px",
      display: "inline-block",
      marginLeft: theme.spacing(2),
      marginRight: theme.spacing(2),
      [theme.breakpoints.down("xl")]: {
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1),
      },
    },
    $first && { marginLeft: 0 },
  ]
);

const StyledLoadingSpinner = styled(LoadingSpinner)(({ theme }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

export default function OrganizationPreviewsFixed({ organizations, isLoading }) {
  return (
    <Root>
      <Container>
        {isLoading ? (
          <StyledLoadingSpinner />
        ) : (
          <>
            {organizations.map((organization, index) => {
              return (
                <OrganizationItem $first={index === 0} key={organization.url_slug}>
                  <OrganizationPreview organization={organization} />
                </OrganizationItem>
              );
            })}
          </>
        )}
      </Container>
    </Root>
  );
}

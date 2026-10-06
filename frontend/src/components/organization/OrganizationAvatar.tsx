import { Avatar, Chip, Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

type StyleProps = { $inlineVersionOnMobile?: boolean };

const Root = styled("div", { shouldForwardProp })<StyleProps>(
  ({ theme, $inlineVersionOnMobile }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    [theme.breakpoints.down("sm")]: {
      flexDirection: $inlineVersionOnMobile ? "row" : "column",
      flexWrap: "wrap",
      gap: "10px",
    },
  })
);

const OrgAvatar = styled(Avatar, { shouldForwardProp })<StyleProps>(
  ({ theme, $inlineVersionOnMobile }) => ({
    width: 120,
    height: 120,
    [theme.breakpoints.down("sm")]: {
      marginRight: $inlineVersionOnMobile ? theme.spacing(2) : undefined,
    },
    ["@media(max-width: 500px)"]: {
      width: $inlineVersionOnMobile ? 90 : 120,
      height: $inlineVersionOnMobile ? 90 : 120,
    },
  })
);

const TypeChip = styled(Chip, { shouldForwardProp })<StyleProps>(
  ({ theme, $inlineVersionOnMobile }) => ({
    borderRadius: 100,
    width: 145,
    marginTop: theme.spacing(-3),
    zIndex: 1,
    [theme.breakpoints.down("sm")]: {
      marginTop: $inlineVersionOnMobile ? 0 : theme.spacing(-3),
    },
  })
);

const InlineRightContainer = styled("div")({
  display: "flex",
  flexDirection: "column",
});

const SuggestionTitle = styled(Typography)({
  fontSize: 17,
  fontWeight: 700,
  overflowWrap: "anywhere",
}) as typeof Typography;

export default function OrganizationAvatar({ organization, inlineVersionOnMobile }) {
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const type = organization?.types[0]?.organization_tag;
  return (
    <Root $inlineVersionOnMobile={inlineVersionOnMobile}>
      <OrgAvatar
        src={getImageUrl(organization.image)}
        component="div"
        $inlineVersionOnMobile={inlineVersionOnMobile}
      />
      {inlineVersionOnMobile && isNarrowScreen ? (
        <InlineRightContainer>
          <SuggestionTitle component="h2" color="secondary">
            {organization.name}
          </SuggestionTitle>
          <TypeChip
            color="primary"
            size="small"
            label={type?.name}
            $inlineVersionOnMobile={inlineVersionOnMobile}
          />
        </InlineRightContainer>
      ) : (
        <TypeChip
          color="primary"
          size="small"
          label={type?.name}
          $inlineVersionOnMobile={inlineVersionOnMobile}
        />
      )}
    </Root>
  );
}

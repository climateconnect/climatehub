import { ClassNames } from "@emotion/react";
import { Container, Theme, useMediaQuery } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../../public/texts/texts";
import theme from "../../../themes/theme";
import UserContext from "../../context/UserContext";
import GoBackButton from "../../general/GoBackButton";
import HubLinks from "./HubLinks";
const PRIO1_SLUG = "prio1";

const Root = styled("div", {
  shouldForwardProp: (prop) => prop !== "$hubSlug",
})<{ $hubSlug?: string }>(({ theme, $hubSlug }) => ({
  background: $hubSlug === PRIO1_SLUG ? theme.palette.secondary.main : theme.palette.primary.main,
}));

const StyledContainer = styled(Container)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});

const HubsContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: {
    justifyContent: "center",
  },
}));

export default function HubsSubHeader({
  hubs,
  onlyShowDropDown,
  isCustomHub,
  hubSlug,
  project,
  defaultBackUrl,
}: any) {
  const muiTheme = useTheme();
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  return (
    <Root $hubSlug={hubSlug}>
      <StyledContainer>
        <div>
          {onlyShowDropDown && (
            <GoBackButton
              /*TODO(undefined) containerClassName={classes.goBackButtonContainer} */
              texts={texts}
              locale={locale}
              tinyScreen={isNarrowScreen}
              hubSlug={hubSlug}
              project={project}
              defaultBackUrl={defaultBackUrl}
            />
          )}
        </div>
        <HubsContainer>
          {hubs && !isCustomHub && (
            <ClassNames>
              {({ css }) => (
                <HubLinks
                  linkClassName={css({
                    color: muiTheme.palette.primary.contrastText,
                    display: "inline-block",
                    fontWeight: 600,
                    marginRight: muiTheme.spacing(2),
                    marginLeft: muiTheme.spacing(2),
                    fontSize: 16,
                    paddingTop: muiTheme.spacing(2),
                    paddingBottom: muiTheme.spacing(2),
                  })}
                  hubs={hubs}
                  locale={locale}
                  isNarrowScreen={isNarrowScreen}
                  onlyShowDropDown={onlyShowDropDown}
                />
              )}
            </ClassNames>
          )}
        </HubsContainer>
      </StyledContainer>
    </Root>
  );
}

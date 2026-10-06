import { Button, CircularProgress, Link, Tooltip, Typography } from "@mui/material";
import React, { MouseEventHandler } from "react";
import ButtonIcon from "./ButtonIcon";
import { styled, useTheme } from "@mui/material/styles";

const FollowButtonContainer = styled("span")({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
});

const FollowersLink = styled(Link)({
  cursor: "pointer",
  textAlign: "center",
});

const FollowerNumber = styled("span")({
  fontWeight: 700,
});

const FollowersText = styled(Typography)({
  fontWeight: 500,
  fontSize: 18,
});

const FollowingButton = styled(Button, {
  shouldForwardProp: (prop) => typeof prop !== "string" || !prop.startsWith("$"),
})<{ $hasAdminPermissions?: boolean; $belowSmallScreen?: boolean }>(
  ({ theme, $hasAdminPermissions, $belowSmallScreen }) => ({
    marginLeft: $hasAdminPermissions ? theme.spacing(2) : theme.spacing(0.25),
    marginRight: $hasAdminPermissions ? theme.spacing(2) : theme.spacing(0.25),
    whiteSpace: "nowrap",
    height: 40,
    maxWidth: $belowSmallScreen ? 180 : 140,
    "&:disabled": {
      color: "white",
      background: theme.palette.secondary.main,
    },
  })
);

const FabProgress = styled(CircularProgress, {
  shouldForwardProp: (prop) => typeof prop !== "string" || !prop.startsWith("$"),
})<{ $hidden?: boolean }>(({ $hidden }) => ({
  color: "white",
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  marginLeft: "auto",
  marginRight: "auto",
  marginTop: "auto",
  marginBottom: "auto",
  ...($hidden && { visibility: "hidden" }),
}));

const ButtonLabel = styled("div")({
  position: "relative",
});

const ButtonText = styled("div", {
  shouldForwardProp: (prop) => typeof prop !== "string" || !prop.startsWith("$"),
})<{ $pending?: boolean }>(({ $pending }) => ({
  visibility: $pending ? "hidden" : "visible",
}));

type Args = {
  isUserFollowing: boolean;
  handleToggleFollow: MouseEventHandler<HTMLButtonElement>;
  hasAdminPermissions: boolean;
  toggleShowFollowers: Function;
  followingChangePending: boolean;
  texts: any;
  screenSize?: any;
  numberOfFollowers: number;
  bindFollow?: Function;
  isLoggedIn: boolean;
  showStartIcon?: boolean;
  showLinkUnderButton?: boolean;
  showNumberInText?: boolean;
  toolTipText?: string;
  toolTipPlacement?: any;
};

export default function FollowButton({
  isUserFollowing,
  handleToggleFollow,
  hasAdminPermissions = false,
  toggleShowFollowers,
  followingChangePending,
  texts,
  screenSize,
  numberOfFollowers,
  bindFollow,
  isLoggedIn,
  showStartIcon,
  showLinkUnderButton,
  showNumberInText,
  toolTipText,
  toolTipPlacement,
}: Args) {
  const theme = useTheme();
  return (
    <FollowButtonContainer>
      {/* conditionally display the tooltip if text is defined only, since this is also used for project follow button */}
      <Tooltip arrow placement={toolTipPlacement} title={toolTipText == null ? "" : toolTipText}>
        <FollowingButton
          {...bindFollow}
          onClick={handleToggleFollow}
          variant="contained"
          startIcon={
            showStartIcon ? (
              <ButtonIcon
                icon="follow"
                size={27}
                color={isUserFollowing ? "earth" : theme.palette.primary.contrastText}
              />
            ) : (
              <></>
            )
          }
          color={isUserFollowing && isLoggedIn ? "secondary" : "primary"}
          disabled={followingChangePending}
          $hasAdminPermissions={hasAdminPermissions}
          $belowSmallScreen={screenSize?.belowSmall}
        >
          <ButtonLabel>
            <FabProgress size={20} $hidden={!followingChangePending} />
            <ButtonText $pending={followingChangePending}>
              {isUserFollowing && isLoggedIn ? texts.following : texts.follow}
              {showNumberInText && !followingChangePending && numberOfFollowers > 0
                ? " • " + numberOfFollowers
                : ""}
            </ButtonText>
          </ButtonLabel>
        </FollowingButton>
      </Tooltip>
      {showLinkUnderButton && numberOfFollowers > 0 && (
        <LinkWithText
          numberOfFollowers={numberOfFollowers}
          texts={texts}
          toggleShowFollowers={toggleShowFollowers}
        />
      )}
    </FollowButtonContainer>
  );
}

function LinkWithText({ numberOfFollowers, texts, toggleShowFollowers }) {
  return (
    <FollowersLink color="text.primary" underline="none" onClick={toggleShowFollowers}>
      <FollowersText>
        <FollowerNumber>{numberOfFollowers} </FollowerNumber>
        {numberOfFollowers > 1 ? texts.followers : texts.follower}
      </FollowersText>
    </FollowersLink>
  );
}

import { Button, CircularProgress, IconButton, Link, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import React, { MouseEventHandler } from "react";
import ButtonIcon from "../../general/ButtonIcon";

const shouldForwardProp = (prop: string) => !prop.startsWith("$");

const LargeScreenButtonContainer = styled("span")({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
});

const LikesLink = styled(Link)({
  cursor: "pointer",
  textAlign: "center",
});

const LargeLikeButton = styled(Button)(({ theme }) => ({
  height: 40,
  maxWidth: 120,
  "&:disabled": {
    color: "white",
    background: theme.palette.secondary.main,
  },
}));

const LikeNumber = styled("span")({
  fontWeight: 700,
});

const LikeNumberMobile = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.text.primary,
  whiteSpace: "nowrap",
}));

const LikesText = styled(Typography)({
  fontWeight: 500,
  fontSize: 18,
});

const MediumScreenIconButton = styled(IconButton)({
  height: 40,
});

const MobileButtonContainer = styled("span")({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  cursor: "pointer",
  height: 40,
});

const MobileIconButton = styled(IconButton)(({ theme }) => ({
  padding: theme.spacing(1),
  "&:hover": {
    background: "none",
  },
}));

const FabProgress = styled(CircularProgress, { shouldForwardProp })<{ $hidden: boolean }>(
  ({ $hidden }) => ({
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
  })
);

const ButtonLabel = styled("div")({
  position: "relative",
});

const ButtonText = styled("div", { shouldForwardProp })<{
  $likingChangePending: boolean;
  $isUserLiking: boolean;
}>(({ theme, $likingChangePending, $isUserLiking }) => ({
  visibility: $likingChangePending ? "hidden" : "visible",
  color: $isUserLiking ? theme.palette.secondary.contrastText : theme.palette.primary.contrastText,
}));

type Args = {
  isUserLiking: boolean;
  handleToggleLikeProject: MouseEventHandler<HTMLButtonElement>;
  texts: any;
  toggleShowLikes: MouseEventHandler<HTMLAnchorElement>;
  likingChangePending: boolean;
  hasAdminPermissions?: boolean;
  screenSize?: any;
  numberOfLikes: number;
  bindLike?: Function;
};

export default function LikeButton({
  isUserLiking,
  handleToggleLikeProject,
  texts,
  toggleShowLikes,
  likingChangePending,
  hasAdminPermissions = false,
  screenSize,
  numberOfLikes,
  bindLike,
}: Args) {
  const theme = useTheme();
  //Small screens
  if (screenSize?.belowSmall) {
    return (
      <MobileButtonContainer onClick={handleToggleLikeProject} {...bindLike}>
        <MobileIconButton disabled={likingChangePending} size="large">
          <ButtonIcon
            icon="like"
            size={40}
            color={isUserLiking ? "earth" : theme.palette.background.default_contrastText}
          />
        </MobileIconButton>
        {numberOfLikes > 0 && <LikeNumberMobile>• {numberOfLikes}</LikeNumberMobile>}
      </MobileButtonContainer>
    );
    //Medium screens
  } else if (screenSize?.belowMedium && !screenSize.belowSmall && !hasAdminPermissions) {
    return (
      <LargeScreenButtonContainer>
        <MediumScreenIconButton
          onClick={handleToggleLikeProject}
          disabled={likingChangePending}
          size="large"
        >
          <ButtonIcon
            icon="like"
            size={40}
            color={isUserLiking ? "earth" : theme.palette.primary.main}
          />
        </MediumScreenIconButton>
        {numberOfLikes > 0 && (
          <LikesLink color="secondary" underline="none" onClick={toggleShowLikes}>
            <LikesText>
              <LikeNumber>{numberOfLikes} </LikeNumber>
              {numberOfLikes > 1 ? texts.likes : texts.one_like}
            </LikesText>
          </LikesLink>
        )}
      </LargeScreenButtonContainer>
    );
    //Large screens
  } else {
    return (
      <LargeScreenButtonContainer>
        <LargeLikeButton
          onClick={handleToggleLikeProject}
          variant="contained"
          startIcon={
            <ButtonIcon
              icon="like"
              size={26}
              color={isUserLiking ? "earth" : theme.palette.primary.contrastText}
            />
          }
          disabled={likingChangePending}
          color={isUserLiking ? "secondary" : "primary"}
        >
          <ButtonLabel>
            <FabProgress size={20} $hidden={!likingChangePending} />
            <ButtonText $likingChangePending={likingChangePending} $isUserLiking={isUserLiking}>
              {isUserLiking ? texts.liked : texts.like}
            </ButtonText>
          </ButtonLabel>
        </LargeLikeButton>
        {numberOfLikes > 0 && (
          <LikesLink color="text.primary" underline="none" onClick={toggleShowLikes}>
            <LikesText>
              <LikeNumber>{numberOfLikes} </LikeNumber>
              {numberOfLikes > 1 ? texts.likes : texts.one_like}
            </LikesText>
          </LikesLink>
        )}
      </LargeScreenButtonContainer>
    );
  }
}

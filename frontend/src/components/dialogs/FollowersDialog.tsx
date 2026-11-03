import {
  Avatar,
  Button,
  Container,
  Divider,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import ReactTimeago from "react-timeago";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { getImageUrl } from "../../../public/lib/imageOperations";

import UserContext from "../context/UserContext";
import GenericDialog from "./GenericDialog";

const UserLink = styled(Link)({
  display: "flex",
  alignItems: "center",
});

const UserAvatar = styled(Avatar)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

const Username = styled(Typography)({
  fontWeight: 600,
}) as typeof Typography;

const FollowedText = styled(Typography)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    fontSize: 13,
  },
}));

const LoginButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

const LoginButtonContainer = styled(Container)({
  display: "flex",
  justifyContent: "center",
});

export default function FollowersDialog({
  open,
  onClose,
  object,
  followers,
  loading,
  user,
  url,
  titleText,
  pleaseLogInText,
  toSeeFollowerText,
  logInText,
  noFollowersText,
  followingSinceText,
}) {
  const { locale } = useContext(UserContext);
  const handleClose = () => {
    onClose();
  };
  return (
    <GenericDialog onClose={handleClose} open={open} title={titleText + " " + object.name}>
      <div>
        {loading ? (
          <LinearProgress />
        ) : !user ? (
          <>
            <Typography>{pleaseLogInText + " " + toSeeFollowerText + "!"}</Typography>
            <LoginButtonContainer>
              <LoginButton
                variant="contained"
                color="primary"
                href={getLocalePrefix(locale) + "/signin?redirect=" + encodeURIComponent(url)}
              >
                {logInText}
              </LoginButton>
            </LoginButtonContainer>
          </>
        ) : followers && followers.length > 0 ? (
          <ProjectFollowers
            followers={followers}
            followingSinceText={followingSinceText}
            locale={locale}
          />
        ) : (
          <Typography>{noFollowersText}</Typography>
        )}
      </div>
    </GenericDialog>
  );
}

const ProjectFollowers = ({ followers, followingSinceText, locale }) => {
  return (
    <>
      <Divider />
      <Table>
        <TableBody>
          {followers.map((f, index) => {
            return (
              <TableRow key={index} /*TODO(undefined) className={classes.follower} */>
                <TableCell>
                  <UserLink
                    href={getLocalePrefix(locale) + "/profiles/" + f.user_profile.url_slug}
                    underline="hover"
                  >
                    <UserAvatar
                      src={getImageUrl(f.user_profile.thumbnail_image)}
                      alt={f.user_profile.first_name + " " + f.user_profile.last_name}
                    />
                    <Username component="span" color="secondary">
                      {f.user_profile.first_name + " " + f.user_profile.last_name}
                    </Username>
                  </UserLink>
                </TableCell>
                <TableCell>
                  <FollowedText>
                    {followingSinceText} <ReactTimeago date={f.created_at} />
                  </FollowedText>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};

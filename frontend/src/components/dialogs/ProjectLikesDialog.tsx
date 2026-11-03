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
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import GenericDialog from "./GenericDialog";
const User = styled(Link)({
  display: "flex",
  alignItems: "center",
});

const UserAvatar = styled(Avatar)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

const Username = styled(Typography)({
  fontWeight: 600,
}) as typeof Typography;

const LikedText = styled(Typography)(({ theme }) => ({
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

export default function ProjectLikesDialog({ open, onClose, project, likes, loading, user, url }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const handleClose = () => {
    onClose();
  };
  return (
    <GenericDialog onClose={handleClose} open={open} title={texts.likes_of + " " + project.name}>
      <div>
        {loading ? (
          <LinearProgress />
        ) : !user ? (
          <>
            <Typography>
              {texts.please_log_in + " " + texts.to_see_this_projects_likes + "!"}
            </Typography>
            <LoginButtonContainer>
              <LoginButton
                variant="contained"
                color="primary"
                href={getLocalePrefix(locale) + "/signin?redirect=" + encodeURIComponent(url)}
              >
                {texts.log_in}
              </LoginButton>
            </LoginButtonContainer>
          </>
        ) : likes && likes.length > 0 ? (
          <ProjectLikes likes={likes} texts={texts} locale={locale} />
        ) : (
          <Typography>{texts.this_project_does_not_have_any_likes_yet}</Typography>
        )}
      </div>
    </GenericDialog>
  );
}
const ProjectLikes = ({ likes, texts, locale }) => {
  return (
    <>
      <Divider />
      <Table>
        <TableBody>
          {likes.map((l, index) => {
            return (
              <TableRow key={index}>
                <TableCell>
                  <User
                    href={getLocalePrefix(locale) + "/profiles/" + l.user_profile.url_slug}
                    underline="hover"
                  >
                    <UserAvatar
                      src={getImageUrl(l.user_profile.thumbnail_image)}
                      alt={l.user_profile.first_name + " " + l.user_profile.last_name}
                    />
                    <Username component="span" color="secondary">
                      {l.user_profile.first_name + " " + l.user_profile.last_name}
                    </Username>
                  </User>
                </TableCell>
                <TableCell>
                  <LikedText>
                    {texts.liking_since} <ReactTimeago date={l.created_at} />
                  </LikedText>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};

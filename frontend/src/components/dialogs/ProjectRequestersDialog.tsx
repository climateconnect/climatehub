import {
  Avatar,
  Button,
  Container,
  Divider,
  IconButton,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import BlockIcon from "@mui/icons-material/Block";
import CheckIcon from "@mui/icons-material/Check";
import React, { useContext, useState } from "react";
import Cookies from "universal-cookie";

// Relative imports
import { apiRequest, getLocalePrefix } from "../../../public/lib/apiOperations";
import { THUMBNAIL_SOURCES, resolveVariantUrl } from "../general/ResponsiveImage";
import { getMembershipRequests } from "../../../public/lib/projectOperations";
import getTexts from "../../../public/texts/texts";
import FeedbackContext from "../context/FeedbackContext";
import UserContext from "../context/UserContext";
import GenericDialog from "./GenericDialog";

const useStyles = makeStyles((theme) => ({
  user: {
    display: "flex",
    alignItems: "center",
  },
  avatar: {
    marginRight: theme.spacing(1),
  },
  username: {
    fontWeight: 600,
  },
  followedText: {
    [theme.breakpoints.down("sm")]: {
      fontSize: 13,
    },
  },
  loginButton: {
    marginTop: theme.spacing(3),
  },
  loginButtonContainer: {
    display: "flex",
    justifyContent: "center",
  },
  noOpenRequestsText: {
    textAlign: "center",
  },
}));

export default function ProjectRequestersDialog({
  loading,
  onClose,
  onRequestersUpdated = () => {},
  open,
  project,
  requesters,
  url = "",
  user,
  user_permission,
}) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });

  const handleClose = () => {
    onClose();
  };

  return (
    <GenericDialog onClose={handleClose} open={open} title={texts.project_requesters_dialog_title}>
      <>
        {
          // If we don't have any permissions, we can't load the join requests
          !user_permission ? (
            <Typography className={classes.noOpenRequestsText}>
              {texts.only_project_admins_can_view_join_requests}
            </Typography>
          ) : loading ? (
            <LinearProgress />
          ) : !user ? (
            <>
              <Typography>
                {texts.please_log_in + " " + texts.to_see_this_projects_requesters + "!"}
              </Typography>
              <Container className={classes.loginButtonContainer}>
                <Button
                  className={classes.loginButton}
                  variant="contained"
                  color="primary"
                  href={getLocalePrefix(locale) + "/signin?redirect=" + encodeURIComponent(url)}
                >
                  {texts.log_in}
                </Button>
              </Container>
            </>
          ) : // If there are users requesting to join and we have permission to view them: render them!
          requesters && requesters.length > 0 ? (
            <ProjectRequesters
              onRequestersUpdated={onRequestersUpdated}
              project={project}
              initialRequesters={requesters}
            />
          ) : (
            <Typography className={classes.noOpenRequestsText}>
              {texts.no_open_project_join_requests}
            </Typography>
          )
        }
      </>
    </GenericDialog>
  );
}

const ProjectRequesters = ({ initialRequesters, onRequestersUpdated, project }) => {
  const [requesters, setRequesters] = useState(initialRequesters);
  const { locale } = useContext(UserContext);
  const cookies = new Cookies();
  const token = cookies.get("auth_token");
  /**
   * After any update is made to approve
   * or reject, we call the backend to update the
   * current list.
   */
  async function handleUpdateRequesters() {
    try {
      const membershipRequests = await getMembershipRequests(project.url_slug, locale, token);
      const updatedRequesters = membershipRequests.map((r) => ({
        requestId: r.id,
        user: r.user_profile,
      }));
      setRequesters(updatedRequesters);
      if (onRequestersUpdated) {
        onRequestersUpdated(updatedRequesters);
      }
    } catch (e) {
      console.log(e);
    }
  }

  return (
    <>
      <Divider />
      <Table>
        <TableBody>
          {requesters.map((requester, index) => {
            return (
              <TableRow key={index}>
                <Requester
                  project={project}
                  locale={locale}
                  requester={requester}
                  requestId={requester.requestId}
                  handleUpdateRequesters={handleUpdateRequesters}
                  token={token}
                />
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
};

/**
 * Separate cohesive component that encapsulates
 * all the requester state and functionality together.
 */
const Requester = ({ handleUpdateRequesters, locale, project, requester, requestId, token }) => {
  const classes = useStyles();
  const { showFeedbackMessage } = useContext(FeedbackContext);
  const texts = getTexts({ page: "general", locale: locale });

  async function handleRequest(approve: boolean): Promise<void> {
    const url = `/api/projects/${project.url_slug}/request_membership/${
      approve ? "approve" : "reject"
    }/${requestId}/`;
    try {
      await apiRequest({
        method: "post",
        url: url,
        locale: locale,
        headers: {
          Authorization: `Token ${token}`,
        },
        payload: {},
      });

      const responseMessage = approve
        ? texts.user_request_approved_successfully
        : texts.user_request_rejected_successfully;

      showFeedbackMessage({
        message: responseMessage,
        success: true,
      });
      // Now notify parent list to update current list
      // of requesters to immediately
      // show the updated state in the UI.
      await handleUpdateRequesters();
    } catch (e: any) {
      if (e?.response?.status === 401) {
        showFeedbackMessage({
          message: texts.no_permission,
          error: true,
        });
      }
      console.log(e);
    }
  }
  return (
    <>
      <TableCell>
        <Link
          className={classes.user}
          href={getLocalePrefix(locale) + "/profiles/" + requester.user.url_slug}
          underline="hover"
        >
          <Avatar
            className={classes.avatar}
            src={resolveVariantUrl(
              requester.user.image_variants,
              THUMBNAIL_SOURCES,
              requester.user.thumbnail_image || requester.user.image
            )}
            alt={requester.user.first_name + " " + requester.user.last_name}
          />
          <Typography component="span" color="secondary" className={classes.username}>
            {requester.user.first_name + " " + requester.user.last_name}
          </Typography>
        </Link>
      </TableCell>

      <TableCell>
        <Tooltip title="Approve">
          <IconButton
            aria-label="approve project request"
            color="primary"
            disableRipple
            onClick={() => handleRequest(true)}
            size="large"
          >
            <CheckIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Deny">
          <IconButton
            aria-label="deny project request"
            disableRipple
            onClick={() => handleRequest(false)}
            size="large"
          >
            <BlockIcon />
          </IconButton>
        </Tooltip>
      </TableCell>
    </>
  );
};

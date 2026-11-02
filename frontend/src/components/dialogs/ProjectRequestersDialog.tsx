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
import { styled } from "@mui/material/styles";
import BlockIcon from "@mui/icons-material/Block";
import CheckIcon from "@mui/icons-material/Check";
import React, { useContext, useState } from "react";
import Cookies from "universal-cookie";

// Relative imports
import { apiRequest, getLocalePrefix } from "../../../public/lib/apiOperations";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { getMembershipRequests } from "../../../public/lib/projectOperations";
import getTexts from "../../../public/texts/texts";
import FeedbackContext from "../context/FeedbackContext";
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

const LoginButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(3),
}));

const LoginButtonContainer = styled(Container)({
  display: "flex",
  justifyContent: "center",
});

const NoOpenRequestsText = styled(Typography)({
  textAlign: "center",
});

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
            <NoOpenRequestsText>
              {texts.only_project_admins_can_view_join_requests}
            </NoOpenRequestsText>
          ) : loading ? (
            <LinearProgress />
          ) : !user ? (
            <>
              <Typography>
                {texts.please_log_in + " " + texts.to_see_this_projects_requesters + "!"}
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
          ) : // If there are users requesting to join and we have permission to view them: render them!
          requesters && requesters.length > 0 ? (
            <ProjectRequesters
              onRequestersUpdated={onRequestersUpdated}
              project={project}
              initialRequesters={requesters}
            />
          ) : (
            <NoOpenRequestsText>{texts.no_open_project_join_requests}</NoOpenRequestsText>
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
        <User
          href={getLocalePrefix(locale) + "/profiles/" + requester.user.url_slug}
          underline="hover"
        >
          <UserAvatar
            src={getImageUrl(requester.user.image)}
            alt={requester.user.first_name + " " + requester.user.last_name}
          />
          <Username component="span" color="secondary">
            {requester.user.first_name + " " + requester.user.last_name}
          </Username>
        </User>
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

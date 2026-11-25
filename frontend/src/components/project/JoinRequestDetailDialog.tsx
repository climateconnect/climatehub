import {
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Link,
  LinearProgress,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { useRouter } from "next/router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import Cookies from "universal-cookie";

import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { appHref } from "../../../public/lib/appLink";
import { getImageUrl } from "../../../public/lib/imageOperations";
import {
  decideJoinRequest,
  getJoinRequest,
  JoinRequestDetail,
  respondToJoinRequest,
} from "../../../public/lib/joinRequestOperations";
import getTexts from "../../../public/texts/texts";
import FeedbackContext from "../context/FeedbackContext";
import { HubContext } from "../context/HubContext";
import UserContext from "../context/UserContext";
import { useFeatureToggles } from "../featureToggle";
import GenericDialog from "../dialogs/GenericDialog";

const Section = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const ProfileLink = styled(Link)({
  display: "flex",
  alignItems: "center",
});

const ProfileAvatar = styled(Avatar)(({ theme }) => ({
  marginRight: theme.spacing(1.5),
}));

const MessageText = styled(Typography)({
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
});

const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  justifyContent: "flex-end",
  marginTop: theme.spacing(3),
}));

type Props = {
  open: boolean;
  projectUrlSlug: string;
  requestId: number | string | null;
  onClose: () => void;
  // called after a successful approve/decline so the parent can refresh lists
  // eslint-disable-next-line no-unused-vars
  onDecided?: (action: "approve" | "reject") => void;
};

type LoadError = "not_found" | "no_permission" | "other" | null;

const STATUS_COLOR = { pending: "warning", approved: "success", rejected: "error" } as const;

export default function JoinRequestDetailDialog({
  open,
  projectUrlSlug,
  requestId,
  onClose,
  onDecided,
}: Props) {
  const { user, locale } = useContext(UserContext);
  const { showFeedbackMessage } = useContext(FeedbackContext);
  const { hubUrl } = useContext(HubContext);
  const texts = getTexts({ page: "project", locale: locale });
  const generalTexts = getTexts({ page: "general", locale: locale });
  const token = new Cookies().get("auth_token");

  const [request, setRequest] = useState<JoinRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadError>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { isEnabled } = useFeatureToggles();
  const respondEnabled = isEnabled("PROJECT_JOIN_REQUEST_RESPOND_CHAT", false);
  const [responding, setResponding] = useState(false);
  const [respondError, setRespondError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRequest(null);
    try {
      setRequest(await getJoinRequest(projectUrlSlug, requestId, locale, token));
    } catch (e: any) {
      const code = e?.response?.status;
      setError(
        code === 404 ? "not_found" : code === 403 || code === 401 ? "no_permission" : "other"
      );
    } finally {
      setLoading(false);
    }
  }, [projectUrlSlug, requestId, locale, token]);

  useEffect(() => {
    if (open && requestId != null && user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requestId, !!user]);

  const isAdmin = !!request?.is_admin;

  const handleDecision = async (action: "approve" | "reject") => {
    if (submitting || !request) return;
    setSubmitting(true);
    try {
      await decideJoinRequest(projectUrlSlug, request.id, action, locale, token);
      showFeedbackMessage({
        message:
          action === "approve"
            ? generalTexts.user_request_approved_successfully
            : generalTexts.user_request_rejected_successfully,
        success: true,
      });
      onDecided?.(action);
      // reload to show the new status (and the deciding admin)
      await load();
    } catch (e: any) {
      const code = e?.response?.status;
      showFeedbackMessage({
        message:
          code === 401 || code === 403
            ? generalTexts.no_permission
            : code === 409
            ? texts.join_request_already_decided
            : texts.join_request_decision_error,
        error: true,
      });
      if (code === 409) await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async () => {
    if (responding || !request) return;
    setResponding(true);
    setRespondError(false);
    try {
      const { chat_uuid } = await respondToJoinRequest(projectUrlSlug, request.id, locale, token);
      router.push(`${getLocalePrefix(locale)}/chat/${chat_uuid}/`);
    } catch (e: any) {
      console.log(e);
      setRespondError(true);
      setResponding(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(locale, { dateStyle: "medium" } as any);

  const profileHref = (slug: string) => getLocalePrefix(locale) + "/profiles/" + slug;
  const fullName = (p) => `${p.first_name} ${p.last_name}`;

  let content: React.ReactNode;
  if (!user) {
    content = (
      <>
        <Typography>{texts.join_request_please_log_in}</Typography>
        <Actions>
          <Button
            variant="contained"
            href={appHref(
              "/signin?redirect=" +
                encodeURIComponent(
                  typeof window !== "undefined"
                    ? window.location.pathname + window.location.search + window.location.hash
                    : ""
                ),
              { hubUrl, locale }
            )}
          >
            {generalTexts.log_in}
          </Button>
        </Actions>
      </>
    );
  } else if (loading || (!request && !error)) {
    content = <LinearProgress aria-label={texts.join_request_loading} />;
  } else if (error === "not_found") {
    content = <Typography>{texts.join_request_not_found}</Typography>;
  } else if (error === "no_permission") {
    content = <Typography>{texts.join_request_no_permission}</Typography>;
  } else if (error || !request) {
    content = <Typography>{texts.join_request_load_error}</Typography>;
  } else {
    const decided = request.request_status !== "pending";
    const statusLabel = texts[`join_request_status_${request.request_status}`];
    content = (
      <>
        <Section>
          <ProfileLink href={profileHref(request.user_profile.url_slug)} underline="hover">
            <ProfileAvatar
              src={getImageUrl(request.user_profile.image)}
              alt={fullName(request.user_profile)}
            />
            <div>
              <Typography fontWeight={600} color="secondary">
                {fullName(request.user_profile)}
              </Typography>
              {request.user_profile.location && (
                <Typography variant="body2" color="text.secondary">
                  {request.user_profile.location}
                </Typography>
              )}
            </div>
          </ProfileLink>
        </Section>
        <Section>
          <Typography>
            <Typography component="span" color="text.secondary">
              {texts.join_request_requested_on}:
            </Typography>{" "}
            {formatDate(request.requested_at)}
          </Typography>
        </Section>
        <Section>
          <Chip
            label={
              decided && request.decided_at
                ? `${statusLabel} ${texts.join_request_decided_on} ${formatDate(
                    request.decided_at
                  )}`
                : statusLabel
            }
            color={STATUS_COLOR[request.request_status]}
            size="small"
          />
          {isAdmin && decided && request.decided_by && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {request.request_status === "approved"
                ? texts.join_request_approved_by
                : texts.join_request_rejected_by}{" "}
              <Link href={profileHref(request.decided_by.url_slug)} underline="hover">
                {fullName(request.decided_by)}
              </Link>
            </Typography>
          )}
        </Section>
        <Section>
          <Typography variant="body2" color="text.secondary">
            {texts.join_request_message}
          </Typography>
          {request.message ? (
            <MessageText>{request.message}</MessageText>
          ) : (
            <Typography fontStyle="italic" color="text.secondary">
              {texts.join_request_no_message}
            </Typography>
          )}
        </Section>
        {isAdmin && respondEnabled && (
          <Section>
            {request.response_chat_uuid && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <ChatBubbleOutlineIcon
                  fontSize="inherit"
                  sx={{ verticalAlign: "middle", marginRight: 0.5 }}
                />
                {texts.join_request_conversation_started}
              </Typography>
            )}
            <Button
              variant="outlined"
              disabled={responding}
              aria-busy={responding}
              onClick={handleRespond}
              startIcon={responding ? <CircularProgress size={14} /> : undefined}
            >
              {texts.respond_to_join_request}
            </Button>
            {respondError && (
              <Typography color="error" variant="caption" role="alert" component="div">
                {texts.could_not_start_join_request_chat}
              </Typography>
            )}
          </Section>
        )}
        {isAdmin && !decided && (
          <Actions>
            <Button
              variant="outlined"
              disabled={submitting}
              onClick={() => handleDecision("reject")}
            >
              {texts.join_request_decline}
            </Button>
            <Button
              variant="contained"
              disabled={submitting}
              onClick={() => handleDecision("approve")}
            >
              {texts.join_request_approve}
            </Button>
          </Actions>
        )}
      </>
    );
  }

  return (
    <GenericDialog
      open={open}
      onClose={onClose}
      title={texts.join_request_detail_title}
      maxWidth="sm"
    >
      {content}
    </GenericDialog>
  );
}

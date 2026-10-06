import { Avatar, Button, CircularProgress, Link, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import React, { useContext, useEffect, useRef, useState } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ConfirmDialog from "../dialogs/ConfirmDialog";
import ProfileBadge from "../profile/ProfileBadge";
import DateDisplay from "./../general/DateDisplay";
import CommentInput from "./CommentInput";
import MessageContent from "./MessageContent";
import Posts from "./Posts";

const PostDate = styled(Typography)(({ theme }) => ({
  color: theme.palette.grey[700],
}));

const CommentFlexBox = styled("div", {
  shouldForwardProp: (prop) => !String(prop).startsWith("$"),
})<{ $preview?: boolean }>(({ $preview }) => ({
  display: "flex",
  alignItems: $preview ? "center" : "stretch",
}));

const MessageWithMetaData = styled("span")({
  minWidth: 0,
  overflowWrap: "break-word",
});

const PostAvatar = styled(Avatar)(({ theme }) => ({
  marginRight: theme.spacing(2),
}));

const Username = styled(Typography)(({ theme }) => ({
  fontWeight: "bold",
  marginRight: theme.spacing(0.5),
}));

const Metadata = styled("div")({
  display: "flex",
  alignItems: "center",
});

const ReplyButton = styled(Button)(({ theme }) => ({
  color: theme.palette.grey[700],
}));

const ToggleLink = styled(Link)({
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
});

const InlineBadge = styled(ProfileBadge)(({ theme }) => ({
  marginRight: theme.spacing(0.5),
}));

const DeleteButton = styled(Button)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

const ContentText = styled(Typography, {
  shouldForwardProp: (prop) => !String(prop).startsWith("$"),
})<{ $truncated?: boolean }>(({ $truncated }) => ({
  ...($truncated && {
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
  }),
}));

export default function Post({
  post,
  type,
  className,
  maxLines,
  user,
  onSendComment,
  onDeletePost,
  infoTextSize,
  truncate,
  noLink,
  hubUrl,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "communication", locale: locale });
  const [open, setOpen] = useState(false);
  const [displayReplies, setDisplayReplies] = useState(true);
  const [replyInterfaceExpanded, setInterfaceExpanded] = useState(false);
  const expandReplyInterface = () => setInterfaceExpanded(true);
  const unexpandReplyInterface = () => setInterfaceExpanded(false);

  const handleViewRepliesClick = () => {
    setDisplayReplies(!displayReplies);
  };

  const handleSendComment = (curComment, parent_comment, clearInput) => {
    onSendComment(curComment, parent_comment, clearInput, setDisplayReplies);
  };

  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [isTextTruncated, setIsTextTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Don't measure in preview mode or when the user has already expanded the text.
    // When expanded there is no clamp, so scrollHeight === clientHeight and the
    // measurement would incorrectly clear the truncated flag.
    if (type === "preview" || isTextExpanded || !contentRef.current) return;

    const element = contentRef.current;

    const checkTruncation = () => {
      // clientHeight is 0 when the element is inside a hidden tab panel –
      // skip the measurement and wait for the ResizeObserver to fire once
      // the panel becomes visible.
      if (element.clientHeight > 0) {
        setIsTextTruncated(element.scrollHeight > element.clientHeight);
      }
    };

    // Check immediately for the case where the element is already visible.
    checkTruncation();

    // Re-check whenever the element's size changes:
    //   • the tab panel transitions from hidden → visible (clientHeight: 0 → N)
    //   • web fonts finish loading and reflow the text
    //   • the viewport is resized
    const observer = new ResizeObserver(checkTruncation);
    observer.observe(element);

    return () => observer.disconnect();
  }, [post.content, type, isTextExpanded]);

  const handleExpandText = () => {
    setIsTextExpanded(!isTextExpanded);
  };

  const toggleDeleteDialogOpen = () => setOpen(!open);

  const onConfirmDialogClose = (confirmed) => {
    setOpen(false);
    if (confirmed) onDeletePost(post);
  };

  const handleClick = (element) => noLink && element.preventDefault();
  const avatarProps = {
    src: post.author_user.image
      ? getImageUrl(post.author_user.image)
      : getImageUrl(post.author_user.thumbnail_image),
  };
  const queryString = hubUrl ? "?hub=" + hubUrl : "";

  return (
    <div className={className}>
      {type === "progresspost" ? (
        <Typography
          component="h3"
          variant="h6"
          color="primary" /*TODO(undefined) className={classes.nameOfPoster} */
        >
          {post.author_user.first_name + " " + post.author_user.last_name}
        </Typography>
      ) : (
        <CommentFlexBox $preview={type === "preview"}>
          <Link
            href={getLocalePrefix(locale) + `/profiles/${post.author_user.url_slug}${queryString}`}
            target="_blank"
            onClick={handleClick}
            underline="hover"
          >
            <PostAvatar {...avatarProps} />
          </Link>
          <MessageWithMetaData>
            <Metadata>
              <Link
                color="inherit"
                href={
                  getLocalePrefix(locale) + `/profiles/${post.author_user.url_slug}${queryString}`
                }
                target="_blank"
                onClick={handleClick}
                underline="hover"
              >
                <Username variant="body2">
                  {post.author_user.first_name + " " + post.author_user.last_name}
                </Username>
              </Link>
              {post.author_user.badges?.length > 0 && (
                <InlineBadge contentOnly badge={post.author_user.badges[0]} size="medium" />
              )}
              <PostDate variant="body2">
                {post.unconfirmed && (
                  <Tooltip title={texts.sending_message + "..."}>
                    <CircularProgress
                      size={10}
                      color="inherit" /*TODO(undefined) className={classes.loader} */
                    />
                  </Tooltip>
                )}
                <DateDisplay date={new Date(post.created_at)} />
              </PostDate>
            </Metadata>
            {type === "preview" ? (
              <ContentText $truncated style={{ WebkitLineClamp: truncate }}>
                <MessageContent content={post.content} /*TODO(unused) maxLines={maxLines} */ />
              </ContentText>
            ) : (
              <div>
                <ContentText
                  ref={contentRef}
                  $truncated={!isTextExpanded}
                  style={!isTextExpanded ? { WebkitLineClamp: 3 } : undefined}
                >
                  <MessageContent content={post.content} /*TODO(unused) maxLines={maxLines} */ />
                </ContentText>

                {isTextTruncated && (
                  <ToggleLink onClick={handleExpandText} underline="hover">
                    {!isTextExpanded ? texts.read_more : texts.read_less}
                  </ToggleLink>
                )}
              </div>
            )}
            <>
              {type !== "reply" &&
                type !== "preview" &&
                (replyInterfaceExpanded ? (
                  <CommentInput
                    user={user}
                    onSendComment={handleSendComment}
                    parent_comment={post.id}
                    onCancel={unexpandReplyInterface}
                    infoTextSize={infoTextSize}
                  />
                ) : (
                  <ReplyButton onClick={expandReplyInterface}>{texts.reply}</ReplyButton>
                ))}
              {user && user.id === post.author_user.id && type !== "preview" && (
                <DeleteButton onClick={toggleDeleteDialogOpen}>{texts.delete}</DeleteButton>
              )}
            </>
            <>
              {type !== "reply" && !!post.replies && post.replies.length > 0 && type !== "preview" && (
                <ToggleLink onClick={handleViewRepliesClick} underline="hover">
                  {!displayReplies ? (
                    <>
                      <ExpandMoreIcon />
                      {texts.show_replies}
                    </>
                  ) : (
                    <>
                      <ExpandLessIcon />
                      {texts.hide_replies}
                    </>
                  )}
                </ToggleLink>
              )}
            </>
          </MessageWithMetaData>
        </CommentFlexBox>
      )}
      <>
        {post.replies &&
          post.replies.length > 0 &&
          displayReplies &&
          (type === "openingpost" || type === "progresspost") &&
          type !== "preview" && (
            <Posts
              posts={post.replies}
              type="reply"
              user={user}
              maxLines={maxLines}
              onDeletePost={onDeletePost}
              infoTextSize={infoTextSize}
            />
          )}
      </>
      <ConfirmDialog
        open={open}
        onClose={onConfirmDialogClose}
        title={texts.delete_comment}
        text={texts.do_you_really_want_to_delete_this_comment}
        confirmText={texts.yes}
        cancelText={texts.no}
      />
    </div>
  );
}

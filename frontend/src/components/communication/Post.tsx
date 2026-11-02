import { Avatar, Button, CircularProgress, Link, Theme, Tooltip, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import React, { useContext, useEffect, useRef, useState } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { THUMBNAIL_SOURCES, resolveVariantUrl } from "../general/ResponsiveImage";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ConfirmDialog from "../dialogs/ConfirmDialog";
import ProfileBadge from "../profile/ProfileBadge";
import DateDisplay from "./../general/DateDisplay";
import CommentInput from "./CommentInput";
import MessageContent from "./MessageContent";
import Posts from "./Posts";

const useStyles = makeStyles<Theme, { preview?: boolean }>((theme) => ({
  postDate: {
    color: theme.palette.grey[700],
  },
  commentFlexBox: (props) => ({
    display: "flex",
    alignItems: props.preview ? "center" : "stretch",
  }),
  messageWithMetaData: {
    minWidth: 0,
    overflowWrap: "break-word",
  },
  avatar: {
    marginRight: theme.spacing(2),
  },
  username: {
    fontWeight: "bold",
    marginRight: theme.spacing(0.5),
  },
  metadata: {
    display: "flex",
    alignItems: "center",
  },
  message: {
    lineHeight: 1.2,
  },
  content: {
    wordBreak: "break-word",
    fontSize: 14,
    whiteSpace: "pre-wrap",
  },
  toggleExpanded: {
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    color: theme.palette.grey[700],
  },
  replyButton: {
    color: theme.palette.grey[700],
  },
  toggleReplies: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  },
  inlineBadge: {
    marginRight: theme.spacing(0.5),
  },
  commentBox: {
    display: "flex",
  },
  deleteButton: {
    color: theme.palette.background.default_contrastText,
  },
  truncatedContent: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
  },
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
  const classes = useStyles({ preview: type === "preview" });

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
    src: resolveVariantUrl(
      post.author_user.image_variants,
      THUMBNAIL_SOURCES,
      post.author_user.thumbnail_image || post.author_user.image
    ),
    className: classes.avatar,
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
        <div className={classes.commentFlexBox}>
          <Link
            href={getLocalePrefix(locale) + `/profiles/${post.author_user.url_slug}${queryString}`}
            target="_blank"
            onClick={handleClick}
            underline="hover"
          >
            <Avatar {...avatarProps} />
          </Link>
          <span className={classes.messageWithMetaData}>
            <div className={classes.metadata}>
              <Link
                color="inherit"
                href={
                  getLocalePrefix(locale) + `/profiles/${post.author_user.url_slug}${queryString}`
                }
                target="_blank"
                onClick={handleClick}
                underline="hover"
              >
                <Typography variant="body2" className={classes.username}>
                  {post.author_user.first_name + " " + post.author_user.last_name}
                </Typography>
              </Link>
              {post.author_user.badges?.length > 0 && (
                <ProfileBadge
                  contentOnly
                  badge={post.author_user.badges[0]}
                  size="medium"
                  className={classes.inlineBadge}
                />
              )}
              <Typography variant="body2" className={classes.postDate}>
                {post.unconfirmed && (
                  <Tooltip title={texts.sending_message + "..."}>
                    <CircularProgress
                      size={10}
                      color="inherit" /*TODO(undefined) className={classes.loader} */
                    />
                  </Tooltip>
                )}
                <DateDisplay date={new Date(post.created_at)} />
              </Typography>
            </div>
            {type === "preview" ? (
              <Typography
                className={classes.truncatedContent}
                style={{ WebkitLineClamp: truncate }}
              >
                <MessageContent content={post.content} /*TODO(unused) maxLines={maxLines} */ />
              </Typography>
            ) : (
              <div>
                <Typography
                  ref={contentRef}
                  className={!isTextExpanded ? classes.truncatedContent : undefined}
                  style={!isTextExpanded ? { WebkitLineClamp: 3 } : undefined}
                >
                  <MessageContent content={post.content} /*TODO(unused) maxLines={maxLines} */ />
                </Typography>

                {isTextTruncated && (
                  <Link
                    className={classes.toggleReplies}
                    onClick={handleExpandText}
                    underline="hover"
                  >
                    {!isTextExpanded ? texts.read_more : texts.read_less}
                  </Link>
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
                  <Button onClick={expandReplyInterface} className={classes.replyButton}>
                    {texts.reply}
                  </Button>
                ))}
              {user && user.id === post.author_user.id && type !== "preview" && (
                <Button onClick={toggleDeleteDialogOpen} className={classes.deleteButton}>
                  {texts.delete}
                </Button>
              )}
            </>
            <>
              {type !== "reply" && !!post.replies && post.replies.length > 0 && type !== "preview" && (
                <Link
                  className={classes.toggleReplies}
                  onClick={handleViewRepliesClick}
                  underline="hover"
                >
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
                </Link>
              )}
            </>
          </span>
        </div>
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

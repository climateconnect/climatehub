import { Divider, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";

// Relative imports
import { apiRequest } from "../../../public/lib/apiOperations";
import { getCommentsObjectAfterAddingComment } from "../../../public/lib/communicationOperations";
import getTexts from "../../../public/texts/texts";
import CommentInput from "../communication/CommentInput";
import UserContext from "../context/UserContext";
import Posts from "./../communication/Posts";

const StyledDivider = styled(Divider)(({ theme }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

export default function CommentsContent({ user, project, token, setCurComments, hubUrl }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const comments = project.comments;

  const handleRemoveComment = (comment) => {
    // removing a top comment
    if (comment.parent_comment_id === null) {
      setCurComments([...project.comments.filter((pc) => pc.id !== comment.id)]);

      // remove a comment that has a parent comment
    } else {
      const tempProjectComments = project.comments;
      const parentCommentIndex = tempProjectComments.findIndex(
        (c) => c.id === comment.parent_comment_id
      );
      const filterOutReplies = [
        ...tempProjectComments[parentCommentIndex].replies.filter((pc) => pc.id !== comment.id),
      ];
      tempProjectComments[parentCommentIndex].replies = filterOutReplies;
      setCurComments([...tempProjectComments]);
    }
  };

  const handleAddComment = (c) => {
    setCurComments(getCommentsObjectAfterAddingComment(c, project.comments));
  };

  const onSendComment = async (curComment, parent_comment, clearInput, setDisplayReplies) => {
    const comment = curComment;
    const payload = { content: comment, project: project.id };
    handleAddComment({
      parent_comment_id: parent_comment,
      id: null,
      author_user: user,
      content: comment,
      created_at: new Date(),
      replies: [],
      unconfirmed: true,
    });
    clearInput();
    if (parent_comment) payload.parent_comment = parent_comment;
    try {
      const resp = await apiRequest({
        url: "/api/projects/" + project.url_slug + "/comment/",
        payload: payload,
        method: "post",
        token: token,
        locale: locale,
      });
      handleAddComment(resp.data.comment);
      if (setDisplayReplies) setDisplayReplies(true);
    } catch (err) {
      console.log(err);
      if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
      return null;
    }
  };

  const onDeleteComment = async (post) => {
    try {
      await apiRequest({
        method: "delete",
        url: "/api/projects/" + project.url_slug + "/comment/" + post.id + "/",
        token: token,
        locale: locale,
      });
      handleRemoveComment(post);
    } catch (err) {
      console.log(err);
      if (err.response && err.response.data) console.log("Error: " + err.response.data.detail);
      return null;
    }
  };

  return (
    <div>
      <CommentInput user={user} onSendComment={onSendComment} hasComments={comments.length > 0} />
      <Typography>{comments.length + " " + texts.comments}</Typography>
      <StyledDivider />
      {comments && comments.length > 0 && (
        <Posts
          posts={comments}
          type="openingpost"
          maxLines={4}
          user={user}
          onSendComment={onSendComment}
          onDeletePost={onDeleteComment}
          hubUrl={hubUrl}
        />
      )}
    </div>
  );
}

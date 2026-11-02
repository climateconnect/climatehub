import { styled } from "@mui/material/styles";
import React from "react";

import Post from "./Post";

const PostsWrapper = styled("div", {
  shouldForwardProp: (prop) => !String(prop).startsWith("$"),
})<{ $type?: string }>(({ theme, $type }) => {
  if ($type === "reply") {
    return { marginLeft: theme.spacing(4) };
  }
  if ($type === "openingpost") {
    return { margin: 0 };
  }
  if ($type === "progresspost") {
    return {
      marginLeft: theme.spacing(4),
      paddingBottom: theme.spacing(6),
      borderLeft: `2px solid ${theme.palette.primary.main}`,
    };
  }
  return {};
});

const StyledPost = styled(Post, {
  shouldForwardProp: (prop) => !String(prop).startsWith("$"),
})<{ $progressPost?: boolean; $firstPost?: boolean }>(({ theme, $progressPost, $firstPost }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
  ...($progressPost && {
    paddingLeft: theme.spacing(10),
    position: "relative",
    paddingBottom: theme.spacing(10),
    "&::before": {
      content: '""',
      height: 20,
      width: 20,
      backgroundColor: theme.palette.primary.main,
      borderRadius: 10,
      fontSize: 100,
      position: "absolute",
      top: 0,
      left: -10,
      ...($firstPost && {
        width: 40,
        height: 40,
        borderRadius: 20,
        left: -20,
        //10.1 margin to prevent visual glitch with line showing over dot
        top: -10.1,
        border: `10px solid #D7E2E4`,
        zIndex: -1,
      }),
    },
  }),
}));

//@type: possible values are "openingpost", "reply", "progresspost", "preview"
export default function Posts({
  posts,
  type,
  maxLines,
  user,
  onSendComment,
  onDeletePost,
  infoTextSize,
  truncate,
  noLink,
  hubUrl,
}: any) {
  return (
    <PostsWrapper $type={type}>
      {posts &&
        posts.map((post, index) => (
          <StyledPost
            key={index}
            post={post}
            $progressPost={type === "progresspost"}
            $firstPost={index === 0 && type === "progresspost"}
            type={type}
            maxLines={maxLines}
            user={user}
            onSendComment={onSendComment}
            onDeletePost={onDeletePost}
            infoTextSize={infoTextSize}
            truncate={truncate}
            noLink={noLink}
            hubUrl={hubUrl}
          />
        ))}
    </PostsWrapper>
  );
}

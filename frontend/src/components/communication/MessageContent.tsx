import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { string } from "prop-types";
import React, { useContext } from "react";
import Linkify from "react-linkify";
import YouTube from "react-youtube";
import youtubeRegex from "youtube-regex";
import { getFragmentsWithMentions } from "../../utils/mentions_markdown";
import UserContext from "../context/UserContext";

const MessageLink = styled("a")({
  color: "inherit",
  "&:visited": {
    color: "inherit",
  },
});

const YoutubeWrapper = styled("div")({
  maxWidth: "640px",
});

const MessageText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$received",
})<{ $received?: boolean }>(({ theme, $received }) => ({
  alignSelf: "flex-start",
  color: $received ? "default" : theme?.palette?.primary?.contrastText,
}));

type Props = {
  content?: any;
  renderYoutubeVideos?: boolean;
  received?: boolean;
};

export default function MessageContent({ content, renderYoutubeVideos = false, received }: Props) {
  const { locale } = useContext(UserContext);
  //workaround to get target="_blank" because setting 'properties' on the Linkify component doesn't work
  const componentDecorator = (href, text, key) => (
    <MessageLink href={href} key={key} target="_blank" rel="noopener noreferrer">
      {text}
    </MessageLink>
  );

  const opts = {
    width: "100%",
    host: "https://www.youtube-nocookie.com",
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 0,
    },
  };

  const getFirstYouTubeVideosLines = (content) => {
    const allLines = content.split("\n");
    const youtubeLines = allLines
      .filter((w) => w.length > 0 && youtubeRegex().test(w))
      .map((line, lineIndex) => {
        const words = line.split(" ");
        const enrichedLine = words.map((w, wordIndex) => {
          const uniqueKey = `${lineIndex}-${wordIndex}`;
          if (youtubeRegex().test(w)) {
            let video_id = YouTubeGetID(w);
            const ampersandPosition = video_id.indexOf("&");
            if (ampersandPosition !== -1) video_id = video_id.substring(0, ampersandPosition);
            return (
              <YoutubeWrapper key={uniqueKey}>
                <YouTube videoId={video_id} opts={opts as any} />
              </YoutubeWrapper>
            );
          } else {
            return (
              <Linkify key={uniqueKey} componentDecorator={componentDecorator}>
                {w + " "}
              </Linkify>
            );
          }
        });
        return {
          content: enrichedLine,
          index: allLines.indexOf(line),
        };
      });
    return youtubeLines.filter((l, index) => index < renderYoutubeVideos);
  };

  function YouTubeGetID(url) {
    var ID = "";
    url = url.replace(/(>|<)/gi, "").split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
    if (url[2] !== undefined) {
      // TODO: confirm this escape character is required
      // eslint-disable-next-line no-useless-escape
      ID = url[2].split(/[^0-9a-z_\-]/i);
      ID = ID[0];
    } else {
      ID = url;
    }
    return ID;
  }

  const youtubeVideoLines = renderYoutubeVideos ? getFirstYouTubeVideosLines(content) : null;

  return (
    <Linkify componentDecorator={componentDecorator}>
      {content
        ? content.split("\n").map((content, index) => {
            if (!content.length) return <br key={index} />;
            if (youtubeVideoLines && youtubeVideoLines.find((l) => l.index === index)) {
              return (
                <div key={index}>{youtubeVideoLines.find((l) => l.index === index).content}</div>
              );
            }
            const fragments = getFragmentsWithMentions(content, true, locale);
            return (
              <div key={index}>
                <MessageText display="inline" $received={received}>
                  {fragments}
                </MessageText>
              </div>
            );
          })
        : null}
    </Linkify>
  );
}

MessageContent.propTypes = {
  content: string.isRequired,
};

import { styled } from "@mui/material/styles";
import { LinkedHub } from "../../types";
import Link from "next/link";
import { Theme, useMediaQuery } from "@mui/material";

const LinkedHubsContainer = styled(Link, {
  shouldForwardProp: (prop) => prop !== "$isNarrowScreen",
})<{ $isNarrowScreen: boolean }>(({ $isNarrowScreen }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  textDecoration: "none",
  width: $isNarrowScreen ? "100px" : "100%",
  minWidth: $isNarrowScreen ? "100px" : "auto",
  maxWidth: "200px",
  cursor: "pointer",
  transition: "transform 0.2s ease-out",
  "&:hover": {
    transform: "scale(1.05)",
  },
  flexShrink: 0,
  flex: 1,
}));

const IconContainer = styled("div")({
  position: "absolute",
  left: "50%",
  top: -8,
  transform: "translateX(-50%) translateY(0)",
  alignItems: "center",
  justifyContent: "center",
  width: "50px",
  height: "50px",
  borderRadius: "50%",
});

const Icon = styled("img")({
  color: "white",
  width: 50,
  border: "3px solid white",
  borderRadius: "100%",
});

const Title = styled("h3", {
  shouldForwardProp: (prop) => prop !== "$isNarrowScreen",
})<{ $isNarrowScreen: boolean }>(({ theme, $isNarrowScreen }) => ({
  fontSize: "1.2rem",
  fontWeight: "bold",
  textAlign: "center",
  color: "black",
  width: "100%",
  textDecoration: "none !important",
  backgroundColor: "#EFF5F2",
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(1),
  marginBottom: 0,
  borderRadius: theme.shape.borderRadius,
  ...($isNarrowScreen && {
    fontSize: ".8rem",
    fontWeight: "500",
    lineHeight: "15px",
    paddingRight: theme.spacing(0.8),
    paddingLeft: theme.spacing(0.8),
  }),
}));

export default function HubLinkButton({
  hub,
  pageContext = "browse",
  activeTab,
}: {
  hub: LinkedHub;
  pageContext?: "browse" | "events";
  activeTab?: string;
}) {
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));

  const getLinkUrl = () => {
    if (pageContext === "events") {
      return hub.hubUrl.replace(/\/(browse|projects)$/, "/events");
    }
    if (activeTab && /\/(browse|projects)$/.test(hub.hubUrl)) {
      const tabPath = activeTab === "projects" ? "browse" : activeTab;
      return hub.hubUrl.replace(/\/(browse|projects)$/, `/${tabPath}`);
    }
    const hash = window.location.hash;
    return `${hub.hubUrl}${hash}`;
  };
  const linkUrl = getLinkUrl();
  return (
    <LinkedHubsContainer href={linkUrl} $isNarrowScreen={isNarrowScreen}>
      <IconContainer>
        <Icon src={hub.icon} alt="hub icon" />
      </IconContainer>
      <Title $isNarrowScreen={isNarrowScreen}>{hub.hubName}</Title>
    </LinkedHubsContainer>
  );
}

import makeStyles from "@mui/styles/makeStyles";
import { LinkedHub } from "../../types";
import Link from "next/link";
import { Theme, useMediaQuery } from "@mui/material";

interface StyleProps {
  backgroundColor: string;
  iconUrl: string;
  isNarrowScreen: boolean;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) => {
  return {
    linkedHubsContainer: {
      position: "relative",
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      textDecoration: "none",
      width: (props) => (props.isNarrowScreen ? "100px" : "100%"),
      minWidth: (props) => (props.isNarrowScreen ? "100px" : "auto"),
      maxWidth: "200px",
      cursor: "pointer",
      transition: "transform 0.2s ease-out",
      "&:hover": {
        transform: "scale(1.05)",
      },
      flexShrink: 0,
      flex: 1,
    },
    title: {
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
    },
    iconContainer: {
      position: "absolute",
      left: "50%",
      top: -8,
      transform: "translateX(-50%) translateY(0)",
      alignItems: "center",
      justifyContent: "center",
      width: "50px",
      height: "50px",
      borderRadius: "50%",
    },
    icon: {
      color: "white",
      width: 50,
      border: "3px solid white",
      borderRadius: "100%",
    },

    iconWrapper: {
      width: "70%",
      height: "70%",
      margin: "15%",
      backgroundColor: "lightgray", // this becomes the stroke/fill color
      maskImage: (props) => `url(${props.iconUrl})`,
      maskRepeat: "no-repeat",
      maskSize: "contain",
      maskPosition: "center",
      WebkitMaskImage: (props) => `url(${props.iconUrl})`,
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      WebkitMaskPosition: "center",
    },
    titleOnNarrowScreen: {
      fontSize: ".8rem",
      fontWeight: "500",
      lineHeight: "15px",
      paddingRight: theme.spacing(0.8),
      paddingLeft: theme.spacing(0.8),
    },
  };
});

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
  const backgroundColor = hub.backgroundColor || "lightblue";

  const classes = useStyles({ backgroundColor, iconUrl: hub.icon, isNarrowScreen });
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
    <Link href={linkUrl} className={classes.linkedHubsContainer}>
      <div className={classes.iconContainer}>
        <img className={classes.icon} src={hub.icon} alt="hub icon" />
      </div>
      <h3
        className={
          isNarrowScreen ? `${classes.title} ${classes.titleOnNarrowScreen}` : classes.title
        }
      >
        {hub.hubName}
      </h3>
    </Link>
  );
}

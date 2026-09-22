import { Box, Theme, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import FacebookIcon from "@mui/icons-material/Facebook";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GitHubIcon from "@mui/icons-material/GitHub";
import InstagramIcon from "@mui/icons-material/Instagram";
import YouTubeIcon from "@mui/icons-material/YouTube";
import React, { useContext } from "react";
import AppLink from "../general/AppLink";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import SocialMediaButton from "../general/SocialMediaButton";
import LargeFooter from "./LargeFooter";

type StyleProps = {
  textColor?: "string";
};

const useStyles = makeStyles<Theme, StyleProps>((theme: Theme) => ({
  root: (props) => ({
    padding: theme.spacing(2),
    borderTop: props.textColor ? 0 : `1px solid ${theme.palette.grey[100]}`,
    width: "100%",
    zIndex: "9",
    color: props.textColor ? props.textColor : "inherit",
  }),
  absolutePosition: {
    position: "absolute",
    bottom: 0,
  },
  relativePosition: {
    position: "fixed",
    bottom: 0,
    backgroundColor: "#FFFFFF",
    height: "49px",
  },
  spacingTop: {
    marginTop: theme.spacing(2),
  },
  flexContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
    },
  },
  centerText: {
    display: "flex",
    alignItems: "center",
    textAlign: "center",
    margin: "0 auto",
  },
  rightBox: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    [theme.breakpoints.down("md")]: {
      marginLeft: 0,
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(2),
    },
  },
  leftBox: {
    marginRight: "auto",
    [theme.breakpoints.down("md")]: {
      marginRight: 0,
      marginBottom: theme.spacing(1),
    },
  },

  inheritColor: {
    color: "inherit",
  },
  heart: {
    color: "red",
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
  },
  earth: {
    color: "blue",
    marginLeft: theme.spacing(1),
    height: 20,
  },
  link: {
    marginRight: theme.spacing(1),
  },
  customFooterImage: {
    height: 100,
  },
}));

//TODO: make footer stay on bottom on normal layout again
export default function Footer({
  className,
  noSpacingTop,
  noAbsolutePosition,
  showOnScrollUp,
  large,
  customFooterImage,
  textColor,
}: any) {
  if (!large)
    return (
      <SmallFooter
        className={className}
        noSpacingTop={noSpacingTop}
        noAbsolutePosition={noAbsolutePosition}
        showOnScrollUp={showOnScrollUp}
        customFooterImage={customFooterImage}
        textColor={textColor}
      />
    );
  else return <LargeFooter className={className} />;
}

const SmallFooter = ({
  className,
  noSpacingTop,
  noAbsolutePosition,
  showOnScrollUp,
  customFooterImage,
  textColor,
}) => {
  const classes = useStyles({ textColor: textColor });
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  const socialMediaLinks = [
    {
      href: "https://github.com/climateconnect/climatehub",
      icon: GitHubIcon,
      altText: "GitHub",
      isFooterIcon: true,
    },
    {
      href: "https://www.instagram.com/climatehub_netzwerk/",
      icon: InstagramIcon,
      altText: "Instagram",
      isFooterIcon: true,
    },
    {
      href: "https://www.facebook.com/climateconnect.earth/",
      icon: FacebookIcon,
      altText: "Facebook",
      isFooterIcon: true,
    },
    {
      href: "https://www.youtube.com/channel/UC10rPriptUxYilMfvt-8Tkw",
      icon: YouTubeIcon,
      altText: "Youtube",
      isFooterIcon: true,
    },
  ];

  return (
    <Box
      component="footer"
      className={`${className} ${classes.root} ${!noSpacingTop && classes.spacingTop} ${
        !noAbsolutePosition &&
        (showOnScrollUp === true ? classes.relativePosition : classes.absolutePosition)
      }`}
    >
      <Box className={classes.flexContainer}>
        <Box className={classes.leftBox}>
          <AppLink href="/imprint" leaveHub color="inherit" underline="hover">
            <span className={`${classes.inheritColor} ${classes.link}`}>{texts.imprint}</span>
          </AppLink>
          <AppLink href="/privacy" leaveHub color="inherit" underline="hover">
            <span className={`${classes.inheritColor} ${classes.link}`}>{texts.privacy}</span>
          </AppLink>
          <AppLink href="/terms" leaveHub color="inherit" underline="hover">
            <span className={classes.inheritColor}>{texts.terms}</span>
          </AppLink>
        </Box>
        {!isNarrowScreen && (
          <Box component="span" className={classes.centerText}>
            {customFooterImage ? (
              <img
                src={customFooterImage}
                className={classes.customFooterImage}
                alt="custom footer"
              />
            ) : (
              <MadeWithLoveForEarthSign />
            )}
          </Box>
        )}
        <Box component="span" className={classes.rightBox}>
          {socialMediaLinks.map((sml, index) => (
            <SocialMediaButton
              key={index}
              href={sml.href}
              socialMediaIcon={{ icon: sml.icon }}
              altText={sml.altText}
              isFooterIcon={sml.isFooterIcon}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

const MadeWithLoveForEarthSign = () => {
  const classes = useStyles({});
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  return (
    <>
      Made with <FavoriteIcon className={classes.heart} /> for{" "}
      <img className={classes.earth} src="/images/earth.svg" alt={texts.picture_of_our_earth} />
    </>
  );
};

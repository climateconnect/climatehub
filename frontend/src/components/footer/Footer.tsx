import { Theme, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
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

const FooterRoot = styled("footer", {
  shouldForwardProp: (p) =>
    p !== "textColor" &&
    p !== "noSpacingTop" &&
    p !== "noAbsolutePosition" &&
    p !== "showOnScrollUp",
})<{
  textColor?: string;
  noSpacingTop?: boolean;
  noAbsolutePosition?: boolean;
  showOnScrollUp?: boolean;
}>(({ theme, textColor, noSpacingTop, noAbsolutePosition, showOnScrollUp }) => ({
  padding: theme.spacing(2),
  borderTop: textColor ? 0 : `1px solid ${theme.palette.grey[100]}`,
  width: "100%",
  zIndex: "9",
  color: textColor ? textColor : "inherit",
  ...(!noAbsolutePosition &&
    (showOnScrollUp === true
      ? {
          position: "fixed",
          bottom: 0,
          backgroundColor: "#FFFFFF",
          height: "49px",
        }
      : {
          position: "absolute",
          bottom: 0,
        })),
  ...(!noSpacingTop && {
    marginTop: theme.spacing(2),
  }),
}));

const FlexContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
  },
}));

const CenterText = styled("span")({
  display: "flex",
  alignItems: "center",
  textAlign: "center",
  margin: "0 auto",
});

const RightBox = styled("span")(({ theme }) => ({
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  [theme.breakpoints.down("md")]: {
    marginLeft: 0,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
}));

const LeftBox = styled("div")(({ theme }) => ({
  marginRight: "auto",
  [theme.breakpoints.down("md")]: {
    marginRight: 0,
    marginBottom: theme.spacing(1),
  },
}));

const InheritColorSpan = styled("span")({
  color: "inherit",
});

const LinkSpan = styled(InheritColorSpan)(({ theme }) => ({
  marginRight: theme.spacing(1),
}));

const Heart = styled(FavoriteIcon)(({ theme }) => ({
  color: "red",
  marginLeft: theme.spacing(0.5),
  marginRight: theme.spacing(0.5),
}));

const Earth = styled("img")(({ theme }) => ({
  color: "blue",
  marginLeft: theme.spacing(1),
  height: 20,
}));

const CustomFooterImage = styled("img")({
  height: 100,
});

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
    <FooterRoot
      className={className}
      textColor={textColor}
      noSpacingTop={noSpacingTop}
      noAbsolutePosition={noAbsolutePosition}
      showOnScrollUp={showOnScrollUp}
    >
      <FlexContainer>
        <LeftBox>
          <AppLink href="/imprint" leaveHub color="inherit" underline="hover">
            <LinkSpan>{texts.imprint}</LinkSpan>
          </AppLink>
          <AppLink href="/privacy" leaveHub color="inherit" underline="hover">
            <LinkSpan>{texts.privacy}</LinkSpan>
          </AppLink>
          <AppLink href="/terms" leaveHub color="inherit" underline="hover">
            <InheritColorSpan>{texts.terms}</InheritColorSpan>
          </AppLink>
        </LeftBox>
        {!isNarrowScreen && (
          <CenterText>
            {customFooterImage ? (
              <CustomFooterImage src={customFooterImage} alt="custom footer" />
            ) : (
              <MadeWithLoveForEarthSign />
            )}
          </CenterText>
        )}
        <RightBox>
          {socialMediaLinks.map((sml, index) => (
            <SocialMediaButton
              key={index}
              href={sml.href}
              socialMediaIcon={{ icon: sml.icon }}
              altText={sml.altText}
              isFooterIcon={sml.isFooterIcon}
            />
          ))}
        </RightBox>
      </FlexContainer>
    </FooterRoot>
  );
};

const MadeWithLoveForEarthSign = () => {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  return (
    <>
      Made with <Heart /> for <Earth src="/images/earth.svg" alt={texts.picture_of_our_earth} />
    </>
  );
};

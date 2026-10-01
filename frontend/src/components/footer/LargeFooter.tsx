import { Button, Container, Link, Typography } from "@mui/material";
import { styled, Theme } from "@mui/material/styles";
import FacebookIcon from "@mui/icons-material/Facebook";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GitHubIcon from "@mui/icons-material/GitHub";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import YouTubeIcon from "@mui/icons-material/YouTube";
import React, { useContext } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import AppLink from "../general/AppLink";
import FeedbackButton from "../feedback/FeedbackButton";

const Root = styled("div")(({ theme }) => ({
  background: theme.palette.primary.light,
}));

const SiteLinksContainer = styled("div")(({ theme }) => ({
  display: "flex",
  padding: theme.spacing(6),
  justifyContent: "space-between",
  [theme.breakpoints.down("md")]: {
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  ["@media (max-width: 400px)"]: {
    flexDirection: "column",
    justifyContent: "center",
  },
}));

const linkTextStyles = (theme: Theme) => ({
  fontWeight: 600,
  [theme.breakpoints.down("lg")]: {
    fontSize: 14,
  },
});

const LinkText = styled(Typography)(({ theme }) => linkTextStyles(theme));

const NewsletterBlurb = styled(Typography)(({ theme }) => ({
  ...linkTextStyles(theme),
  color: "white",
}));

const footerLinkStyles = (theme: Theme) => ({
  color: "white",
  display: "block",
  marginBottom: theme.spacing(1),
  "&:hover": {
    color: theme.palette.primary.main,
  },
});

const FooterAppLink = styled(AppLink)(({ theme }) => footerLinkStyles(theme));

const FooterLink = styled(Link)(({ theme }) => footerLinkStyles(theme));

const Headline = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  fontSize: 25,
  marginBottom: theme.spacing(2),
  fontWeight: "bold",
  [theme.breakpoints.down("lg")]: {
    fontSize: 22,
  },
}));

const LinksList = styled("div")({
  height: 110,
});

const NewsletterBox = styled("div")(({ theme }) => ({
  maxWidth: 250,
  position: "relative",
  [theme.breakpoints.up("lg")]: {
    maxWidth: 280,
    border: "6px solid " + theme.palette.primary.main,
    marginTop: -18,
    padding: theme.spacing(1.5),
    marginLeft: theme.spacing(2),
    borderRadius: theme.spacing(2),
    borderTopLeftRadius: 0,
    "&:after": {
      content: " ''",
      position: "absolute",
      width: 0,
      height: 0,
      borderStyle: "solid",
      borderWidth: "40px 0 0 40px",
      borderColor: theme.palette.primary.light + " transparent",
      top: 0,
      left: -40,
    },
    "&:before": {
      content: "''",
      position: "absolute",
      borderStyle: "solid",
      borderWidth: "55px 0 0 55px",
      borderColor: theme.palette.primary.main + " transparent",
      width: 0,
      height: 0,
      top: -6,
      left: -55,
    },
  },
  [theme.breakpoints.down("md")]: {
    minWidth: 120,
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
}));

const socialIconStyles = (theme: Theme) => ({
  fontSize: 30,
  color: theme.palette.primary.main,
  "&:hover": {
    color: theme.palette.secondary.main,
  },
});

const SocialInstagramIcon = styled(InstagramIcon)(({ theme }) => socialIconStyles(theme));

const SocialGitHubIcon = styled(GitHubIcon)(({ theme }) => socialIconStyles(theme));

const SocialLinkedInIcon = styled(LinkedInIcon)(({ theme }) => socialIconStyles(theme));

const SocialFacebookIcon = styled(FacebookIcon)(({ theme }) => socialIconStyles(theme));

const SocialYouTubeIcon = styled(YouTubeIcon)(({ theme }) => socialIconStyles(theme));

const SocialIconsContainer = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  paddingBottom: theme.spacing(3),
  maxWidth: 280,
  margin: "0 auto",
}));

const MadeWith = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  paddingBottom: theme.spacing(2),
  color: theme.palette.secondary.main,
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

const NewsletterSubscribeButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

const LinksSection = styled("div")(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    minWidth: 120,
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
}));

export default function LargeFooter({ className }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  return (
    <Root className={className}>
      <Container maxWidth="lg">
        <SiteLinks texts={texts} locale={locale} />
        <SocialLinks />
        <MadeWithLoveForEarth texts={texts} />
      </Container>
    </Root>
  );
}

const MadeWithLoveForEarth = (texts) => {
  return (
    <MadeWith>
      Made with <Heart /> for <Earth src="/images/earth.svg" alt={texts.picture_of_our_earth} />
    </MadeWith>
  );
};

const SocialLinks = () => {
  return (
    <SocialIconsContainer>
      <Link target="_blank" href="https://www.instagram.com/climatehub_netzwerk/" underline="hover">
        <SocialInstagramIcon color="primary" titleAccess="Instagram" />
      </Link>
      <Link target="_blank" href="https://github.com/climateconnect/climatehub" underline="hover">
        <SocialGitHubIcon titleAccess="GitHub" />
      </Link>
      <Link
        target="_blank"
        href="https://www.linkedin.com/company/climateconnect"
        underline="hover"
      >
        <SocialLinkedInIcon color="primary" titleAccess="LinkedIn" />
      </Link>
      <Link target="_blank" href="https://www.facebook.com/climateconnect.earth" underline="hover">
        <SocialFacebookIcon color="primary" titleAccess="Facebook" />
      </Link>
      <Link
        target="_blank"
        href="https://www.youtube.com/channel/UC10rPriptUxYilMfvt-8Tkw"
        underline="hover"
      >
        <SocialYouTubeIcon color="primary" titleAccess="YouTube" />
      </Link>
    </SocialIconsContainer>
  );
};

const SiteLinks = ({ texts, locale }) => {
  return (
    <SiteLinksContainer>
      <LinksSection>
        <Headline color="primary" component="h3">
          {texts.general}
        </Headline>
        <LinksList>
          <FooterAppLink href="/faq" leaveHub underline="none">
            <LinkText>{texts.faq}</LinkText>
          </FooterAppLink>
          <FooterAppLink href="/donate" leaveHub underline="none">
            <LinkText>{texts.donate}</LinkText>
          </FooterAppLink>
          <FooterAppLink href="/about" leaveHub underline="none">
            <LinkText>{texts.about}</LinkText>
          </FooterAppLink>
          {locale === "de" && (
            <FooterAppLink href="/verein" leaveHub underline="none">
              <LinkText>{texts.association}</LinkText>
            </FooterAppLink>
          )}
          <FooterAppLink href={"/jobs"} leaveHub underline="none">
            <LinkText>{texts.jobs}</LinkText>
          </FooterAppLink>
        </LinksList>
      </LinksSection>

      <LinksSection>
        <Headline color="primary" component="h3">
          {texts.contact}
        </Headline>
        <LinksList>
          <FooterLink underline="none" href="mailto:contact@climatehub.org">
            <LinkText>contact@climatehub.org</LinkText>
          </FooterLink>
          <FooterLink underline="none" href="tel:+4915730101056">
            <LinkText>+4915730101056</LinkText>
          </FooterLink>
          <FeedbackButton justLink>
            <LinkText>{texts.leave_feedback}</LinkText>
          </FeedbackButton>
        </LinksList>
      </LinksSection>

      <LinksSection>
        <Headline color="primary" component="h3">
          {texts.browse}
        </Headline>
        <LinksList>
          <FooterAppLink href="/browse" leaveHub underline="none">
            <LinkText>{texts.projects}</LinkText>
          </FooterAppLink>
          <FooterAppLink href="/organizations" leaveHub underline="none">
            <LinkText>{texts.organizations}</LinkText>
          </FooterAppLink>
          <FooterAppLink href="/members" leaveHub underline="none">
            <LinkText>{texts.members}</LinkText>
          </FooterAppLink>
        </LinksList>
      </LinksSection>

      <LinksSection>
        <Headline color="primary" component="h3">
          {texts.legal}
        </Headline>
        <LinksList>
          <FooterAppLink href="/imprint" leaveHub underline="none">
            <LinkText>{texts.imprint}</LinkText>
          </FooterAppLink>
          <FooterAppLink href="/privacy" leaveHub underline="none">
            <LinkText>{texts.privacy}</LinkText>
          </FooterAppLink>
          <FooterAppLink href="/terms" leaveHub underline="none">
            <LinkText>{texts.terms}</LinkText>
          </FooterAppLink>
        </LinksList>
      </LinksSection>

      <NewsletterBox>
        <Headline color="primary" component="h3">
          {texts.newsletter}
        </Headline>
        <NewsletterBlurb>{texts.sign_up_to_get_updates_about_climate_connect}</NewsletterBlurb>
        <NewsletterSubscribeButton
          color="primary"
          variant="contained"
          //TODO(unused) target="_blank"
          href={process.env.LATEST_NEWSLETTER_LINK}
        >
          {texts.latest_newsletter}
        </NewsletterSubscribeButton>
      </NewsletterBox>
    </SiteLinksContainer>
  );
};

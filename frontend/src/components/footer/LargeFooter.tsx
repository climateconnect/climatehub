import { Button, Container, Link, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
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

const useStyles = makeStyles((theme) => ({
  root: {
    background: theme.palette.primary.light,
  },
  siteLinks: {
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
  },
  newsletterBlurb: {
    color: "white",
  },
  li: {
    fontWeight: 600,
    [theme.breakpoints.down("lg")]: {
      fontSize: 14,
    },
  },
  footerLink: {
    color: "white",
    display: "block",
    "margin-bottom": theme.spacing(1),
    "&:hover": {
      color: theme.palette.primary.main,
    },
  },
  headline: {
    fontSize: 25,
    marginBottom: theme.spacing(2),
    fontWeight: "bold",
    [theme.breakpoints.down("lg")]: {
      fontSize: 22,
    },
  },
  links: {
    height: 110,
  },
  newsLetterBox: {
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
  },
  socialIcon: {
    fontSize: 30,
    color: theme.palette.primary.main,
    "&:hover": {
      color: theme.palette.secondary.main,
    },
  },
  socialIconsContainer: {
    display: "flex",
    justifyContent: "space-between",
    paddingBottom: theme.spacing(3),
    maxWidth: 280,
    margin: "0 auto",
  },
  madeWith: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: theme.spacing(2),
    color: theme.palette.secondary.main,
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
  newsletterSubscribeButton: {
    marginTop: theme.spacing(2),
  },
  linksSection: {
    [theme.breakpoints.down("md")]: {
      minWidth: 120,
      textAlign: "center",
      marginBottom: theme.spacing(2),
    },
  },
}));

export default function LargeFooter({ className }) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "navigation", locale: locale });
  return (
    <div className={`${className} ${classes.root}`}>
      <Container maxWidth="lg">
        <SiteLinks texts={texts} locale={locale} />
        <SocialLinks />
        <MadeWithLoveForEarth texts={texts} />
      </Container>
    </div>
  );
}

const MadeWithLoveForEarth = (texts) => {
  const classes = useStyles();
  return (
    <div className={classes.madeWith}>
      Made with <FavoriteIcon className={classes.heart} /> for{" "}
      <img className={classes.earth} src="/images/earth.svg" alt={texts.picture_of_our_earth} />
    </div>
  );
};

const SocialLinks = () => {
  const classes = useStyles();
  return (
    <div className={classes.socialIconsContainer}>
      <Link target="_blank" href="https://www.instagram.com/climatehub_netzwerk/" underline="hover">
        <InstagramIcon color="primary" className={classes.socialIcon} titleAccess="Instagram" />
      </Link>
      <Link target="_blank" href="https://github.com/climateconnect/climatehub" underline="hover">
        <GitHubIcon className={classes.socialIcon} titleAccess="GitHub" />
      </Link>
      <Link
        target="_blank"
        href="https://www.linkedin.com/company/climateconnect"
        underline="hover"
      >
        <LinkedInIcon color="primary" className={classes.socialIcon} titleAccess="LinkedIn" />
      </Link>
      <Link target="_blank" href="https://www.facebook.com/climateconnect.earth" underline="hover">
        <FacebookIcon color="primary" className={classes.socialIcon} titleAccess="Facebook" />
      </Link>
      <Link
        target="_blank"
        href="https://www.youtube.com/channel/UC10rPriptUxYilMfvt-8Tkw"
        underline="hover"
      >
        <YouTubeIcon color="primary" className={classes.socialIcon} titleAccess="YouTube" />
      </Link>
    </div>
  );
};

const SiteLinks = ({ texts, locale }) => {
  const classes = useStyles();
  return (
    <div className={classes.siteLinks}>
      <div className={classes.linksSection}>
        <Typography color="primary" component="h3" className={classes.headline}>
          {texts.general}
        </Typography>
        <div className={classes.links}>
          <AppLink href="/faq" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.faq}</Typography>
          </AppLink>
          <AppLink href="/donate" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.donate}</Typography>
          </AppLink>
          <AppLink href="/about" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.about}</Typography>
          </AppLink>
          {locale === "de" && (
            <AppLink href="/verein" leaveHub underline="none" className={classes.footerLink}>
              <Typography className={classes.li}>{texts.association}</Typography>
            </AppLink>
          )}
          <AppLink
            href={locale === "de" ? "https://climate-connect.workwise.io/jobsuche" : "/join"}
            leaveHub
            underline="none"
            className={classes.footerLink}
          >
            <Typography className={classes.li}>{texts.jobs}</Typography>
          </AppLink>
        </div>
      </div>

      <div className={classes.linksSection}>
        <Typography color="primary" component="h3" className={classes.headline}>
          {texts.contact}
        </Typography>
        <div className={classes.links}>
          <Link
            underline="none"
            href="mailto:contact@climatehub.org"
            className={classes.footerLink}
          >
            <Typography className={classes.li}>contact@climatehub.org</Typography>
          </Link>
          <Link underline="none" href="tel:+4915730101056" className={classes.footerLink}>
            <Typography className={classes.li}>+4915730101056</Typography>
          </Link>
          <FeedbackButton justLink>
            <Typography className={classes.li}>{texts.leave_feedback}</Typography>
          </FeedbackButton>
        </div>
      </div>

      <div className={classes.linksSection}>
        <Typography color="primary" component="h3" className={classes.headline}>
          {texts.browse}
        </Typography>
        <div className={classes.links}>
          <AppLink href="/browse" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.projects}</Typography>
          </AppLink>
          <AppLink href="/organizations" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.organizations}</Typography>
          </AppLink>
          <AppLink href="/members" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.members}</Typography>
          </AppLink>
          <AppLink href="/hubs" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.hubs}</Typography>
          </AppLink>
        </div>
      </div>

      <div className={classes.linksSection}>
        <Typography color="primary" component="h3" className={classes.headline}>
          {texts.legal}
        </Typography>
        <div className={classes.links}>
          <AppLink href="/imprint" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.imprint}</Typography>
          </AppLink>
          <AppLink href="/privacy" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.privacy}</Typography>
          </AppLink>
          <AppLink href="/terms" leaveHub underline="none" className={classes.footerLink}>
            <Typography className={classes.li}>{texts.terms}</Typography>
          </AppLink>
        </div>
      </div>

      <div className={`${classes.newsLetterBox} ${classes.linksSection}`}>
        <Typography color="primary" component="h3" className={classes.headline}>
          {texts.newsletter}
        </Typography>
        <Typography className={`${classes.li} ${classes.newsletterBlurb}`}>
          {texts.sign_up_to_get_updates_about_climate_connect}
        </Typography>
        <Button
          className={classes.newsletterSubscribeButton}
          color="primary"
          variant="contained"
          //TODO(unused) target="_blank"
          href={process.env.LATEST_NEWSLETTER_LINK}
        >
          {texts.latest_newsletter}
        </Button>
      </div>
    </div>
  );
};

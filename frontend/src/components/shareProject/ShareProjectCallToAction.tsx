import { Divider, Skeleton, Theme, Typography, useMediaQuery } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { alpha } from "@mui/material/styles";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import getProjectTypeTexts from "../../../public/data/projectTypeTexts";
import { appHref } from "../../../public/lib/appLink";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import { Project } from "../../types";
import UserContext from "../context/UserContext";
import ProjectPreview from "../project/ProjectPreview";
import QrCodeDownload from "../shareContent/QrCodeDownload";
import SocialMediaShareOptions from "../shareContent/SocialMediaShareOptions";
import { SHARE_OPTIONS } from "../shareContent/shareOptions";
import useCreateShareRecord from "../shareContent/useCreateShareRecord";

const useStyles = makeStyles((theme) => ({
  "@keyframes fadeRise": {
    from: { opacity: 0, transform: "translateY(12px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  root: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    [theme.breakpoints.up("sm")]: {
      padding: theme.spacing(4),
    },
    //tint derives from the active theme's primary color so it works on custom hubs
    backgroundColor: alpha(theme.palette.primary.main, 0.05),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    borderRadius: theme.spacing(1),
    animation: "$fadeRise 0.5s ease-out both",
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
  liveTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    fontWeight: "bold",
    marginBottom: theme.spacing(1),
  },
  successIcon: {
    color: theme.palette.success.main,
    fontSize: 32,
  },
  subtitle: {
    marginBottom: theme.spacing(4),
  },
  shareArea: {
    display: "flex",
    gap: theme.spacing(4),
    textAlign: "left",
    //columns must not stretch: the preview card uses height:100% internally and
    //would otherwise grow beyond its content and overflow the box
    alignItems: "flex-start",
    [theme.breakpoints.down("lg")]: {
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    },
  },
  cardColumn: {
    flex: "0 0 300px",
    [theme.breakpoints.down("lg")]: {
      flex: "none",
      width: "100%",
      maxWidth: 345,
    },
  },
  shareColumn: {
    flex: 1,
    minWidth: 0,
    [theme.breakpoints.down("lg")]: {
      width: "100%",
    },
  },
  qrColumn: {
    flex: "0 0 240px",
    [theme.breakpoints.down("lg")]: {
      flex: "none",
    },
  },
  columnTitle: {
    marginBottom: theme.spacing(1),
  },
  columnDescription: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  qrCodeContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: theme.spacing(2),
    [theme.breakpoints.down("lg")]: {
      alignItems: "center",
    },
  },
}));

type ShareProjectCallToActionProps = {
  url_slug: string;
  projectTypeId: "project" | "idea" | "event";
  projectName?: string;
  hubName?: string;
  hasRegistration?: boolean;
  //the freshly published project for the preview card; undefined while it is loading
  previewProject?: any;
  //set when loading the project failed - the card column is then hidden entirely
  previewProjectFailed?: boolean;
};

//Success panel shown right after a project/idea/event was published.
//Combines the "it is live" confirmation (title + project preview card as visual
//proof) with the promotion call to action: share buttons for social
//media/messengers plus a downloadable QR code for print material.
export default function ShareProjectCallToAction({
  url_slug,
  projectTypeId,
  projectName,
  hubName,
  hasRegistration,
  previewProject,
  previewProjectFailed,
}: ShareProjectCallToActionProps) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const isTinyScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));
  const texts = getTexts({
    page: "project",
    locale: locale,
    //getTexts expects a full Project, but only project.name is used for text interpolation here
    project: { name: projectName } as Project,
    hubName: hubName,
  });
  const projectTypeTexts = getProjectTypeTexts(texts);
  const typeId = projectTypeId ?? "project";
  //Events with open registration get share texts that call out the registration
  const isEventWithRegistration = typeId === "event" && hasRegistration;
  const subtitle = isEventWithRegistration
    ? texts.share_cta_subtitle_event_with_registration
    : projectTypeTexts.shareCtaSubtitle[typeId];
  const messageTitle = isEventWithRegistration
    ? texts.share_own_content_message_title_event_with_registration
    : projectTypeTexts.shareMessageTitle[typeId];

  const relativePath = appHref(`/projects/${url_slug}`, { hubUrl: hubName, locale });
  const BASE_URL = process.env.BASE_URL ? process.env.BASE_URL : `https://climateconnect.earth`;
  const contentLink = `${BASE_URL}${relativePath}`;

  const createShareRecord = useCreateShareRecord(`/api/projects/${url_slug}/set_shared_project/`);

  return (
    <section className={classes.root}>
      <Typography variant="h4" component="h2" className={classes.liveTitle}>
        <CheckCircleOutlineIcon className={classes.successIcon} />
        {projectTypeTexts.contentIsLiveHeadline[typeId]}
      </Typography>
      <Typography className={classes.subtitle}>{subtitle}</Typography>
      <div className={classes.shareArea}>
        {!previewProjectFailed && (
          <>
            <div className={classes.cardColumn}>
              <Typography variant="h6" component="h3" className={classes.columnTitle}>
                {projectTypeTexts.yourPageTitle[typeId]}
              </Typography>
              <Typography variant="body2" className={classes.columnDescription}>
                {projectTypeTexts.contentPreviewCaption[typeId]}
              </Typography>
              {previewProject ? (
                <ProjectPreview project={previewProject} />
              ) : (
                <Skeleton variant="rounded" height={380} />
              )}
            </div>
            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: { xs: "none", lg: "block" } }}
            />
            <Divider sx={{ display: { xs: "block", lg: "none" }, width: "100%" }} />
          </>
        )}
        <div className={classes.shareColumn}>
          <Typography variant="h6" component="h3" className={classes.columnTitle}>
            {texts.share_online_title}
          </Typography>
          <Typography variant="body2" className={classes.columnDescription}>
            {texts.share_online_description}
          </Typography>
          <SocialMediaShareOptions
            createShareRecord={createShareRecord}
            tinyScreen={isTinyScreen}
            SHARE_OPTIONS={SHARE_OPTIONS}
            contentLink={contentLink}
            messageTitle={messageTitle}
            mailBody={texts.share_own_content_email_body}
            texts={texts}
          />
        </div>
        <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", lg: "block" } }} />
        <Divider sx={{ display: { xs: "block", lg: "none" }, width: "100%" }} />
        <div className={classes.qrColumn}>
          <Typography variant="h6" component="h3" className={classes.columnTitle}>
            {texts.qr_code_for_print_title}
          </Typography>
          <Typography variant="body2" className={classes.columnDescription}>
            {texts.qr_code_for_print_description}
          </Typography>
          <div className={classes.qrCodeContainer}>
            <QrCodeDownload
              url={contentLink}
              fileName={`climateconnect-${url_slug}-qr.png`}
              downloadButtonText={texts.download_qr_code}
              altText={texts.qr_code_alt_text}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

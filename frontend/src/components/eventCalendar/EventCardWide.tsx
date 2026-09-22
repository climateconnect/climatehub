import { Box, Button, Card, CardMedia, Typography } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ModeCommentIcon from "@mui/icons-material/ModeComment";
import makeStyles from "@mui/styles/makeStyles";
import React, { useContext } from "react";
import { useRouter } from "next/router";

import { getDateAndTime, getTime } from "../../../public/lib/dateOperations";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import AppLink from "../general/AppLink";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import ProjectSectorsDisplay from "../project/ProjectSectorsDisplay";
import LocationDisplay from "../project/LocationDisplay";
import { CreatorAndCollaboratorPreviews } from "../project/ProjectMetaData";
import {
  shouldShowRegisterButton,
  getRegisterButtonText,
  isRegisterButtonDisabled,
} from "../../utils/eventRegistrationHelpers";

const useStyles = makeStyles((theme) => ({
  root: {
    "&:hover": {
      cursor: "pointer",
      boxShadow: "2px 2px 1px #EEE",
    },
    backgroundColor: theme.palette.background.paper,
    borderRadius: 3,
    boxShadow: "3px 3px 8px #E0E0E0",
    overflow: "hidden",
  },
  wideCard: {
    display: "flex",
    flexDirection: "row",
    // Don't stretch children to the card's full height — that would distort
    // the thumbnail into a square. Keep the image at its natural aspect ratio
    // (matching the old project preview card).
    alignItems: "flex-start",
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },
  // Wrapper carries the breathing-room padding (top/bottom/left) so the image
  // itself can keep a clean border-radius. content-box lets the 250px image
  // width stay exact while the left padding adds outside it.
  imageWrapper: {
    boxSizing: "content-box",
    width: 250,
    minWidth: 250,
    paddingTop: theme.spacing(2.5),
    paddingBottom: theme.spacing(2.5),
    paddingLeft: theme.spacing(2.5),
    [theme.breakpoints.down("sm")]: {
      boxSizing: "border-box",
      width: "100%",
      minWidth: "100%",
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    },
  },
  image: {
    width: 250,
    minWidth: 250,
    height: "auto",
    objectFit: "cover",
    display: "block",
    borderRadius: 8,
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      minWidth: "100%",
      height: 160,
      borderRadius: 0,
    },
  },
  content: {
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(2),
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(0.75),
  },
  topicDesktop: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  topicMobile: {
    display: "none",
    marginTop: theme.spacing(0.5),
    [theme.breakpoints.down("sm")]: {
      display: "block",
    },
  },
  textBlock: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.75),
  },
  title: {
    fontWeight: "bold",
    fontSize: 20,
    color: "rgba(0, 0, 0, 0.87)",
    lineHeight: 1.4,
  },
  dateTime: {
    fontSize: 14,
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  locationText: {
    fontSize: 14,
  },
  bottomRow: {
    marginTop: theme.spacing(0.75),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
  },
  // Left side of the bottom row: the location. flex:1 + minWidth:0 lets it
  // shrink and wrap onto a second line so a long location never pushes the
  // action buttons out of the row.
  locationCell: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flex: "1 1 auto",
    marginRight: theme.spacing(1.5),
  },
  // Right side of the bottom row: comments, likes, register button.
  actions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexShrink: 0,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  statusIcon: {
    display: "flex",
    alignItems: "center",
    color: theme.palette.background.default_contrastText,
    fontSize: 14,
  },
  statusCount: {
    marginLeft: theme.spacing(0.25),
  },
  registerButton: {
    fontSize: 11,
    padding: "4px 12px",
    height: 24,
    whiteSpace: "nowrap",
  },
  // Icon styling matching the existing project card (theme contrast color)
  cardIcon: {
    verticalAlign: "bottom",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(-0.25),
    fontSize: "default",
    color: theme.palette.background.default_contrastText,
  },
  noUnderline: {
    textDecoration: "inherit",
    "&:hover": {
      textDecoration: "inherit",
    },
  },
}));

export default function EventCardWide({ project }: any) {
  const { locale, user } = useContext(UserContext);
  const router = useRouter();
  const texts = getTexts({ page: "project", locale: locale });
  const classes = useStyles();

  const start = new Date(project.start_date);
  const end = project.end_date ? new Date(project.end_date) : null;
  const dateRangeText =
    end && start.toDateString() === end.toDateString()
      ? `${getDateAndTime(start)} – ${getTime(end)}`
      : `${getDateAndTime(start)}${end ? " – " + getDateAndTime(end) : ""}`;

  const main_project_sector = project.sectors
    ? project.sectors.map((t: any) => t.sector?.name ?? t.name).filter(Boolean)[0]
    : undefined;

  // Registration state — same logic as the project card (falls back to the
  // user's registered_event_slugs when no explicit prop is provided).
  const isUserRegistered = user?.registered_event_slugs
    ? new Set(user.registered_event_slugs).has(project.url_slug)
    : undefined;

  const showRegisterButton = shouldShowRegisterButton(project);
  let buttonConfig: { label: string; disabled: boolean; variant: any; color: any } | null = null;
  if (showRegisterButton) {
    // For logged-in users, wait until registration status is known to avoid
    // flashing "Register Now" when the user is actually registered.
    if (user && isUserRegistered === undefined) {
      buttonConfig = null;
    } else {
      const resolved = isUserRegistered ?? false;
      buttonConfig = {
        label: getRegisterButtonText(project, texts, resolved),
        disabled: isRegisterButtonDisabled(project, resolved),
        variant: resolved ? "outlined" : "contained",
        color: resolved ? "secondary" : "primary",
      };
    }
  }

  const comments = project.number_of_comments ?? 0;
  const likes = project.number_of_likes ?? 0;

  const topic = main_project_sector ? (
    <ProjectSectorsDisplay
      main_project_sector={main_project_sector}
      iconClassName={classes.cardIcon}
    />
  ) : null;

  return (
    <AppLink
      href={`/projects/${project.url_slug}`}
      underline="hover"
      className={classes.noUnderline}
    >
      <Card className={classes.root} variant="outlined">
        <div className={classes.wideCard}>
          <div className={classes.imageWrapper}>
            <CardMedia
              component="img"
              className={classes.image}
              image={getImageUrl(project.image)}
              title={project.name}
              alt={project.name}
            />
          </div>
          <div className={classes.content}>
            <div className={classes.topRow}>
              <Typography className={classes.dateTime}>{dateRangeText}</Typography>
              <div className={classes.topicDesktop}>{topic}</div>
            </div>
            <div className={classes.textBlock}>
              <Typography component="h3" className={classes.title}>
                {project.name}
              </Typography>
              <div>
                <CreatorAndCollaboratorPreviews
                  collaborating_organization={project.collaborating_organizations}
                  project_parent={project.project_parents ? project.project_parents[0] : undefined}
                />
              </div>
              <div className={classes.topicMobile}>{topic}</div>
            </div>
            <div className={classes.bottomRow}>
              <LocationDisplay
                className={classes.locationCell}
                textClassName={classes.locationText}
                iconClassName={classes.cardIcon}
                location={project.is_online ? texts.online : project.location}
              />
              <Box className={classes.actions}>
                {comments > 0 && (
                  <Box className={classes.statusIcon}>
                    <ModeCommentIcon fontSize="small" />
                    <span className={classes.statusCount}>{comments}</span>
                  </Box>
                )}
                {likes > 0 && (
                  <Box className={classes.statusIcon}>
                    <FavoriteIcon fontSize="small" />
                    <span className={classes.statusCount}>{likes}</span>
                  </Box>
                )}
                {buttonConfig && (
                  <Button
                    className={classes.registerButton}
                    variant={buttonConfig.variant}
                    color={buttonConfig.color}
                    size="small"
                    disabled={buttonConfig.disabled}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!buttonConfig.disabled) {
                        router.push(
                          `${getLocalePrefix(locale)}/projects/${project.url_slug}/register`
                        );
                      }
                    }}
                  >
                    {buttonConfig.label}
                  </Button>
                )}
              </Box>
            </div>
          </div>
        </div>
      </Card>
    </AppLink>
  );
}

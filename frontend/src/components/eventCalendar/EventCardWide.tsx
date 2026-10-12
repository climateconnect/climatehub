import { Button, Card, CardMedia, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ModeCommentIcon from "@mui/icons-material/ModeComment";
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

// Static classes handed to `LocationDisplay` / `ProjectSectorsDisplay` (which still use
// `makeStyles`) and styled from `CardRoot` via descendant selectors. The descendant selector
// has a higher specificity than those components' own JSS classes, so these rules keep winning
// regardless of the order in which emotion and JSS inject their styles.
const CARD_ICON_CLASS = "EventCardWide-cardIcon";
const LOCATION_TEXT_CLASS = "EventCardWide-locationText";
const LOCATION_CELL_CLASS = "EventCardWide-locationCell";

const NoUnderlineLink = styled(AppLink)({
  textDecoration: "inherit",
  "&:hover": {
    textDecoration: "inherit",
  },
});

const CardRoot = styled(Card)(({ theme }) => ({
  "&:hover": {
    cursor: "pointer",
    boxShadow: "2px 2px 1px #EEE",
  },
  backgroundColor: theme.palette.background.paper,
  borderRadius: 3,
  boxShadow: "3px 3px 8px #E0E0E0",
  overflow: "hidden",
  // Icon styling matching the existing project card (theme contrast color)
  [`& .${CARD_ICON_CLASS}`]: {
    verticalAlign: "bottom",
    marginRight: theme.spacing(0.5),
    marginLeft: theme.spacing(-0.25),
    fontSize: "default",
    color: theme.palette.background.default_contrastText,
  },
  [`& .${LOCATION_TEXT_CLASS}`]: {
    fontSize: 14,
  },
  // Left side of the bottom row: the location. flex:1 + minWidth:0 lets it
  // shrink and wrap onto a second line so a long location never pushes the
  // action buttons out of the row.
  [`& .${LOCATION_CELL_CLASS}`]: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flex: "1 1 auto",
    marginRight: theme.spacing(1.5),
  },
}));

const WideCard = styled("div")(({ theme }) => ({
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
}));

// Wrapper carries the breathing-room padding (top/bottom/left) so the image
// itself can keep a clean border-radius. content-box lets the 250px image
// width stay exact while the left padding adds outside it.
const ImageWrapper = styled("div")(({ theme }) => ({
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
}));

const Image = styled(CardMedia)(({ theme }) => ({
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
})) as typeof CardMedia;

const Content = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(2),
  flex: 1,
  minWidth: 0,
}));

const TopRow = styled("div")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: theme.spacing(0.75),
}));

const TopicDesktop = styled("div")(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));

const TopicMobile = styled("div")(({ theme }) => ({
  display: "none",
  marginTop: theme.spacing(0.5),
  [theme.breakpoints.down("sm")]: {
    display: "block",
  },
}));

const TextBlock = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.75),
}));

const DateTime = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  fontWeight: 500,
  color: theme.palette.text.primary,
}));

const BottomRow = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(0.75),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
}));

// Right side of the bottom row: comments, likes, register button.
const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flexShrink: 0,
  flexWrap: "wrap",
  justifyContent: "flex-end",
}));

const StatusIcon = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  color: theme.palette.background.default_contrastText,
  fontSize: 14,
}));

const StatusCount = styled("span")(({ theme }) => ({
  marginLeft: theme.spacing(0.25),
}));

const RegisterButton = styled(Button)({
  fontSize: 11,
  padding: "4px 12px",
  height: 24,
  whiteSpace: "nowrap",
});

export default function EventCardWide({ project }: any) {
  const { locale, user } = useContext(UserContext);
  const router = useRouter();
  const texts = getTexts({ page: "project", locale: locale });

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
      iconClassName={CARD_ICON_CLASS}
    />
  ) : null;

  return (
    <NoUnderlineLink href={`/projects/${project.url_slug}`} underline="hover">
      <CardRoot variant="outlined">
        <WideCard>
          <ImageWrapper>
            <Image
              component="img"
              image={getImageUrl(project.image)}
              title={project.name}
              alt={project.name}
            />
          </ImageWrapper>
          <Content>
            <TopRow>
              <DateTime>{dateRangeText}</DateTime>
              <TopicDesktop>{topic}</TopicDesktop>
            </TopRow>
            <TextBlock>
              <Typography
                component="h3"
                sx={{
                  fontWeight: "bold",
                  fontSize: 20,
                  color: "rgba(0, 0, 0, 0.87)",
                  lineHeight: 1.4,
                }}
              >
                {project.name}
              </Typography>
              <div>
                <CreatorAndCollaboratorPreviews
                  collaborating_organization={project.collaborating_organizations}
                  project_parent={project.project_parents ? project.project_parents[0] : undefined}
                />
              </div>
              <TopicMobile>{topic}</TopicMobile>
            </TextBlock>
            <BottomRow>
              <LocationDisplay
                className={LOCATION_CELL_CLASS}
                textClassName={LOCATION_TEXT_CLASS}
                iconClassName={CARD_ICON_CLASS}
                location={project.is_online ? texts.online : project.location}
              />
              <Actions>
                {comments > 0 && (
                  <StatusIcon>
                    <ModeCommentIcon fontSize="small" />
                    <StatusCount>{comments}</StatusCount>
                  </StatusIcon>
                )}
                {likes > 0 && (
                  <StatusIcon>
                    <FavoriteIcon fontSize="small" />
                    <StatusCount>{likes}</StatusCount>
                  </StatusIcon>
                )}
                {buttonConfig && (
                  <RegisterButton
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
                  </RegisterButton>
                )}
              </Actions>
            </BottomRow>
          </Content>
        </WideCard>
      </CardRoot>
    </NoUnderlineLink>
  );
}

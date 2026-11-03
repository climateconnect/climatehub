import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import ProjectPreviews from "../project/ProjectPreviews";
import { styled, useTheme } from "@mui/material/styles";
import {
  compareByStartDate,
  getClassificationTimestamp,
  getStartOfTodayMs,
} from "../../utils/eventSorting";

interface WasseraktionswochenEventsProps {
  projects?: any[];
  hubUrl?: string;
  isGerman?: boolean;
}

const DEFAULT_HUB_SLUG = "em";

const SubHeader = styled(Typography)(({ theme }) => ({
  paddingLeft: "8px",
  fontWeight: "bold",
  paddingBottom: theme.spacing(1),
})) as typeof Typography;

const WasseraktionswochenEvents: React.FC<WasseraktionswochenEventsProps> = ({
  projects = [],
  hubUrl = DEFAULT_HUB_SLUG,
  isGerman = false,
}) => {
  const { upcoming, past } = useMemo(() => {
    const todayStartMs = getStartOfTodayMs();
    const upcomingProjects: any[] = [];
    const pastProjects: any[] = [];

    projects.forEach((project) => {
      const timestamp = getClassificationTimestamp(project);
      if (timestamp === null || timestamp >= todayStartMs) {
        upcomingProjects.push(project);
      } else {
        pastProjects.push(project);
      }
    });

    return {
      upcoming: upcomingProjects.sort(compareByStartDate),
      past: pastProjects.sort(compareByStartDate),
    };
  }, [projects]);

  const theme = useTheme();

  return (
    <Box sx={{ mt: 4 }}>
      {upcoming.length > 0 && (
        <Box sx={{ mb: 6 }}>
          <SubHeader
            component="h2"
            variant="h6"
            color={theme.palette.background.default_contrastText}
          >
            {isGerman ? "Diese Events erwarten Euch" : "Upcoming Events"}
          </SubHeader>
          <ProjectPreviews
            projects={upcoming}
            hubUrl={hubUrl}
            hasMore={false}
            isLoading={false}
            displayOnePreviewInRow={false}
            parentHandlesGridItems
          />
        </Box>
      )}

      {past.length > 0 && (
        <Box>
          <SubHeader
            component="h2"
            variant="h6"
            color={theme.palette.background.default_contrastText}
          >
            {isGerman ? "Vergangene Veranstaltungen" : "Past Events"}
          </SubHeader>
          <ProjectPreviews
            projects={past}
            hubUrl={hubUrl}
            hasMore={false}
            isLoading={false}
            displayOnePreviewInRow={false}
            parentHandlesGridItems
          />
        </Box>
      )}
    </Box>
  );
};

export default WasseraktionswochenEvents;

export { sortProjectsByStartDate } from "../../utils/eventSorting";

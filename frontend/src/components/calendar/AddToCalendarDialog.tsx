import { Alert, Link as MuiLink, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React from "react";
import GenericDialog from "../dialogs/GenericDialog";
import { getLocalePrefix } from "../../../public/lib/apiOperations";

const CalendarOptionsContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  paddingBottom: theme.spacing(2),
}));

const CalendarOption = styled(MuiLink)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(1.5),
  border: `1px solid ${theme.palette.grey[300]}`,
  borderRadius: theme.spacing(1),
  textDecoration: "none",
  color: theme.palette.text.primary,
  transition: "background-color 0.2s",
  "&:hover": {
    backgroundColor: theme.palette.grey[50],
  },
}));

const RegistrationReminder = styled(Alert)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

type Props = {
  open: boolean;
  onClose: (_value: boolean) => void;
  slug: string;
  locale: string;
  isEvent: boolean;
  registrationConfig: any;
  isUserRegistered: boolean;
  user: any;
  texts: any;
};

export default function AddToCalendarDialog({
  open,
  onClose,
  slug,
  locale,
  isEvent,
  registrationConfig,
  isUserRegistered,
  user,
  texts,
}: Props) {
  const localePrefix = getLocalePrefix(locale);

  const handleClose = () => {
    onClose(false);
  };

  const icalUrl = `${localePrefix}/calendar/${slug}.ical`;
  const googleCalUrl = `${localePrefix}/projects/${slug}/add-to-google-calendar`;

  const showRegistrationReminder =
    isEvent && registrationConfig && !registrationConfig.is_draft && user;

  return (
    <GenericDialog onClose={handleClose} open={open} title={texts.add_to_calendar}>
      <CalendarOptionsContainer>
        <CalendarOption
          href={googleCalUrl}
          underline="none"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Typography sx={{ fontWeight: 500 }}>{texts.add_to_google_calendar}</Typography>
        </CalendarOption>
        <CalendarOption href={icalUrl} underline="none">
          <Typography sx={{ fontWeight: 500 }}>{texts.add_to_apple_calendar}</Typography>
        </CalendarOption>
      </CalendarOptionsContainer>
      {showRegistrationReminder && (
        <RegistrationReminder severity={isUserRegistered ? "success" : "info"}>
          {isUserRegistered
            ? texts.you_are_registered_for_this_event
            : texts.not_registered_yet_reminder}
        </RegistrationReminder>
      )}
    </GenericDialog>
  );
}

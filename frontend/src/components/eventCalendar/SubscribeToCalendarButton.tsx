import { Box, Button, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import React, { useContext, useEffect, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import GenericDialog from "../dialogs/GenericDialog";
import { apiRequest } from "../../../public/lib/apiOperations";

const useStyles = makeStyles((theme) => ({
  subscribeButton: {
    alignSelf: "flex-start",
    marginTop: theme.spacing(1),
  },
  dialogContent: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  urlRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  urlField: {
    flex: 1,
  },
  googleButton: {
    alignSelf: "flex-start",
  },
  instructions: {
    color: theme.palette.text.secondary,
  },
  lagNote: {
    color: theme.palette.text.secondary,
    fontStyle: "italic",
    fontSize: "0.85rem",
  },
}));

type Props = {
  hubUrl?: string;
  search: string;
  sectors: string[];
  date: string;
  variant?: "button" | "icon";
};

export default function SubscribeToCalendarButton({
  hubUrl,
  search,
  sectors,
  date,
  variant = "button",
}: Props) {
  const { locale } = useContext(UserContext);
  const classes = useStyles();
  const texts = getTexts({ page: "hub", locale: locale });
  const [open, setOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const buildAndFetchUrl = async () => {
    setLoading(true);
    setCopied(false);
    try {
      const params: Record<string, string> = {};
      if (hubUrl) params.hub = hubUrl;
      if (sectors.length) params.sectors = sectors.join(",");
      if (search) params.search = search;
      if (date) params.date = date;
      params.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      params.lang = locale;

      const { data } = await apiRequest({
        method: "post",
        url: "/api/event-feed-token/",
        payload: params,
        locale: locale as any,
      });
      setFeedUrl(data.url);
    } catch (e) {
      setFeedUrl("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      buildAndFetchUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hubUrl, search, sectors.join(","), date, locale]);

  const handleCopy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text field
      const input = document.querySelector("[data-feed-url-input]") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
      }
    }
  };

  const webcalFeedUrl = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : "";
  const googleCalendarUrl = webcalFeedUrl
    ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalFeedUrl)}`
    : "";

  return (
    <>
      {variant === "icon" ? (
        <Tooltip title={texts.subscribe_to_calendar_button ?? "Subscribe"}>
          <IconButton size="small" onClick={() => setOpen(true)} aria-label="Subscribe to calendar">
            <CalendarMonthIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          className={classes.subscribeButton}
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<CalendarMonthIcon />}
          onClick={() => setOpen(true)}
        >
          {texts.subscribe_to_calendar_button ?? "Subscribe"}
        </Button>
      )}

      <GenericDialog
        open={open}
        onClose={() => setOpen(false)}
        title={texts.subscribe_dialog_title ?? "Subscribe to event calendar"}
      >
        <div className={classes.dialogContent}>
          <Typography className={classes.instructions}>
            {texts.subscribe_dialog_instructions ??
              "Copy the URL below and add it to your calendar app using 'Subscribe to calendar' or 'Add calendar by URL'."}
          </Typography>

          <div className={classes.urlRow}>
            <TextField
              className={classes.urlField}
              value={loading ? "Loading..." : feedUrl}
              InputProps={{ readOnly: true }}
              inputProps={{ "data-feed-url-input": true }}
              size="small"
              variant="outlined"
            />
            <Tooltip
              title={
                copied
                  ? texts.subscribe_copied ?? "Copied!"
                  : texts.subscribe_copy_url ?? "Copy URL"
              }
            >
              <IconButton
                onClick={handleCopy}
                disabled={loading || !feedUrl}
                aria-label="Copy feed URL"
              >
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          </div>

          {feedUrl && (
            <Box>
              <Button
                className={classes.googleButton}
                variant="contained"
                color="primary"
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {texts.subscribe_open_in_google ?? "Open in Google Calendar"}
              </Button>
            </Box>
          )}

          <Typography className={classes.lagNote}>
            {texts.subscribe_google_lag_note ??
              "Note: Google Calendar refreshes subscribed feeds every 12\u201324 hours, so new events may take up to a day to appear."}
          </Typography>
        </div>
      </GenericDialog>
    </>
  );
}

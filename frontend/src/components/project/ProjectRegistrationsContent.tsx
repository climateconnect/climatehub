import React, { useContext, useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Menu,
  MenuItem,
  TextField,
  Theme,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import DangerousIcon from "@mui/icons-material/Dangerous";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  DataGrid,
  GridColDef,
  GridColumnMenu,
  GridColumnMenuProps,
  GridFooterContainer,
  GridPagination,
  GridToolbarContainer,
  GridToolbarExport,
} from "@mui/x-data-grid";
import { deDE, enUS } from "@mui/x-data-grid/locales";
import dayjs from "dayjs";
import Cookies from "universal-cookie";
import { apiRequest, getLocalePrefix } from "../../../public/lib/apiOperations";

import getTexts from "../../../public/texts/texts";
import { EventRegistrationData, Project, RegistrationFieldAnswer } from "../../types";
import { resolveAnswerToStrings } from "../../utils/resolveRegistrationFieldAnswer";
import UserContext from "../context/UserContext";
import CancelGuestRegistrationModal, { RegistrationInfo } from "./CancelGuestRegistrationModal";
import EditEventRegistrationModal from "./EditEventRegistrationModal";
import SendEmailToGuestsModal from "./SendEmailToGuestsModal";
import ViewRegistrationAnswersModal from "./ViewRegistrationAnswersModal";

type EventRegistration = {
  /** Backend PK — used as DataGrid row id and in the DELETE URL. */
  id: number;
  user_first_name: string;
  user_last_name: string;
  user_url_slug: string;
  user_thumbnail_image: string | null;
  registered_at: string;
  /** null = active registration; ISO string = cancelled */
  cancelled_at: string | null;
  cancellation_reason: string | null;
  /** Custom-field answers (Phase 4a). Empty array if none. */
  field_answers: RegistrationFieldAnswer[];
};

const useStyles = makeStyles((theme) => ({
  settingsGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  settingItem: {
    minWidth: 180,
  },
  settingLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: theme.spacing(0.5),
  },
  settingValue: {
    fontWeight: 500,
    fontSize: "1rem",
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: theme.spacing(2),
  },
  editButton: {
    marginBottom: theme.spacing(4),
  },
  listSection: {
    marginTop: theme.spacing(2),
  },
}));

type Props = {
  project: Project;
  eventRegistration: EventRegistrationData | null;
  onEventRegistrationUpdated: (_updated: EventRegistrationData) => void;
};

type ToolbarProps = {
  search: string;
  onSearchChange: (_value: string) => void;
  placeholder: string;
  onOpenEmailModal?: () => void;
  emailGuestsLabel?: string;
  csvFileName: string;
  csvFields: string[];
  printFields: string[];
};

function CustomColumnMenu(props: GridColumnMenuProps) {
  return <GridColumnMenu {...props} slots={{ columnMenuColumnsItem: null }} />;
}

function RegistrationsToolbar({
  search,
  onSearchChange,
  placeholder,
  onOpenEmailModal,
  emailGuestsLabel,
  csvFileName,
  csvFields,
  printFields,
}: ToolbarProps) {
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("sm"));
  return (
    // Desktop: one row. Mobile: search + email on the first row, export on the second
    <GridToolbarContainer
      sx={{
        display: "flex",
        // Mobile: stretch so search and email button share the same height, even if the label wraps
        alignItems: { xs: "stretch", sm: "center" },
        flexWrap: { xs: "wrap", sm: "nowrap" },
        gap: 1,
        // No side padding on mobile to leave room for the email button label
        px: { xs: 0, sm: 1 },
        py: 1,
      }}
    >
      <TextField
        size="small"
        // Mobile shows only the search icon; the input keeps its accessible name via aria-label
        placeholder={isNarrowScreen ? undefined : placeholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
        }}
        inputProps={{ "aria-label": placeholder }}
        sx={
          isNarrowScreen
            ? {
                // Mobile: collapse to the search icon so the email button gets the space;
                // expand while typing or when a search is active
                flex: "0 0 auto",
                width: search ? 140 : 48,
                transition: "width 150ms ease-in-out",
                "&:focus-within": { width: 140 },
                "& .MuiInputBase-root": { pl: 1.5, height: "100%" },
                "& .MuiInputBase-input": { pr: 1 },
              }
            : { flex: 1, maxWidth: 360 }
        }
      />
      {/* Spacer only on wider screens; on mobile the field takes the free space */}
      <Box sx={{ flex: 1, display: { xs: "none", sm: "block" } }} />
      {onOpenEmailModal && (
        <Button
          // Same size as the "Edit registration settings" button on larger screens
          size={isNarrowScreen ? "small" : "medium"}
          variant="outlined"
          startIcon={
            isNarrowScreen ? <EmailOutlinedIcon fontSize="small" /> : <EmailOutlinedIcon />
          }
          onClick={onOpenEmailModal}
          aria-label={emailGuestsLabel}
          // Mobile: button takes the free space next to the search icon. To keep the long
          // (German) label on one line: no uppercase, font scales with viewport, tight icon gap.
          sx={{
            // flex-basis 0 keeps the button on the search row instead of wrapping
            flex: { xs: "1 1 0", sm: "0 0 auto" },
            minWidth: 0,
            whiteSpace: "nowrap",
            // Match the small TextField height (40px)
            minHeight: { xs: 40, sm: undefined },
            px: { xs: 1, sm: undefined },
            fontSize: { xs: "min(0.875rem, 3.3vw)", sm: undefined },
            textTransform: { xs: "none", sm: undefined },
            letterSpacing: { xs: 0, sm: undefined },
            "& .MuiButton-startIcon": {
              ml: { xs: 0, sm: undefined },
              mr: { xs: 0.5, sm: undefined },
            },
          }}
        >
          {emailGuestsLabel}
        </Button>
      )}
      {/* Full-width wrapper on mobile puts export on its own row */}
      <Box sx={{ flex: { xs: "1 0 100%", sm: "0 0 auto" } }}>
        <GridToolbarExport
          csvOptions={{ fileName: csvFileName, fields: csvFields }}
          printOptions={{ hideFooter: true, hideToolbar: true, fields: printFields }}
        />
      </Box>
    </GridToolbarContainer>
  );
}

type FooterProps = {
  total: number;
  active: number;
  cancelled: number;
  guestsLabel: string;
  activeLabel: string;
  cancelledLabel: string;
};

function RegistrationsFooter({
  total,
  active,
  cancelled,
  guestsLabel,
  activeLabel,
  cancelledLabel,
}: FooterProps) {
  return (
    <GridFooterContainer sx={{ px: 1, gap: 1.5, flexWrap: "wrap" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {total} {guestsLabel}
        </Typography>
        <Chip
          size="small"
          label={`${active} ${activeLabel}`}
          color="success"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
        {cancelled > 0 && (
          <Chip
            size="small"
            label={`${cancelled} ${cancelledLabel}`}
            color="default"
            variant="outlined"
            sx={{ height: 20, fontSize: "0.7rem" }}
          />
        )}
      </Box>
      <GridPagination />
    </GridFooterContainer>
  );
}

export default function ProjectRegistrationsContent({
  project,
  eventRegistration,
  onEventRegistrationUpdated,
}: Props) {
  const classes = useStyles();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState<RegistrationInfo | null>(null);
  const [answersModalRow, setAnswersModalRow] = useState<EventRegistration | null>(null);

  // State for the per-row three-dot action menu
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuRowId, setMenuRowId] = useState<number | null>(null);

  const [participants, setParticipants] = useState<EventRegistration[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const token = new Cookies().get("auth_token");
    setLoadingParticipants(true);
    setParticipantsError(null);
    apiRequest({
      method: "get",
      url: `/api/projects/${project.url_slug}/registrations/`,
      token,
      locale,
    })
      .then((resp) => {
        const rows: EventRegistration[] = resp.data.map(
          (p: Omit<EventRegistration, never>, idx: number) => ({
            ...p,
            // Fall back to index if backend id is missing (defensive)
            id: p.id ?? idx,
            // Tolerate older payloads that don't include answers.
            field_answers: p.field_answers ?? [],
          })
        );
        setParticipants(rows);
      })
      .catch(() => {
        setParticipantsError(texts.error_loading_registrations);
      })
      .finally(() => {
        setLoadingParticipants(false);
      });
  }, [project.url_slug]);

  const isEventEnded = project.end_date ? dayjs(project.end_date).isBefore(dayjs()) : false;

  /** Called by CancelGuestRegistrationModal after a successful 204. */
  const handleCancelled = (registrationId: number) => {
    const cancelledAt = new Date().toISOString();

    setParticipants((prev) =>
      prev.map((row) => (row.id === registrationId ? { ...row, cancelled_at: cancelledAt } : row))
    );

    // Optimistically update available_seats and revert FULL → OPEN in the parent
    if (eventRegistration) {
      const newAvailableSeats = (eventRegistration.available_seats ?? 0) + 1;
      const newStatus = eventRegistration.status === "full" ? "open" : eventRegistration.status;
      onEventRegistrationUpdated({
        ...eventRegistration,
        available_seats: newAvailableSeats,
        status: newStatus,
      });
    }
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, rowId: number) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuRowId(rowId);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuRowId(null);
  };

  const handleOpenCancelModal = () => {
    const row = participants.find((p) => p.id === menuRowId);
    if (!row) return;
    setCancelModal({
      id: row.id,
      user_first_name: row.user_first_name,
      user_last_name: row.user_last_name,
    });
    handleCloseMenu();
  };

  if (!eventRegistration) {
    return (
      <Typography color="textSecondary" sx={{ mt: 2 }}>
        {texts.no_registration_settings_found}
      </Typography>
    );
  }

  if (eventRegistration.is_draft) {
    return (
      <Box sx={{ mt: 3, textAlign: "center" }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {texts.registration_setup_incomplete}
        </Typography>
        <Typography color="textSecondary" sx={{ mb: 2 }}>
          {texts.registration_setup_incomplete_description}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SettingsIcon />}
          onClick={() => setEditModalOpen(true)}
        >
          {texts.complete_registration_setup}
        </Button>
        {editModalOpen && (
          <EditEventRegistrationModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSaved={onEventRegistrationUpdated}
            project={project}
            eventRegistration={eventRegistration}
          />
        )}
      </Box>
    );
  }

  const STATUS_CONFIG = {
    open: {
      label: texts.registration_status_open,
      color: "success" as const,
      icon: CheckCircleOutlineIcon,
    },
    full: {
      label: texts.registration_status_full,
      color: "warning" as const,
      icon: PauseCircleOutlineIcon,
    },
    ended: {
      label: texts.registration_status_ended,
      color: "error" as const,
      icon: StopCircleIcon,
    },
    closed: {
      label: texts.registration_status_closed,
      color: "error" as const,
      icon: DangerousIcon,
    },
  };

  const statusConfig = STATUS_CONFIG[eventRegistration.status];
  const StatusIcon = statusConfig.icon;

  // Custom field export columns — hidden from the grid, included in CSV/print
  const customFields = [...(eventRegistration.fields ?? [])].sort((a, b) => a.order - b.order);

  const customFieldColumns: GridColDef[] = [];
  const customFieldColumnNames: string[] = [];

  for (const field of customFields) {
    if (field.id == null) continue;

    // Probe with undefined answer to determine column count (1 for most types, 2 for inventory)
    const columnSpec = resolveAnswerToStrings(field, undefined, locale);
    for (let i = 0; i < columnSpec.length; i++) {
      const colName = `custom_field_${field.id}${columnSpec[i].columnSuffix}`;
      customFieldColumnNames.push(colName);
      customFieldColumns.push({
        field: colName,
        headerName: `${field.label}${columnSpec[i].columnSuffix}`,
        width: 0,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        valueGetter: (_value, row) => {
          const typedRow = row as EventRegistration;
          const answerForField = typedRow.field_answers.find((a) => a.field === field.id);
          const cols = resolveAnswerToStrings(field, answerForField, locale);
          return cols[i]?.value ?? "";
        },
      });
    }
  }

  return (
    <>
      {/* Registration settings summary */}
      <Box className={classes.settingsGrid}>
        <Box className={classes.settingItem}>
          <Typography className={classes.settingLabel}>{texts.max_participants}</Typography>
          <Typography className={classes.settingValue}>
            {eventRegistration.max_participants ?? "—"}
          </Typography>
        </Box>

        <Box className={classes.settingItem}>
          <Typography className={classes.settingLabel}>{texts.registration_end_date}</Typography>
          <Typography className={classes.settingValue}>
            {eventRegistration.registration_end_date
              ? dayjs(eventRegistration.registration_end_date)
                  .locale(locale)
                  .format("DD MMM YYYY, HH:mm")
              : "—"}
          </Typography>
        </Box>

        <Box className={classes.settingItem}>
          <Typography className={classes.settingLabel}>{texts.registration_status}</Typography>
          <Chip
            size="small"
            label={statusConfig.label}
            color={statusConfig.color}
            icon={<StatusIcon fontSize="small" />}
            sx={{ fontWeight: 600 }}
          />
        </Box>
      </Box>

      {!isEventEnded && (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<SettingsIcon />}
          className={classes.editButton}
          onClick={() => setEditModalOpen(true)}
          aria-label={texts.edit_registration_settings}
        >
          {texts.edit_registration_settings}
        </Button>
      )}

      {/* Registered guests list */}
      <Box className={classes.listSection}>
        <Typography variant="h6" component="h2" className={classes.sectionTitle}>
          {texts.registered_guests}
        </Typography>

        {loadingParticipants && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
            <CircularProgress size={20} />
            <Typography color="textSecondary">{texts.loading_registrations}</Typography>
          </Box>
        )}

        {!loadingParticipants && participantsError && (
          <Typography color="error">{participantsError}</Typography>
        )}

        {!loadingParticipants && !participantsError && (
          <>
            <DataGrid
              autoHeight
              rows={participants.filter((p) => {
                const q = search.toLowerCase();
                return (
                  p.user_first_name.toLowerCase().includes(q) ||
                  p.user_last_name.toLowerCase().includes(q)
                );
              })}
              getRowClassName={(params) =>
                params.row.cancelled_at ? "registration-row--cancelled" : ""
              }
              columns={
                [
                  {
                    field: "user_thumbnail_image",
                    headerName: "",
                    width: 56,
                    sortable: false,
                    disableExport: true,
                    disableColumnMenu: true,
                    filterable: false,
                    renderCell: (params) => (
                      <Link
                        href={`${getLocalePrefix(locale)}/profiles/${params.row.user_url_slug}`}
                        underline="none"
                        aria-label={`${params.row.user_first_name} ${params.row.user_last_name}`}
                      >
                        <Avatar
                          src={params.row.user_thumbnail_image ?? undefined}
                          alt={`${params.row.user_first_name} ${params.row.user_last_name}`}
                          sx={{
                            width: 32,
                            height: 32,
                            opacity: params.row.cancelled_at ? 0.5 : 1,
                          }}
                        />
                      </Link>
                    ),
                  },
                  {
                    field: "user_first_name",
                    headerName: texts.first_name,
                    flex: 1,
                    minWidth: 120,
                    renderCell: (params) => (
                      <Link
                        href={`${getLocalePrefix(locale)}/profiles/${params.row.user_url_slug}`}
                        sx={{ color: params.row.cancelled_at ? "text.disabled" : undefined }}
                      >
                        {params.value}
                      </Link>
                    ),
                  },
                  {
                    field: "user_last_name",
                    headerName: texts.last_name,
                    flex: 1,
                    minWidth: 120,
                    renderCell: (params) => (
                      <Link
                        href={`${getLocalePrefix(locale)}/profiles/${params.row.user_url_slug}`}
                        sx={{ color: params.row.cancelled_at ? "text.disabled" : undefined }}
                      >
                        {params.value}
                      </Link>
                    ),
                  },
                  {
                    field: "registered_at",
                    headerName: texts.registration_date,
                    type: "dateTime",
                    flex: 1,
                    minWidth: 160,
                    valueGetter: (value) => (value ? new Date(value as string) : null),
                    valueFormatter: (value: Date | null) =>
                      value ? dayjs(value).locale(locale).format("DD MMM YYYY, HH:mm") : "—",
                  },
                  {
                    // Hidden column — ISO 8601 registration timestamp for CSV export
                    field: "registered_at_iso",
                    headerName: "Registration date (ISO)",
                    width: 0,
                    sortable: false,
                    filterable: false,
                    disableColumnMenu: true,
                    valueGetter: (_value, row) =>
                      row.registered_at ? row.registered_at.split(".")[0] + "Z" : "",
                  },
                  {
                    field: "cancelled_at",
                    headerName: texts.registration_status as string,
                    width: 120,
                    sortable: true,
                    disableColumnMenu: true,
                    valueFormatter: (value: string | null) =>
                      value
                        ? (texts.registration_status_cancelled as string)
                        : (texts.registration_status_active as string),
                    renderCell: (params) => {
                      const chip = params.row.cancelled_at ? (
                        <Chip
                          size="small"
                          label={texts.registration_status_cancelled as string}
                          color="warning"
                          sx={{ fontWeight: 500 }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label={texts.registration_status_active as string}
                          color="success"
                          sx={{ fontWeight: 500 }}
                        />
                      );
                      return params.row.cancelled_at ? (
                        <Tooltip
                          title={dayjs(params.row.cancelled_at)
                            .locale(locale)
                            .format("DD MMM YYYY, HH:mm")}
                          arrow
                        >
                          <span>{chip}</span>
                        </Tooltip>
                      ) : (
                        chip
                      );
                    },
                  },
                  {
                    // Hidden column — ISO 8601 cancellation timestamp for CSV export
                    field: "cancelled_at_iso",
                    headerName: "Cancellation date (ISO)",
                    width: 0,
                    sortable: false,
                    filterable: false,
                    disableColumnMenu: true,
                    valueGetter: (_value, row) =>
                      row.cancelled_at ? row.cancelled_at.split(".")[0] + "Z" : "",
                  },
                  {
                    // Hidden column — cancellation reason for CSV export
                    field: "cancellation_reason",
                    headerName: "Cancellation reason",
                    width: 0,
                    sortable: false,
                    filterable: false,
                    disableColumnMenu: true,
                    valueGetter: (value: string | null) => value ?? "",
                  },
                  ...customFieldColumns,
                  {
                    field: "__actions__",
                    headerName: "",
                    width: 88,
                    sortable: false,
                    filterable: false,
                    disableExport: true,
                    disableColumnMenu: true,
                    renderCell: (params) => {
                      const row = params.row as EventRegistration;
                      const showViewIcon =
                        (row.field_answers?.length ?? 0) > 0 || !!row.cancellation_reason;
                      const showMenu = !row.cancelled_at;
                      if (!showViewIcon && !showMenu) return null;
                      return (
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          {showViewIcon && (
                            <Tooltip title={texts.view_registration_answers as string} arrow>
                              <IconButton
                                size="small"
                                aria-label={texts.view_registration_answers as string}
                                onClick={() => setAnswersModalRow(row)}
                              >
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {showMenu && (
                            <IconButton
                              size="small"
                              aria-label={texts.cancel_guest_registration as string}
                              onClick={(e) => handleOpenMenu(e, row.id)}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      );
                    },
                  },
                ] as GridColDef[]
              }
              initialState={{
                columns: {
                  columnVisibilityModel: {
                    registered_at_iso: false,
                    cancelled_at_iso: false,
                    cancellation_reason: false,
                    ...Object.fromEntries(customFieldColumnNames.map((name) => [name, false])),
                  },
                },
                sorting: {
                  sortModel: [{ field: "registered_at", sort: "asc" }],
                },
                pagination: {
                  paginationModel: { pageSize: 25 },
                },
              }}
              localeText={{
                ...(locale === "de" ? deDE : enUS).components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: texts.no_registrations_yet,
              }}
              disableRowSelectionOnClick
              slots={{
                toolbar: RegistrationsToolbar,
                columnMenu: CustomColumnMenu,
                footer: RegistrationsFooter,
              }}
              slotProps={{
                toolbar: {
                  search,
                  onSearchChange: setSearch,
                  placeholder: texts.search_guests,
                  onOpenEmailModal: () => setEmailModalOpen(true),
                  emailGuestsLabel: texts.send_email_to_guests,
                  csvFileName: `${project.url_slug}-registrations-${dayjs().format("YYYY-MM-DD")}`,
                  csvFields: [
                    "user_first_name",
                    "user_last_name",
                    "registered_at_iso",
                    "cancelled_at",
                    "cancelled_at_iso",
                    "cancellation_reason",
                    ...customFieldColumnNames,
                  ],
                  printFields: ["user_first_name", "user_last_name", ...customFieldColumnNames],
                } as ToolbarProps,
                footer: {
                  total: participants.length,
                  active: participants.filter((p) => !p.cancelled_at).length,
                  cancelled: participants.filter((p) => !!p.cancelled_at).length,
                  guestsLabel: texts.registered_guests as string,
                  activeLabel: texts.registration_status_active as string,
                  cancelledLabel: texts.registration_status_cancelled as string,
                } as FooterProps,
              }}
              sx={{
                border: "none",
                "& .registration-row--cancelled": {
                  color: "text.disabled",
                },
                "& .MuiDataGrid-cell": {
                  display: "flex",
                  alignItems: "center",
                },
                "& .MuiDataGrid-columnSeparator": {
                  display: "none",
                },
              }}
            />

            {/* Per-row action menu */}
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={handleCloseMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem onClick={handleOpenCancelModal} sx={{ color: "error.main" }}>
                {texts.cancel_guest_registration as string}
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {!isEventEnded && (
        <EditEventRegistrationModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSaved={onEventRegistrationUpdated}
          project={project}
          eventRegistration={eventRegistration}
        />
      )}

      <SendEmailToGuestsModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        project={project}
        activeGuestCount={participants.filter((p) => p.cancelled_at === null).length}
        lastGuestEmailSentAt={eventRegistration.last_guest_email_sent_at ?? null}
        registrations={participants}
      />

      <CancelGuestRegistrationModal
        open={cancelModal !== null}
        onClose={() => setCancelModal(null)}
        registration={cancelModal}
        project={project}
        onCancelled={handleCancelled}
      />

      <ViewRegistrationAnswersModal
        open={answersModalRow !== null}
        onClose={() => setAnswersModalRow(null)}
        registration={answersModalRow}
        title={(texts.registration_answers_modal_title as string).replace(
          "{name}",
          answersModalRow
            ? `${answersModalRow.user_first_name} ${answersModalRow.user_last_name}`.trim()
            : ""
        )}
        fields={eventRegistration.fields ?? []}
        event={{
          name: project.name,
          start_date: project.start_date,
          end_date: project.end_date,
        }}
      />
    </>
  );
}

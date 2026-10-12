import React, { useContext } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CloseIcon from "@mui/icons-material/Close";

import { getDateTime, getDateTimeRange } from "../../../public/lib/dateOperations";
import getTexts from "../../../public/texts/texts";
import { RegistrationField, RegistrationFieldAnswer } from "../../types";
import { findOption, formatTimeRange } from "../../utils/resolveRegistrationFieldAnswer";
import UserContext from "../context/UserContext";

const TitleRow = styled(DialogTitle)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.grey[500],
}));

const FieldBlock = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(3),
  "&:last-child": {
    marginBottom: 0,
  },
}));

const CheckboxRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1.5),
}));

const CheckboxIconChecked = styled(CheckBoxIcon)(({ theme }) => ({
  color: theme.palette.primary.main,
  marginTop: 2,
}));

const DescriptionHtml = styled(Typography)(({ theme }) => ({
  flex: 1,
  "& a": {
    color: theme.palette.primary.main,
  },
  "& p": {
    margin: 0,
  },
}));

const OptionFieldTitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
}));

const OptionAnswer = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const EmptyState = styled(Typography)(({ theme }) => ({
  fontStyle: "italic",
  color: theme.palette.text.secondary,
}));

const CancelledNotice = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const EventSubheader = styled("div")(({ theme }) => ({
  marginBottom: theme.spacing(2),
  color: theme.palette.text.secondary,
}));

const EventDateLine = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
}));

export type ViewRegistrationAnswersModalRegistration = {
  user_first_name: string;
  user_last_name: string;
  cancelled_at: string | null;
  cancellation_reason?: string | null;
  field_answers: RegistrationFieldAnswer[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Registration row whose answers should be displayed (null = closed). */
  registration: ViewRegistrationAnswersModalRegistration | null;
  /** Title shown in the dialog header. Resolved by the caller. */
  title: string;
  /**
   * Field definitions from ``eventRegistration.fields`` — used to resolve
   * titles, descriptions, options and field order for the answers.
   */
  fields: RegistrationField[];
  /**
   * Optional event metadata to display under the dialog title — matches the
   * subheader shown in the registration modal (event name and date/time range).
   */
  event?: {
    name?: string;
    start_date?: any;
    end_date?: any;
  };
  /**
   * When provided, renders a "Cancel registration" button in the modal footer.
   * Opt-in only — organiser callers omit this prop so they keep today's behaviour
   * unchanged.
   */
  cancelAction?: {
    onCancelClick: () => void;
  };
};

/**
 * Read-only display of a registrant's custom-field answers.
 *
 * Renders answers in the same visual style as the registration form:
 *   - Checkbox fields show the (sanitized) description with a checked /
 *     unchecked icon — not interactive.
 *   - Option-select fields show the field title and the selected option as
 *     plain text.
 *   - Inventory fields show the field title and the selected option followed
 *     by the chosen quantity (e.g. "Large × 2").
 *   - Time-slot-select fields show the field title and the formatted time
 *     range of the selected slot (falling back to the option title).
 *
 * Field labels and option titles are resolved client-side from the supplied
 * ``fields`` definitions; the API only returns answer IDs.
 */
export default function ViewRegistrationAnswersModal({
  open,
  onClose,
  registration,
  title,
  fields,
  event,
  cancelAction,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });

  if (!registration) {
    return null;
  }

  const eventDateText =
    event?.start_date && event?.end_date
      ? getDateTimeRange(event.start_date, event.end_date, locale)
      : event?.start_date
      ? getDateTime(event.start_date)
      : null;

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  const answersByFieldId = new Map<number, RegistrationFieldAnswer>();
  for (const answer of registration.field_answers) {
    answersByFieldId.set(answer.field, answer);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <TitleRow>
        <CloseButton aria-label={texts.close as string} onClick={onClose} size="small">
          <CloseIcon />
        </CloseButton>
        <Typography variant="h6" component="span">
          {title}
        </Typography>
      </TitleRow>
      <DialogContent dividers>
        {(event?.name || eventDateText) && (
          <EventSubheader>
            {event?.name && <Typography variant="body2">{event.name}</Typography>}
            {eventDateText && <EventDateLine variant="body2">{eventDateText}</EventDateLine>}
          </EventSubheader>
        )}
        {registration.cancelled_at && (
          <CancelledNotice severity="warning">
            <Typography variant="body2">{texts.registration_answers_cancelled_notice}</Typography>
            {registration.cancellation_reason && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>{texts.cancellation_reason as string}:</strong>{" "}
                {registration.cancellation_reason}
              </Typography>
            )}
          </CancelledNotice>
        )}

        {sortedFields.length === 0 ? null : registration.field_answers.length === 0 ? (
          <EmptyState variant="body2">{texts.no_registration_answers}</EmptyState>
        ) : (
          sortedFields.map((field) => {
            if (field.id == null) return null;
            const answer = answersByFieldId.get(field.id);
            if (!answer) return null;

            if (field.field_type === "checkbox") {
              if (answer.value_boolean !== true) return null;
              const description = field.settings.description ?? "";
              const stateLabel = texts.registration_answer_checked as string;

              return (
                <FieldBlock key={field.id}>
                  <CheckboxRow>
                    <CheckboxIconChecked fontSize="small" aria-label={stateLabel} />
                    <DescriptionHtml variant="body2" component="div">
                      {/* Description was sanitized on organiser write. */}
                      <div dangerouslySetInnerHTML={{ __html: description }} />
                    </DescriptionHtml>
                  </CheckboxRow>
                </FieldBlock>
              );
            }

            if (field.field_type === "option_select") {
              const fieldTitle = field.settings.title ?? "";
              const selectedOption = findOption(field.options, answer.value_option);
              const answerText =
                selectedOption?.title ?? (texts.registration_answer_no_selection as string);

              return (
                <FieldBlock key={field.id}>
                  <OptionFieldTitle variant="body1">{fieldTitle}</OptionFieldTitle>
                  <OptionAnswer variant="body2">{answerText}</OptionAnswer>
                </FieldBlock>
              );
            }

            if (field.field_type === "inventory") {
              const fieldTitle = field.settings.title ?? "";
              const selectedOption = findOption(field.options, answer.value_option);
              const optionTitle =
                selectedOption?.title ?? (texts.registration_answer_no_selection as string);
              const quantity = answer.value_number;
              const answerText =
                quantity != null ? `${optionTitle} \u00d7 ${quantity}` : optionTitle;

              return (
                <FieldBlock key={field.id}>
                  <OptionFieldTitle variant="body1">{fieldTitle}</OptionFieldTitle>
                  <OptionAnswer variant="body2">{answerText}</OptionAnswer>
                </FieldBlock>
              );
            }

            if (field.field_type === "time_slot_select") {
              const fieldTitle = field.settings.title ?? "";
              const selectedOption = findOption(field.options, answer.value_option);
              let answerText: string;
              if (selectedOption?.start_time && selectedOption?.end_time) {
                answerText = formatTimeRange(
                  selectedOption.start_time,
                  selectedOption.end_time,
                  locale as string
                );
              } else {
                answerText =
                  selectedOption?.title ?? (texts.registration_answer_no_selection as string);
              }

              return (
                <FieldBlock key={field.id}>
                  <OptionFieldTitle variant="body1">{fieldTitle}</OptionFieldTitle>
                  <OptionAnswer variant="body2">{answerText}</OptionAnswer>
                </FieldBlock>
              );
            }

            if (field.field_type === "text") {
              const fieldTitle = field.settings.title ?? "";
              const displayValue = answer.value_text || "\u2014";

              return (
                <FieldBlock key={field.id}>
                  <OptionFieldTitle variant="body1">{fieldTitle}</OptionFieldTitle>
                  <OptionAnswer variant="body2" component="div" style={{ whiteSpace: "pre-wrap" }}>
                    {displayValue}
                  </OptionAnswer>
                </FieldBlock>
              );
            }

            return null;
          })
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center" }}>
        {cancelAction && (
          <Button onClick={cancelAction.onCancelClick} color="error" variant="outlined">
            {texts.cancel_registration as string}
          </Button>
        )}
        <Button onClick={onClose} color="primary" variant="contained">
          {texts.close as string}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

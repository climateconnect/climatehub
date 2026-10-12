import React, { useContext } from "react";
import { Box, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/Delete";
import { styled } from "@mui/material/styles";
import dayjs from "dayjs";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { RegistrationFieldOption } from "../../types";
import DatePicker from "../general/DatePicker";

const OptionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(0.75),
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
  },
}));

const DatetimeInput = styled(DatePicker)({
  flex: "1 1 0",
  minWidth: 185,
});

const CapacityInput = styled(TextField)({
  flex: "1 1 0",
  minWidth: 120,
});

const ActionButtons = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.25),
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    justifyContent: "flex-end",
    marginTop: theme.spacing(0.5),
  },
}));

const AddButton = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  cursor: "pointer",
  color: theme.palette.primary.main,
  marginTop: theme.spacing(0.5),
  fontSize: "0.875rem",
}));

type Props = {
  title: string;
  description: string;
  options: RegistrationFieldOption[];
  onChange: (_update: {
    title: string;
    description: string;
    options: RegistrationFieldOption[];
  }) => void;
  onRequestDeleteOption?: (_index: number, _option: RegistrationFieldOption) => void;
  titleDisabled?: boolean;
  isDraft?: boolean;
  fieldError?: string;
  onClearFieldError?: (_key: string) => void;
  fieldOrder?: number;
  eventStartDate?: string | dayjs.Dayjs | null;
  eventEndDate?: string | dayjs.Dayjs | null;
};

export default function TimeSlotFieldEditor({
  title,
  description,
  options,
  onChange,
  onRequestDeleteOption,
  titleDisabled,
  isDraft,
  fieldError,
  onClearFieldError: _onClearFieldError,
  fieldOrder: _fieldOrder,
  eventStartDate,
  eventEndDate,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ title: e.target.value, description, options });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ title, description: e.target.value, options });
  };

  const handleOptionDateTimeChange = (
    index: number,
    field: "start_time" | "end_time",
    value: dayjs.Dayjs | null
  ) => {
    const updated = options.map((o, i) => {
      if (i !== index) return o;
      return { ...o, [field]: value ? value.toISOString() : null };
    });
    onChange({ title, description, options: updated });
  };

  const handleOptionCapacityChange = (index: number, value: string) => {
    const updated = options.map((o, i) => {
      if (i !== index) return o;
      const parsed = value === "" ? null : parseInt(value, 10);
      return { ...o, available_amount: isNaN(parsed as number) ? null : parsed };
    });
    onChange({ title, description, options: updated });
  };

  const handleAddOption = () => {
    const newOrder = options.length > 0 ? Math.max(...options.map((o) => o.order)) + 1 : 0;
    onChange({
      title,
      description,
      options: [
        ...options,
        {
          title: "",
          order: newOrder,
          start_time: null,
          end_time: null,
          available_amount: null,
        },
      ],
    });
  };

  const handleDeleteOption = (index: number) => {
    const option = options[index];
    if (option.has_answers && onRequestDeleteOption) {
      onRequestDeleteOption(index, option);
      return;
    }
    const updated = options.filter((_, i) => i !== index).map((o, i) => ({ ...o, order: i }));
    onChange({ title, description, options: updated });
  };

  const handleMoveOptionUp = (index: number) => {
    if (index === 0) return;
    const updated = [...options];
    const above = updated[index - 1];
    updated[index - 1] = { ...updated[index], order: index - 1 };
    updated[index] = { ...above, order: index };
    onChange({ title, description, options: updated });
  };

  const handleMoveOptionDown = (index: number) => {
    if (index === options.length - 1) return;
    const updated = [...options];
    const below = updated[index + 1];
    updated[index + 1] = { ...updated[index], order: index + 1 };
    updated[index] = { ...below, order: index };
    onChange({ title, description, options: updated });
  };

  return (
    <Box>
      <TextField
        fullWidth
        label={texts.time_slot_title}
        value={title}
        onChange={handleTitleChange}
        variant="outlined"
        size="small"
        disabled={titleDisabled}
        required={!isDraft}
        error={!!fieldError}
        helperText={fieldError}
        sx={{ mb: 1 }}
      />
      <TextField
        fullWidth
        label={texts.time_slot_description}
        value={description}
        onChange={handleDescriptionChange}
        variant="outlined"
        size="small"
        sx={{ mb: 1.5 }}
      />
      {options.map((option, index) => (
        <OptionRow key={option.id ?? `ts_opt_${index}`}>
          <DatetimeInput
            label={texts.time_slot_start_time}
            date={option.start_time ? dayjs(option.start_time) : null}
            handleChange={(value: dayjs.Dayjs | null) =>
              handleOptionDateTimeChange(index, "start_time", value)
            }
            enableTime
            minDate={eventStartDate ? dayjs(eventStartDate) : undefined}
            maxDate={eventEndDate ? dayjs(eventEndDate) : undefined}
          />
          <DatetimeInput
            label={texts.time_slot_end_time}
            date={option.end_time ? dayjs(option.end_time) : null}
            handleChange={(value: dayjs.Dayjs | null) =>
              handleOptionDateTimeChange(index, "end_time", value)
            }
            enableTime
            minDate={
              option.start_time
                ? dayjs(option.start_time)
                : eventStartDate
                ? dayjs(eventStartDate)
                : undefined
            }
            maxDate={eventEndDate ? dayjs(eventEndDate) : undefined}
          />
          <CapacityInput
            value={option.available_amount ?? ""}
            onChange={(e) => handleOptionCapacityChange(index, e.target.value)}
            label={texts.time_slot_capacity}
            type="number"
            variant="outlined"
            size="small"
            inputProps={{ min: 1 }}
          />
          <ActionButtons>
            <Tooltip title={texts.move_field_up}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleMoveOptionUp(index)}
                  disabled={index === 0}
                  aria-label={texts.move_field_up}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={texts.move_field_down}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleMoveOptionDown(index)}
                  disabled={index === options.length - 1}
                  aria-label={texts.move_field_down}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={texts.delete_option}>
              <IconButton
                size="small"
                onClick={() => handleDeleteOption(index)}
                aria-label={texts.delete_option}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </ActionButtons>
        </OptionRow>
      ))}
      <AddButton onClick={handleAddOption} role="button" tabIndex={0}>
        <AddIcon fontSize="small" />
        <Typography variant="body2" color="primary">
          {texts.add_option}
        </Typography>
      </AddButton>
    </Box>
  );
}

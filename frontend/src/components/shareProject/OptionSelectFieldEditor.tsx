import React, { useContext } from "react";
import { Box, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/Delete";
import { styled } from "@mui/material/styles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { RegistrationFieldOption } from "../../types";

const OptionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  marginBottom: theme.spacing(0.75),
}));

const OptionInput = styled(TextField)({
  flex: 1,
});

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
  options: RegistrationFieldOption[];
  onChange: (_update: { title: string; options: RegistrationFieldOption[] }) => void;
  /** Called instead of immediate deletion when the option has answers (confirms data loss). */
  onRequestDeleteOption?: (_index: number, _option: RegistrationFieldOption) => void;
  /** When true, the question title field is read-only (field has registrant answers). */
  titleDisabled?: boolean;
  isDraft?: boolean;
  fieldError?: string;
  onClearFieldError?: (_key: string) => void;
};

export default function OptionSelectFieldEditor({
  title,
  options,
  onChange,
  onRequestDeleteOption,
  titleDisabled,
  isDraft,
  fieldError,
  onClearFieldError,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ title: e.target.value, options });
  };

  const handleOptionTitleChange = (index: number, value: string) => {
    const updated = options.map((o, i) => (i === index ? { ...o, title: value } : o));
    onChange({ title, options: updated });
  };

  const handleAddOption = () => {
    const newOrder = options.length > 0 ? Math.max(...options.map((o) => o.order)) + 1 : 0;
    onChange({ title, options: [...options, { title: "", order: newOrder }] });
  };

  const handleDeleteOption = (index: number) => {
    const option = options[index];
    if (option.has_answers && onRequestDeleteOption) {
      onRequestDeleteOption(index, option);
      return;
    }
    const updated = options.filter((_, i) => i !== index).map((o, i) => ({ ...o, order: i }));
    onChange({ title, options: updated });
  };

  const handleMoveOptionUp = (index: number) => {
    if (index === 0) return;
    const updated = [...options];
    const above = updated[index - 1];
    updated[index - 1] = { ...updated[index], order: index - 1 };
    updated[index] = { ...above, order: index };
    onChange({ title, options: updated });
  };

  const handleMoveOptionDown = (index: number) => {
    if (index === options.length - 1) return;
    const updated = [...options];
    const below = updated[index + 1];
    updated[index + 1] = { ...updated[index], order: index + 1 };
    updated[index] = { ...below, order: index };
    onChange({ title, options: updated });
  };

  return (
    <Box>
      <TextField
        fullWidth
        label={texts.option_select_title}
        value={title}
        onChange={(e) => {
          handleTitleChange(e);
          onClearFieldError?.("field");
        }}
        variant="outlined"
        size="small"
        disabled={titleDisabled}
        required={!isDraft}
        error={!!fieldError}
        helperText={fieldError}
        sx={{ mb: 1.5 }}
      />
      {options.map((option, index) => (
        <OptionRow key={option.id ?? `opt_${index}`}>
          <OptionInput
            value={option.title}
            onChange={(e) => handleOptionTitleChange(index, e.target.value)}
            placeholder={texts.option_placeholder}
            variant="outlined"
            size="small"
            disabled={option.has_answers === true}
          />
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

import React, { useContext, useState } from "react";
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import InventoryIcon from "@mui/icons-material/Inventory";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ShortTextIcon from "@mui/icons-material/ShortText";
import { styled } from "@mui/material/styles";
import { Dayjs } from "dayjs";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import { RegistrationField, RegistrationFieldOption } from "../../types";
import RegistrationFieldEditor from "./RegistrationFieldEditor";

const MAX_FIELDS = 15;
const MAX_LABEL_LENGTH = 30;

const FIELD_TYPE_LABEL_KEYS: Record<string, string> = {
  checkbox: "field_type_checkbox",
  option_select: "field_type_option_select",
  inventory: "field_type_inventory",
  time_slot_select: "field_type_time_slot_select",
  text: "field_type_text",
};

const FieldPaper = styled(Paper)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
}));

const FieldHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: theme.spacing(0.5),
}));

const ControlsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.25),
}));

const FieldFooter = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: theme.spacing(0.5),
}));

type Props = {
  fields: RegistrationField[];
  onFieldsChange: (_updated: RegistrationField[]) => void;
  /** Called instead of immediate deletion when the field has an id (was previously saved). */
  onRequestDeleteField?: (_index: number, _field: RegistrationField) => void;
  /** Called instead of immediate deletion when a persisted option within a field is deleted. */
  onRequestDeleteOption?: (
    _fieldIndex: number,
    _optionIndex: number,
    _option: RegistrationFieldOption
  ) => void;
  isDraft?: boolean;
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (_key: string) => void;
  eventStartDate?: string | Dayjs | null;
  eventEndDate?: string | Dayjs | null;
};

function generateDefaultLabel(
  fieldType: string,
  fields: RegistrationField[],
  texts: Record<string, string>
): string {
  const typeKey = FIELD_TYPE_LABEL_KEYS[fieldType] || "field_type_checkbox";
  const typeName = texts[typeKey] || fieldType;
  const existingLabels = new Set(fields.map((f) => f.label.toLowerCase()));
  let n = 1;
  let label: string;
  do {
    label = `${typeName} ${n}`;
    n++;
  } while (existingLabels.has(label.toLowerCase()));
  return label.slice(0, MAX_LABEL_LENGTH);
}

export default function RegistrationFieldList({
  fields,
  onFieldsChange,
  onRequestDeleteField,
  onRequestDeleteOption,
  isDraft,
  fieldErrors,
  onClearFieldError,
  eventStartDate,
  eventEndDate,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale });

  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);

  const handleOpenAddMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAddMenuAnchor(event.currentTarget);
  };

  const handleCloseAddMenu = () => {
    setAddMenuAnchor(null);
  };

  const handleAddField = (
    fieldType: "checkbox" | "option_select" | "inventory" | "time_slot_select" | "text"
  ) => {
    const newOrder = fields.length;
    const label = generateDefaultLabel(fieldType, fields, texts);
    const newField: RegistrationField = {
      field_type: fieldType,
      order: newOrder,
      is_required: false,
      label,
      settings:
        fieldType === "checkbox"
          ? { description: "" }
          : fieldType === "inventory" || fieldType === "time_slot_select"
          ? { title: "", description: "" }
          : fieldType === "text"
          ? { title: "", description: "", is_multiline: false }
          : { title: "" },
      options:
        fieldType === "option_select" ||
        fieldType === "inventory" ||
        fieldType === "time_slot_select"
          ? []
          : undefined,
      _clientKey: `new_${Date.now()}_${Math.random()}`,
    };
    onFieldsChange([...fields, newField]);
    handleCloseAddMenu();
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...fields];
    const above = updated[index - 1];
    updated[index - 1] = { ...updated[index], order: index - 1 };
    updated[index] = { ...above, order: index };
    onFieldsChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === fields.length - 1) return;
    const updated = [...fields];
    const below = updated[index + 1];
    updated[index + 1] = { ...updated[index], order: index + 1 };
    updated[index] = { ...below, order: index };
    onFieldsChange(updated);
  };

  const handleDeleteField = (index: number) => {
    const field = fields[index];
    if (field.has_answers && onRequestDeleteField) {
      onRequestDeleteField(index, field);
      return;
    }
    const updated = fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i }));
    onFieldsChange(updated);
  };

  const handleFieldChange = (index: number, updatedField: RegistrationField) => {
    const updated = [...fields];
    updated[index] = updatedField;
    onFieldsChange(updated);
  };

  const handleStartEditLabel = (index: number) => {
    setEditingIndex(index);
    setEditValue(fields[index].label);
    setLabelError(null);
  };

  const handleSaveLabel = (index: number) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setLabelError(null);
      setEditingIndex(null);
      return;
    }
    const isDuplicate = fields.some(
      (f, i) => i !== index && f.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setLabelError(texts.field_label_duplicate_error);
      return;
    }
    handleFieldChange(index, { ...fields[index], label: trimmed });
    setEditingIndex(null);
    setLabelError(null);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveLabel(index);
    } else if (e.key === "Escape") {
      setEditingIndex(null);
      setLabelError(null);
    }
  };

  const isAtMax = fields.length >= MAX_FIELDS;

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "checkbox":
        return <CheckBoxOutlineBlankIcon fontSize="small" />;
      case "inventory":
        return <InventoryIcon fontSize="small" />;
      case "time_slot_select":
        return <AccessTimeIcon fontSize="small" />;
      case "text":
        return <ShortTextIcon fontSize="small" />;
      case "option_select":
      default:
        return <RadioButtonUncheckedIcon fontSize="small" />;
    }
  };

  return (
    <Box>
      {fields.map((field, index) => (
        <FieldPaper
          key={field._clientKey ?? (field.id != null ? String(field.id) : `idx_${index}`)}
          variant="outlined"
        >
          <FieldHeader>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, minWidth: 0 }}>
              {getFieldIcon(field.field_type)}
              {editingIndex === index ? (
                <TextField
                  size="small"
                  value={editValue}
                  onChange={(e) => {
                    setEditValue(e.target.value);
                    if (labelError) setLabelError(null);
                  }}
                  onBlur={() => handleSaveLabel(index)}
                  onKeyDown={(e) => handleLabelKeyDown(e, index)}
                  inputProps={{
                    maxLength: MAX_LABEL_LENGTH,
                    "aria-label": texts.field_label_placeholder,
                  }}
                  error={!!labelError}
                  helperText={labelError}
                  autoFocus
                  sx={{ flex: 1 }}
                />
              ) : (
                <>
                  <Typography variant="subtitle2" color="textSecondary" noWrap>
                    {field.label}
                  </Typography>
                  <Tooltip title={texts.edit_field_label}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleStartEditLabel(index)}
                        aria-label={texts.edit_field_label}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              )}
            </Box>
            <ControlsRow>
              <Tooltip title={texts.move_field_up}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleMoveUp(index)}
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
                    onClick={() => handleMoveDown(index)}
                    disabled={index === fields.length - 1}
                    aria-label={texts.move_field_down}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </ControlsRow>
          </FieldHeader>
          <Divider sx={{ mb: 1.5 }} />
          <RegistrationFieldEditor
            field={field}
            onChange={(updated) => handleFieldChange(index, updated)}
            onRequestDeleteOption={
              onRequestDeleteOption
                ? (optionIndex, option) => onRequestDeleteOption(index, optionIndex, option)
                : undefined
            }
            isDraft={isDraft}
            fieldError={fieldErrors?.[`field:${index}`]}
            optionsError={fieldErrors?.[`field:${index}:options`]}
            optionErrors={
              fieldErrors
                ? Object.fromEntries(
                    Object.entries(fieldErrors).filter(([k]) => k.startsWith(`option:${index}:`))
                  )
                : undefined
            }
            onClearFieldError={
              onClearFieldError
                ? (key: string) => {
                    const rebased = key
                      .replace(/^field:\d+/, `field:${index}`)
                      .replace(/^option:\d+:/, `option:${index}:`);
                    onClearFieldError(rebased);
                  }
                : undefined
            }
            eventStartDate={eventStartDate}
            eventEndDate={eventEndDate}
          />
          <Divider sx={{ mt: 1.5 }} />
          <FieldFooter>
            <FormControlLabel
              control={
                <Switch
                  checked={field.is_required}
                  onChange={(e) =>
                    handleFieldChange(index, { ...field, is_required: e.target.checked })
                  }
                  color="primary"
                  size="small"
                />
              }
              label={texts.registration_field_required}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {(field.field_type === "option_select" ||
                field.field_type === "inventory" ||
                field.field_type === "time_slot_select") && (
                <Typography variant="caption" color="textSecondary">
                  {texts.single_option_per_guest_notice}
                </Typography>
              )}
              <Tooltip title={texts.delete_field}>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteField(index)}
                  aria-label={texts.delete_field}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </FieldFooter>
        </FieldPaper>
      ))}
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddIcon />}
        onClick={isAtMax ? undefined : handleOpenAddMenu}
        disabled={isAtMax}
        aria-label={texts.add_registration_field}
        sx={{ mt: fields.length > 0 ? 0.5 : 0 }}
      >
        {isAtMax ? texts.max_registration_fields_reached : texts.add_registration_field}
      </Button>
      <Menu anchorEl={addMenuAnchor} open={Boolean(addMenuAnchor)} onClose={handleCloseAddMenu}>
        <MenuItem onClick={() => handleAddField("checkbox")}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getFieldIcon("checkbox")}
            {texts.field_type_checkbox}
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleAddField("option_select")}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getFieldIcon("option_select")}
            {texts.field_type_option_select}
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleAddField("text")}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getFieldIcon("text")}
            {texts.field_type_text}
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleAddField("inventory")}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getFieldIcon("inventory")}
            {texts.field_type_inventory}
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleAddField("time_slot_select")}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getFieldIcon("time_slot_select")}
            {texts.field_type_time_slot_select}
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
}

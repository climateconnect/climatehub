import React, {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box } from "@mui/material";
import {
  RegistrationField,
  RegistrationFieldAnswerValue,
  RegistrationFieldOption,
} from "../../types";
import RegistrationCheckboxField from "./RegistrationCheckboxField";
import RegistrationInventoryField from "./RegistrationInventoryField";
import RegistrationOptionSelectField from "./RegistrationOptionSelectField";
import RegistrationTimeSlotField from "./RegistrationTimeSlotField";
import RegistrationTextField from "./RegistrationTextField";

export type RegistrationFieldAnswersFormHandle = {
  /** Validate all fields and return the answers payload if valid, or null if invalid. */
  validate(): RegistrationFieldAnswerValue[] | null;
};

type Props = {
  fields: RegistrationField[];
  /** Error map returned from the backend, keyed by field ID. */
  serverErrors?: Record<number, string>;
  /** Translation helper for validation messages. */
  texts: {
    this_field_is_required: string;
    you_must_check_this_box: string;
    please_select_an_option: string;
    please_select_inventory_option: string;
    please_enter_quantity: string;
    quantity_available: string;
    max_per_guest: string;
    quantity_exceeds_max: string;
    inventory_sold_out: string;
    please_select_time_slot: string;
    seats_available: string;
    registration_text_field_required_error: string;
    registration_text_field_max_length_error: string;
  };
  /** Called once on the first interaction with any custom field (for analytics). */
  onFirstInteraction?: () => void;
};

/** The only option of an inventory field with exactly one usable option, else undefined. */
function getSingleInventoryOption(
  field: RegistrationField
): (RegistrationFieldOption & { id: number }) | undefined {
  if (field.field_type !== "inventory" || field.id == null) return undefined;
  const usableOptions = (field.options ?? []).filter(
    (opt): opt is RegistrationFieldOption & { id: number } => opt.id != null
  );
  return usableOptions.length === 1 ? usableOptions[0] : undefined;
}

const RegistrationFieldAnswersForm = forwardRef<RegistrationFieldAnswersFormHandle, Props>(
  function RegistrationFieldAnswersForm(
    { fields, serverErrors = {}, texts, onFirstInteraction },
    ref
  ) {
    const [booleanValues, setBooleanValues] = useState<Record<number, boolean>>({});
    const [optionValues, setOptionValues] = useState<Record<number, number>>({});
    const [inventoryValues, setInventoryValues] = useState<
      Record<number, { optionId?: number; quantity?: number }>
    >({});
    const [timeSlotValues, setTimeSlotValues] = useState<Record<number, number>>({});
    const [textValues, setTextValues] = useState<Record<number, string>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
    const hasInteractedRef = useRef(false);

    const notifyFirstInteraction = () => {
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true;
        onFirstInteraction?.();
      }
    };

    const singleInventoryOptionIds = useMemo(() => {
      const map: Record<number, number> = {};
      for (const field of fields) {
        const option = getSingleInventoryOption(field);
        if (field.id != null && option) {
          map[field.id] = option.id;
        }
      }
      return map;
    }, [fields]);

    // Seed the option id for single-option inventory fields without touching
    // quantity or firing the first-interaction analytics event.
    useEffect(() => {
      setInventoryValues((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const fieldIdStr of Object.keys(singleInventoryOptionIds)) {
          const fieldId = Number(fieldIdStr);
          const optionId = singleInventoryOptionIds[fieldId];
          if (next[fieldId]?.optionId !== optionId) {
            next[fieldId] = { ...next[fieldId], optionId, quantity: undefined };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, [singleInventoryOptionIds]);

    const sortedFields = [...fields].sort((a, b) => a.order - b.order);

    useImperativeHandle(ref, () => ({
      validate() {
        const errors: Record<number, string> = {};

        for (const field of sortedFields) {
          if (field.id == null) continue;
          const id = field.id;

          if (field.field_type === "checkbox") {
            if (field.is_required && !booleanValues[id]) {
              errors[id] = texts.you_must_check_this_box;
            }
          } else if (field.field_type === "option_select") {
            if (field.is_required && optionValues[id] == null) {
              errors[id] = texts.please_select_an_option;
            }
          } else if (field.field_type === "inventory") {
            const inv = inventoryValues[id];
            const opt = field.options?.find((o) => o.id === inv?.optionId);
            const max = opt
              ? Math.min(opt.max_amount_per_guest ?? Infinity, opt.remaining_amount ?? Infinity)
              : undefined;
            const isSoldOut = opt != null && opt.remaining_amount === 0;
            if (field.is_required) {
              if (inv?.optionId == null) {
                errors[id] = texts.please_select_inventory_option;
              } else if (isSoldOut) {
                errors[id] = texts.inventory_sold_out;
              } else if (inv?.quantity == null || inv.quantity < 1) {
                errors[id] = texts.please_enter_quantity;
              } else if (max != null && inv.quantity > max) {
                errors[id] = texts.quantity_exceeds_max;
              }
            } else if (inv?.optionId != null && !isSoldOut) {
              if (inv.quantity == null || inv.quantity < 1) {
                // For single-option fields the option id is seeded automatically,
                // so an empty quantity means "no answer" instead of an error.
                if (getSingleInventoryOption(field) == null) {
                  errors[id] = texts.please_enter_quantity;
                }
              } else if (max != null && inv.quantity > max) {
                errors[id] = texts.quantity_exceeds_max;
              }
            }
          } else if (field.field_type === "time_slot_select") {
            if (field.is_required && timeSlotValues[id] == null) {
              errors[id] = texts.please_select_time_slot;
            }
          } else if (field.field_type === "text") {
            const textVal = textValues[id] ?? "";
            if (field.is_required && !textVal.trim()) {
              errors[id] = texts.registration_text_field_required_error;
            } else if (textVal.length > 300) {
              errors[id] = texts.registration_text_field_max_length_error;
            }
          }
        }

        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) {
          return null;
        }

        const answers: RegistrationFieldAnswerValue[] = [];
        for (const field of sortedFields) {
          if (field.id == null) continue;
          const id = field.id;

          if (field.field_type === "checkbox") {
            answers.push({ fieldId: id, valueBoolean: booleanValues[id] ?? false });
          } else if (field.field_type === "option_select") {
            if (optionValues[id] != null) {
              answers.push({ fieldId: id, valueOption: optionValues[id] });
            }
          } else if (field.field_type === "inventory") {
            const inv = inventoryValues[id];
            const opt = field.options?.find((o) => o.id === inv?.optionId);
            const isSoldOut = opt != null && opt.remaining_amount === 0;
            if (inv?.optionId != null && !isSoldOut && inv?.quantity != null && inv.quantity >= 1) {
              answers.push({
                fieldId: id,
                valueOption: inv.optionId,
                valueNumber: inv.quantity,
              });
            }
          } else if (field.field_type === "time_slot_select") {
            if (timeSlotValues[id] != null) {
              answers.push({ fieldId: id, valueOption: timeSlotValues[id] });
            }
          } else if (field.field_type === "text") {
            const textVal = textValues[id] ?? "";
            if (textVal.trim()) {
              answers.push({ fieldId: id, valueText: textVal });
            }
          }
        }
        return answers;
      },
    }));

    const handleBooleanChange = (fieldId: number, checked: boolean) => {
      notifyFirstInteraction();
      setBooleanValues((prev) => ({ ...prev, [fieldId]: checked }));
      if (fieldErrors[fieldId]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      }
    };

    const handleOptionChange = (fieldId: number, optionId: number) => {
      notifyFirstInteraction();
      setOptionValues((prev) => ({ ...prev, [fieldId]: optionId }));
      if (fieldErrors[fieldId]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      }
    };

    const handleInventoryOptionChange = (fieldId: number, optionId: number) => {
      notifyFirstInteraction();
      setInventoryValues((prev) => ({
        ...prev,
        [fieldId]: { ...prev[fieldId], optionId, quantity: undefined },
      }));
      if (fieldErrors[fieldId]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      }
    };

    const handleInventoryQuantityChange = (fieldId: number, quantity: number | undefined) => {
      notifyFirstInteraction();
      setInventoryValues((prev) => ({
        ...prev,
        [fieldId]: { ...prev[fieldId], quantity },
      }));
      if (fieldErrors[fieldId]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      }
    };

    const handleTimeSlotChange = (fieldId: number, optionId: number) => {
      notifyFirstInteraction();
      setTimeSlotValues((prev) => ({ ...prev, [fieldId]: optionId }));
      if (fieldErrors[fieldId]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[fieldId];
          return next;
        });
      }
    };

    return (
      <Box>
        {sortedFields.map((field) => {
          if (field.id == null) return null;
          const id = field.id;
          const error = fieldErrors[id] ?? serverErrors[id];

          if (field.field_type === "checkbox") {
            return (
              <RegistrationCheckboxField
                key={id}
                field={field}
                value={booleanValues[id] ?? false}
                onChange={(checked) => handleBooleanChange(id, checked)}
                error={error}
              />
            );
          }

          if (field.field_type === "option_select") {
            return (
              <RegistrationOptionSelectField
                key={id}
                field={field}
                value={optionValues[id]}
                onChange={(optionId) => handleOptionChange(id, optionId)}
                error={error}
                texts={{
                  please_select_an_option: texts.please_select_an_option,
                }}
              />
            );
          }

          if (field.field_type === "inventory") {
            return (
              <RegistrationInventoryField
                key={id}
                field={field}
                optionId={inventoryValues[id]?.optionId}
                quantity={inventoryValues[id]?.quantity}
                onOptionChange={(optionId) => handleInventoryOptionChange(id, optionId)}
                onQuantityChange={(quantity) => handleInventoryQuantityChange(id, quantity)}
                error={error}
                texts={{
                  please_select_inventory_option: texts.please_select_inventory_option,
                  please_enter_quantity: texts.please_enter_quantity,
                  quantity_available: texts.quantity_available,
                  max_per_guest: texts.max_per_guest,
                  quantity_exceeds_max: texts.quantity_exceeds_max,
                  inventory_sold_out: texts.inventory_sold_out,
                }}
              />
            );
          }

          if (field.field_type === "time_slot_select") {
            return (
              <RegistrationTimeSlotField
                key={id}
                field={field}
                optionId={timeSlotValues[id]}
                onChange={(optionId) => handleTimeSlotChange(id, optionId)}
                error={error}
                texts={{
                  please_select_time_slot: texts.please_select_time_slot,
                  seats_available: texts.seats_available,
                }}
              />
            );
          }

          if (field.field_type === "text") {
            return (
              <RegistrationTextField
                key={id}
                field={field}
                value={textValues[id] ?? ""}
                onChange={(v) => {
                  notifyFirstInteraction();
                  setTextValues((prev) => ({ ...prev, [id]: v }));
                  if (fieldErrors[id]) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next[id];
                      return next;
                    });
                  }
                }}
                error={error}
              />
            );
          }

          return null;
        })}
      </Box>
    );
  }
);

export default RegistrationFieldAnswersForm;

import React from "react";
import { Box, FormHelperText, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { RegistrationField, RegistrationFieldOption } from "../../types";

const Root = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  paddingLeft: 0,
}));

const Label = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  fontWeight: 500,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(1),
}));

const RequiredMark = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  marginLeft: theme.spacing(0.5),
}));

const Description = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
  fontSize: "0.875rem",
}));

const FixedOption = styled(Typography)<{ component?: React.ElementType }>(({ theme }) => ({
  color: theme.palette.text.primary,
}));

const QuantityRow = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

const HelperText = styled(FormHelperText)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: "0.75rem",
}));

const ErrorText = styled(FormHelperText)(({ theme }) => ({
  color: theme.palette.error.main,
}));

type Props = {
  field: RegistrationField;
  optionId: number | undefined;
  quantity: number | undefined;
  onOptionChange: (_optionId: number) => void;
  onQuantityChange: (_quantity: number | undefined) => void;
  error?: string;
  texts: {
    please_select_inventory_option: string;
    please_enter_quantity: string;
    quantity_available: string;
    max_per_guest: string;
    quantity_exceeds_max: string;
    inventory_sold_out: string;
  };
};

export default function RegistrationInventoryField({
  field,
  optionId,
  quantity,
  onOptionChange,
  onQuantityChange,
  error,
  texts,
}: Props) {
  const title = field.settings.title ?? "";
  const description = field.settings.description ?? "";
  const sortedOptions = [...(field.options ?? [])].sort((a, b) => a.order - b.order);
  const usableOptions = sortedOptions.filter((opt) => opt.id != null);
  const singleOption = usableOptions.length === 1 ? usableOptions[0] : undefined;
  const isSingleOption = singleOption != null;
  const isSoldOut = singleOption != null && singleOption.remaining_amount === 0;
  const selectedOption = sortedOptions.find((opt) => opt.id === optionId);

  const handleSelectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    if (val === "") return;
    onOptionChange(Number(val));
  };

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    if (val === "") {
      onQuantityChange(undefined);
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 0) {
        onQuantityChange(num);
      }
    }
  };

  const activeOption = isSingleOption ? singleOption : selectedOption;
  const maxQuantity = activeOption
    ? Math.min(
        activeOption.max_amount_per_guest ?? Infinity,
        activeOption.remaining_amount ?? Infinity
      )
    : undefined;

  const exceedsMax = maxQuantity != null && quantity != null && quantity > maxQuantity;

  const formatOptionLabel = (opt: RegistrationFieldOption) =>
    opt.remaining_amount != null
      ? `${opt.title} (${opt.remaining_amount} ${texts.quantity_available})`
      : opt.title;

  return (
    <Root>
      <Label component="div" variant="body1">
        {title}
        {field.is_required && <RequiredMark aria-hidden="true">{" *"}</RequiredMark>}
      </Label>
      {description && <Description variant="body2">{description}</Description>}
      {isSingleOption && singleOption ? (
        <FixedOption component="div" variant="body1">
          {singleOption.remaining_amount === 0
            ? `${singleOption.title} (${texts.inventory_sold_out})`
            : formatOptionLabel(singleOption)}
        </FixedOption>
      ) : (
        <TextField
          select
          fullWidth
          size="small"
          value={optionId ?? ""}
          onChange={handleSelectChange}
          required={field.is_required}
          SelectProps={{ native: true }}
        >
          <option value="">{texts.please_select_inventory_option}</option>
          {sortedOptions.map((opt) => {
            const isDisabled = opt.remaining_amount === 0;
            return (
              <option key={opt.id} value={opt.id} disabled={isDisabled}>
                {formatOptionLabel(opt)}
              </option>
            );
          })}
        </TextField>
      )}
      {activeOption && !isSoldOut && (
        <QuantityRow>
          <TextField
            type="number"
            size="small"
            value={quantity ?? ""}
            onChange={handleQuantityChange}
            inputProps={{
              min: 1,
              max: maxQuantity,
            }}
            placeholder={texts.please_enter_quantity}
            fullWidth
            error={exceedsMax}
          />
          {maxQuantity != null && (
            <HelperText>
              {texts.max_per_guest}: {maxQuantity}
            </HelperText>
          )}
          {exceedsMax && <ErrorText>{texts.quantity_exceeds_max}</ErrorText>}
        </QuantityRow>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Root>
  );
}

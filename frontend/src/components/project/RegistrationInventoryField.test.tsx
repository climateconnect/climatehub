import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import RegistrationInventoryField from "./RegistrationInventoryField";
import { RegistrationField, RegistrationFieldOption } from "../../types";

const texts = {
  please_select_inventory_option: "Please select an option.",
  please_enter_quantity: "Please enter a quantity.",
  quantity_available: "available",
  max_per_guest: "Max per guest",
  quantity_exceeds_max: "Quantity cannot exceed the maximum per guest.",
  inventory_sold_out: "Sold out",
};

function makeInventoryField(
  options: RegistrationFieldOption[],
  overrides: Partial<RegistrationField> = {}
): RegistrationField {
  return {
    id: 44,
    field_type: "inventory",
    order: 3,
    is_required: true,
    label: "Inventory",
    settings: { title: "Balcony solar" },
    options,
    ...overrides,
  };
}

function renderField({
  field,
  optionId,
  quantity,
  error,
}: {
  field: RegistrationField;
  optionId?: number;
  quantity?: number;
  error?: string;
}) {
  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <RegistrationInventoryField
          field={field}
          optionId={optionId}
          quantity={quantity}
          onOptionChange={() => {}}
          onQuantityChange={() => {}}
          error={error}
          texts={texts}
        />
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

describe("RegistrationInventoryField", () => {
  it("renders a single option as fixed text with the quantity input visible immediately", () => {
    renderField({
      field: makeInventoryField([
        { id: 201, title: "Solar module", order: 0, remaining_amount: 200 },
      ]),
    });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Solar module (200 available)")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    expect(screen.queryByText(texts.please_select_inventory_option)).not.toBeInTheDocument();
  });

  it("renders the single option title without remaining info when absent", () => {
    renderField({
      field: makeInventoryField([{ id: 201, title: "Solar module", order: 0 }]),
    });

    expect(screen.getByText("Solar module")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("shows sold-out suffix and no quantity input for a sold-out single option", () => {
    renderField({
      field: makeInventoryField([
        { id: 201, title: "Solar module", order: 0, remaining_amount: 0 },
      ]),
    });

    expect(screen.getByText("Solar module (Sold out)")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("keeps the dropdown for multi-option fields even when only one is available", () => {
    renderField({
      field: makeInventoryField([
        { id: 201, title: "Solar module", order: 0, remaining_amount: 0 },
        { id: 202, title: "Wind turbine", order: 1, remaining_amount: 5 },
      ]),
    });

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText(texts.please_select_inventory_option)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    const soldOutOption = screen.getByRole("option", { name: "Solar module (0 available)" });
    expect(soldOutOption).toBeDisabled();
    expect(screen.getByRole("option", { name: "Wind turbine (5 available)" })).toBeEnabled();
  });

  it("keeps the dropdown for zero-option fields", () => {
    renderField({
      field: makeInventoryField([]),
    });

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText(texts.please_select_inventory_option)).toBeInTheDocument();
  });

  it("does not treat an option with a null id as a usable single option", () => {
    renderField({
      field: makeInventoryField([{ id: null, title: "Solar module", order: 0 }]),
    });

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("shows max per guest helper and exceeds-max error for a single option", () => {
    renderField({
      field: makeInventoryField([
        {
          id: 201,
          title: "Solar module",
          order: 0,
          remaining_amount: 200,
          max_amount_per_guest: 2,
        },
      ]),
      quantity: 3,
    });

    expect(screen.getByText("Max per guest: 2")).toBeInTheDocument();
    expect(screen.getByText(texts.quantity_exceeds_max)).toBeInTheDocument();
  });
});

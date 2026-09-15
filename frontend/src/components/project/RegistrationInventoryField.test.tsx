import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import RegistrationInventoryField from "./RegistrationInventoryField";
import { RegistrationField } from "../../types";

function makeField(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 1,
    field_type: "inventory",
    order: 0,
    is_required: false,
    label: "Meals",
    settings: { title: "Meal tickets", description: "Select your meal" },
    options: [
      {
        id: 10,
        title: "Vegetarian",
        order: 0,
        available_amount: 50,
        max_amount_per_guest: 2,
        remaining_amount: 48,
      },
      {
        id: 11,
        title: "Vegan",
        order: 1,
        available_amount: 30,
        max_amount_per_guest: 3,
        remaining_amount: 30,
      },
      {
        id: 12,
        title: "Sold out",
        order: 2,
        available_amount: 10,
        max_amount_per_guest: 1,
        remaining_amount: 0,
      },
    ],
    ...overrides,
  };
}

const defaultTexts = {
  please_select_inventory_option: "Please select an option.",
  please_enter_quantity: "Please enter a quantity.",
  quantity_available: "available",
  max_per_guest: "Max per guest",
  quantity_exceeds_max: "Quantity cannot exceed the maximum per guest.",
};

function renderField({
  field = makeField(),
  optionId = undefined,
  quantity = undefined,
  onOptionChange = jest.fn(),
  onQuantityChange = jest.fn(),
  error,
}: {
  field?: RegistrationField;
  optionId?: number;
  quantity?: number;
  onOptionChange?: jest.Mock;
  onQuantityChange?: jest.Mock;
  error?: string;
} = {}) {
  const result = render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <RegistrationInventoryField
          field={field}
          optionId={optionId}
          quantity={quantity}
          onOptionChange={onOptionChange}
          onQuantityChange={onQuantityChange}
          error={error}
          texts={defaultTexts}
        />
      </StylesThemeProvider>
    </ThemeProvider>
  );
  return { ...result, select: result.container.querySelector("select") as HTMLSelectElement };
}

describe("RegistrationInventoryField", () => {
  it("renders the title from settings.title", () => {
    renderField();
    expect(screen.getByText("Meal tickets")).toBeInTheDocument();
  });

  it("renders the description from settings.description", () => {
    renderField();
    expect(screen.getByText("Select your meal")).toBeInTheDocument();
  });

  it("renders required marker when field is required", () => {
    renderField({ field: makeField({ is_required: true }) });
    expect(screen.getByText(/\*/)).toBeInTheDocument();
  });

  it("does not render required marker when field is not required", () => {
    renderField();
    const label = screen.getByText("Meal tickets");
    expect(label.textContent).not.toContain("*");
  });

  it("renders all options in the dropdown with remaining amounts", () => {
    const { select } = renderField();
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(4); // 1 placeholder + 3 options
    expect(options[1]).toHaveTextContent("Vegetarian (48 available)");
    expect(options[2]).toHaveTextContent("Vegan (30 available)");
    expect(options[3]).toHaveTextContent("Sold out (0 available)");
  });

  it("disables options with remaining_amount === 0", () => {
    const { select } = renderField();
    const options = select.querySelectorAll("option");
    const soldOutOption = Array.from(options).find((o) => o.textContent?.includes("Sold out"));
    expect(soldOutOption).toBeDisabled();
  });

  it("does not show quantity input when no option is selected", () => {
    renderField();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("shows quantity input when an option is selected", () => {
    renderField({ optionId: 10 });
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("shows max per guest helper text below quantity input", () => {
    renderField({ optionId: 10 });
    expect(screen.getByText("Max per guest: 2")).toBeInTheDocument();
  });

  it("caps max by remaining_amount when remaining < max_amount_per_guest", () => {
    // option 12: max_amount_per_guest=1, remaining_amount=0 → disabled, so pick option 10 with low remaining
    const field = makeField({
      options: [
        {
          id: 10,
          title: "Limited",
          order: 0,
          available_amount: 5,
          max_amount_per_guest: 4,
          remaining_amount: 1,
        },
      ],
    });
    renderField({ field, optionId: 10 });
    expect(screen.getByText("Max per guest: 1")).toBeInTheDocument();
  });

  it("calls onOptionChange with numeric id when dropdown changes", () => {
    const onOptionChange = jest.fn();
    const { select } = renderField({ onOptionChange });

    fireEvent.change(select, { target: { value: "11" } });

    expect(onOptionChange).toHaveBeenCalledWith(11);
  });

  it("calls onQuantityChange when quantity input changes", () => {
    const onQuantityChange = jest.fn();
    renderField({ optionId: 10, onQuantityChange });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });

    expect(onQuantityChange).toHaveBeenCalledWith(3);
  });

  it("calls onQuantityChange with undefined when input is cleared", () => {
    const onQuantityChange = jest.fn();
    renderField({ optionId: 10, quantity: 2, onQuantityChange });

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });

    expect(onQuantityChange).toHaveBeenCalledWith(undefined);
  });

  it("renders error message when error prop is provided", () => {
    renderField({ optionId: 10, error: "This field is required." });
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
  });

  it("does not render options when field.options is empty", () => {
    const { select } = renderField({ field: makeField({ options: [] }) });
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(1); // only placeholder
  });

  it("renders placeholder option in dropdown", () => {
    const { select } = renderField();
    const placeholder = select.querySelector('option[value=""]');
    expect(placeholder).toHaveTextContent("Please select an option.");
  });

  it("shows quantity exceeds max error inline when quantity > max", () => {
    renderField({ optionId: 10, quantity: 5 });
    expect(screen.getByText(defaultTexts.quantity_exceeds_max)).toBeInTheDocument();
  });

  it("does not show quantity exceeds max error when quantity is within limit", () => {
    renderField({ optionId: 10, quantity: 2 });
    expect(screen.queryByText(defaultTexts.quantity_exceeds_max)).not.toBeInTheDocument();
  });
});

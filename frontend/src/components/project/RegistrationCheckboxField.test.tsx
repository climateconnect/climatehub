import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import RegistrationCheckboxField from "./RegistrationCheckboxField";
import { RegistrationField } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 1,
    field_type: "checkbox",
    order: 0,
    is_required: false,
    label: "Checkbox 1",
    settings: { description: "I agree to the terms" },
    ...overrides,
  };
}

function renderField({
  field = makeField(),
  value = false,
  onChange = jest.fn(),
  error,
}: {
  field?: RegistrationField;
  value?: boolean;
  onChange?: jest.Mock;
  error?: string;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <RegistrationCheckboxField field={field} value={value} onChange={onChange} error={error} />
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RegistrationCheckboxField", () => {
  it("renders the description text", () => {
    renderField({ field: makeField({ settings: { description: "I agree to the terms" } }) });
    expect(screen.getByText(/I agree to the terms/i)).toBeInTheDocument();
  });

  it("renders a checkbox input", () => {
    renderField();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("checkbox is unchecked when value is false", () => {
    renderField({ value: false });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("checkbox is checked when value is true", () => {
    renderField({ value: true });
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onChange with true when checkbox is clicked while unchecked", () => {
    const onChange = jest.fn();
    renderField({ value: false, onChange });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when checkbox is clicked while checked", () => {
    const onChange = jest.fn();
    renderField({ value: true, onChange });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not render required marker when is_required is false", () => {
    renderField({ field: makeField({ is_required: false }) });
    expect(screen.queryByText("*", { exact: false })).not.toBeInTheDocument();
  });

  it("renders required marker before the description when is_required is true", () => {
    renderField({ field: makeField({ is_required: true }) });
    expect(screen.getByText(/\*/)).toBeInTheDocument();
  });

  it("does not render an error message when error is not provided", () => {
    renderField();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders error message when error prop is provided", () => {
    renderField({ error: "You must check this box" });
    expect(screen.getByText("You must check this box")).toBeInTheDocument();
  });

  it("renders HTML description via dangerouslySetInnerHTML", () => {
    const { container } = renderField({
      field: makeField({ settings: { description: "<strong>Important</strong> agreement" } }),
    });
    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("Important");
  });

  it("renders nothing for description when settings.description is undefined", () => {
    const field = makeField({ settings: {} });
    const { container } = renderField({ field });
    // No visible description text beyond the required marker
    expect(container.textContent?.trim()).toBe("");
  });
});

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";

import { describe, expect, it, jest } from "@jest/globals";

import theme from "../../themes/theme";
import Form from "./Form";

function renderForm(overrides: Partial<React.ComponentProps<typeof Form>> = {}) {
  const defaultProps: React.ComponentProps<typeof Form> = {
    fields: [{ key: "name", label: "Name", type: "text", value: "" }],
    messages: { submitMessage: "Submit", secondarySubmitMessage: "Save as draft" },
    onSubmit: jest.fn(),
    ...overrides,
  };

  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <Form {...defaultProps} />
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

describe("Form secondary submit button", () => {
  it("does not render the secondary button when onSecondarySubmit is not provided", () => {
    renderForm();

    expect(screen.queryByRole("button", { name: "Save as draft" })).toBeNull();
  });

  it("hides the secondary button when the gating field is empty", () => {
    renderForm({
      onSecondarySubmit: jest.fn(),
      secondarySubmitEnabledField: "name",
    });

    expect(screen.queryByRole("button", { name: "Save as draft" })).toBeNull();
  });

  it("hides the secondary button when the gating field is only whitespace", () => {
    renderForm({
      fields: [{ key: "name", label: "Name", type: "text", value: "   " }],
      onSecondarySubmit: jest.fn(),
      secondarySubmitEnabledField: "name",
    });

    expect(screen.queryByRole("button", { name: "Save as draft" })).toBeNull();
  });

  it("shows the secondary button once the gating field has a value", () => {
    renderForm({
      fields: [{ key: "name", label: "Name", type: "text", value: "My Org" }],
      onSecondarySubmit: jest.fn(),
      secondarySubmitEnabledField: "name",
    });

    expect(screen.getByRole("button", { name: "Save as draft" })).toBeInTheDocument();
  });

  it("shows the secondary button when no gating field is specified", () => {
    renderForm({ onSecondarySubmit: jest.fn() });

    expect(screen.getByRole("button", { name: "Save as draft" })).toBeInTheDocument();
  });

  it("calls onSecondarySubmit with the current form values when clicked", () => {
    const onSecondarySubmit = jest.fn();
    renderForm({
      fields: [{ key: "name", label: "Name", type: "text", value: "My Org" }],
      onSecondarySubmit,
      secondarySubmitEnabledField: "name",
    });

    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(onSecondarySubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "My Org" }));
  });

  it("disables the secondary button and shows a loader while loadingSecondarySubmit is true", () => {
    renderForm({
      fields: [{ key: "name", label: "Name", type: "text", value: "My Org" }],
      onSecondarySubmit: jest.fn(),
      secondarySubmitEnabledField: "name",
      loadingSecondarySubmit: true,
    });

    const buttons = screen.getAllByRole("button");
    const secondaryButton = buttons.find((b) => !b.textContent?.includes("Submit"));
    expect(secondaryButton).toBeDisabled();
    expect(screen.queryByText("Save as draft")).toBeNull();
  });
});

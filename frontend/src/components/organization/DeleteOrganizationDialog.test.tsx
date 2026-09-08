import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";

import { describe, expect, it, jest } from "@jest/globals";

import theme from "../../themes/theme";
import DeleteOrganizationDialog from "./DeleteOrganizationDialog";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof DeleteOrganizationDialog>> = {}
) {
  const defaultProps = {
    onClose: jest.fn(),
    open: true,
    cancelText: "Cancel",
    confirmText: "Delete organisation",
    text: "This action is irreversible.",
    title: "Do you really want to delete your organisation?",
    className: "",
    showConfirmButton: true,
    ...overrides,
  };

  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <DeleteOrganizationDialog {...defaultProps} />
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

describe("DeleteOrganizationDialog", () => {
  it("renders title, content text, and both buttons by default", () => {
    renderDialog();

    expect(screen.getByText("Do you really want to delete your organisation?")).toBeTruthy();
    expect(screen.getByText("This action is irreversible.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete organisation" })).toBeTruthy();
  });

  it("calls onClose(false) when cancel button is clicked", () => {
    const onClose = jest.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("calls onClose(true) when confirm button is clicked", () => {
    const onClose = jest.fn();
    renderDialog({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Delete organisation" }));

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("hides confirm button when showConfirmButton is false", () => {
    renderDialog({ showConfirmButton: false });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete organisation" })).toBeNull();
  });

  it("does not render dialog content when open is false", () => {
    renderDialog({ open: false });

    expect(screen.queryByText("Do you really want to delete your organisation?")).toBeNull();
  });
});

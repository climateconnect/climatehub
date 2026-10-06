import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import InventoryFieldEditor from "./InventoryFieldEditor";
import { RegistrationFieldOption } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultContext = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
};

function renderEditor({
  title = "",
  description = "",
  options = [] as RegistrationFieldOption[],
  onChange = jest.fn(),
  onRequestDeleteOption = undefined as jest.Mock | undefined,
  titleDisabled = false,
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContext as any}>
        <InventoryFieldEditor
          title={title}
          description={description}
          options={options}
          onChange={onChange}
          onRequestDeleteOption={onRequestDeleteOption}
          titleDisabled={titleDisabled}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InventoryFieldEditor", () => {
  // ── Rendering ─────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the title input", () => {
      renderEditor();
      expect(screen.getByRole("textbox", { name: /title/i })).toBeInTheDocument();
    });

    it("renders the description input", () => {
      renderEditor();
      expect(screen.getByRole("textbox", { name: /description/i })).toBeInTheDocument();
    });

    it("renders the Add option button", () => {
      renderEditor();
      expect(screen.getByText(/add option/i)).toBeInTheDocument();
    });

    it("renders existing option titles", () => {
      renderEditor({
        options: [
          { title: "Panel A", order: 0, available_amount: 50, max_amount_per_guest: 2 },
          { title: "Panel B", order: 1, available_amount: 100, max_amount_per_guest: 3 },
        ],
      });
      expect(screen.getByDisplayValue("Panel A")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Panel B")).toBeInTheDocument();
    });

    it("renders available_amount and max_amount_per_guest inputs for each option", () => {
      renderEditor({
        options: [{ title: "Option A", order: 0, available_amount: 10, max_amount_per_guest: 2 }],
      });
      expect(screen.getByRole("spinbutton", { name: /available amount/i })).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: /max per guest/i })).toBeInTheDocument();
    });

    it("renders existing capacity values", () => {
      renderEditor({
        options: [{ title: "Option A", order: 0, available_amount: 50, max_amount_per_guest: 3 }],
      });
      expect(screen.getByDisplayValue("50")).toBeInTheDocument();
      expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    });
  });

  // ── Title change ──────────────────────────────────────────────────────────

  describe("title change", () => {
    it("calls onChange with updated title", () => {
      const onChange = jest.fn();
      renderEditor({ onChange });
      fireEvent.change(screen.getByRole("textbox", { name: /title/i }), {
        target: { value: "Refurbished Solar Panels" },
      });
      expect(onChange).toHaveBeenCalledWith({
        title: "Refurbished Solar Panels",
        description: "",
        options: [],
      });
    });
  });

  // ── Description change ────────────────────────────────────────────────────

  describe("description change", () => {
    it("calls onChange with updated description", () => {
      const onChange = jest.fn();
      renderEditor({ title: "Panels", onChange });
      fireEvent.change(screen.getByRole("textbox", { name: /description/i }), {
        target: { value: "Choose your panel type." },
      });
      expect(onChange).toHaveBeenCalledWith({
        title: "Panels",
        description: "Choose your panel type.",
        options: [],
      });
    });
  });

  // ── Adding options ────────────────────────────────────────────────────────

  describe("adding options", () => {
    it("calls onChange with a new empty option appended when Add option is clicked", () => {
      const onChange = jest.fn();
      renderEditor({ onChange });
      fireEvent.click(screen.getByText(/add option/i));
      const [{ options }] = onChange.mock.calls[0];
      expect(options).toHaveLength(1);
      expect(options[0]).toMatchObject({
        title: "",
        order: 0,
        available_amount: null,
        max_amount_per_guest: null,
      });
    });

    it("assigns an incremented order to a subsequent option", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [{ title: "Existing", order: 0, available_amount: 10, max_amount_per_guest: 1 }],
        onChange,
      });
      fireEvent.click(screen.getByText(/add option/i));
      const [{ options }] = onChange.mock.calls[0];
      expect(options[1].order).toBe(1);
    });
  });

  // ── Editing option fields ─────────────────────────────────────────────────

  describe("editing option fields", () => {
    it("calls onChange with updated option title", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [{ title: "Old label", order: 0, available_amount: 10, max_amount_per_guest: 1 }],
        onChange,
      });
      fireEvent.change(screen.getByDisplayValue("Old label"), {
        target: { value: "New label" },
      });
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0].title).toBe("New label");
    });

    it("calls onChange with updated available_amount", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [{ title: "Panel A", order: 0, available_amount: 10, max_amount_per_guest: 1 }],
        onChange,
      });
      fireEvent.change(screen.getByRole("spinbutton", { name: /available amount/i }), {
        target: { value: "99" },
      });
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0].available_amount).toBe(99);
    });

    it("calls onChange with updated max_amount_per_guest", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [{ title: "Panel A", order: 0, available_amount: 10, max_amount_per_guest: 1 }],
        onChange,
      });
      fireEvent.change(screen.getByRole("spinbutton", { name: /max per guest/i }), {
        target: { value: "5" },
      });
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0].max_amount_per_guest).toBe(5);
    });

    it("sets available_amount to null when the input is cleared", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [{ title: "Panel A", order: 0, available_amount: 10, max_amount_per_guest: 1 }],
        onChange,
      });
      fireEvent.change(screen.getByRole("spinbutton", { name: /available amount/i }), {
        target: { value: "" },
      });
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0].available_amount).toBeNull();
    });
  });

  // ── Deleting options ──────────────────────────────────────────────────────

  describe("deleting options", () => {
    it("calls onChange without the deleted option", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [
          { title: "Option A", order: 0, available_amount: 10, max_amount_per_guest: 1 },
          { title: "Option B", order: 1, available_amount: 20, max_amount_per_guest: 2 },
        ],
        onChange,
      });
      const deleteButtons = screen.getAllByRole("button", { name: /delete option/i });
      fireEvent.click(deleteButtons[0]);
      const [{ options }] = onChange.mock.calls[0];
      expect(options).toHaveLength(1);
      expect(options[0].title).toBe("Option B");
    });

    it("reassigns orders contiguously after deletion", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [
          { title: "A", order: 0, available_amount: 10, max_amount_per_guest: 1 },
          { title: "B", order: 1, available_amount: 20, max_amount_per_guest: 2 },
          { title: "C", order: 2, available_amount: 30, max_amount_per_guest: 3 },
        ],
        onChange,
      });
      const deleteButtons = screen.getAllByRole("button", { name: /delete option/i });
      fireEvent.click(deleteButtons[1]); // delete "B"
      const [{ options }] = onChange.mock.calls[0];
      expect(options).toHaveLength(2);
      expect(options[0]).toMatchObject({ title: "A", order: 0 });
      expect(options[1]).toMatchObject({ title: "C", order: 1 });
    });
  });

  // ── Answer-lock: titleDisabled ────────────────────────────────────────────

  describe("titleDisabled prop", () => {
    it("disables the title input when titleDisabled is true", () => {
      renderEditor({ title: "Panels", titleDisabled: true });
      expect(screen.getByRole("textbox", { name: /title/i })).toBeDisabled();
    });

    it("leaves the title input enabled when titleDisabled is false", () => {
      renderEditor({ title: "Panels", titleDisabled: false });
      expect(screen.getByRole("textbox", { name: /title/i })).not.toBeDisabled();
    });

    it("leaves the description input editable even when titleDisabled is true", () => {
      renderEditor({ titleDisabled: true });
      expect(screen.getByRole("textbox", { name: /description/i })).not.toBeDisabled();
    });
  });

  // ── Answer-lock: per-option title disabled ────────────────────────────────

  describe("option title disabled when has_answers", () => {
    it("disables the option title input when option has_answers is true", () => {
      renderEditor({
        options: [{ id: 1, title: "Panel A", order: 0, has_answers: true }],
      });
      expect(screen.getByDisplayValue("Panel A")).toBeDisabled();
    });

    it("leaves the option title input enabled when option has_answers is false", () => {
      renderEditor({
        options: [{ id: 1, title: "Panel A", order: 0, has_answers: false }],
      });
      expect(screen.getByDisplayValue("Panel A")).not.toBeDisabled();
    });

    it("leaves capacity inputs editable even when option has_answers is true", () => {
      renderEditor({
        options: [
          {
            id: 1,
            title: "Panel A",
            order: 0,
            has_answers: true,
            available_amount: 50,
            max_amount_per_guest: 2,
          },
        ],
      });
      expect(screen.getByRole("spinbutton", { name: /available amount/i })).not.toBeDisabled();
      expect(screen.getByRole("spinbutton", { name: /max per guest/i })).not.toBeDisabled();
    });
  });

  // ── Answer-lock: delete confirmation ─────────────────────────────────────

  describe("delete confirmation for options with answers", () => {
    it("calls onRequestDeleteOption instead of immediate delete when option has_answers is true", () => {
      const onChange = jest.fn();
      const onRequestDeleteOption = jest.fn();
      renderEditor({
        options: [{ id: 1, title: "Panel A", order: 0, has_answers: true }],
        onChange,
        onRequestDeleteOption,
      });
      fireEvent.click(screen.getByRole("button", { name: /delete option/i }));
      expect(onRequestDeleteOption).toHaveBeenCalledWith(0, expect.objectContaining({ id: 1 }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("deletes immediately when option has_answers is false even if option has an id", () => {
      const onChange = jest.fn();
      const onRequestDeleteOption = jest.fn();
      renderEditor({
        options: [{ id: 1, title: "Panel A", order: 0, has_answers: false }],
        onChange,
        onRequestDeleteOption,
      });
      fireEvent.click(screen.getByRole("button", { name: /delete option/i }));
      expect(onRequestDeleteOption).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();
    });
  });

  // ── Reordering options ────────────────────────────────────────────────────

  describe("reordering options", () => {
    const twoOptions: RegistrationFieldOption[] = [
      { title: "First", order: 0, available_amount: 10, max_amount_per_guest: 1 },
      { title: "Second", order: 1, available_amount: 20, max_amount_per_guest: 2 },
    ];

    it("moves an option down by swapping it with the next", () => {
      const onChange = jest.fn();
      renderEditor({ options: twoOptions, onChange });
      const moveDownButtons = screen.getAllByRole("button", { name: /move down/i });
      fireEvent.click(moveDownButtons[0]);
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0]).toMatchObject({ title: "Second", order: 0 });
      expect(options[1]).toMatchObject({ title: "First", order: 1 });
    });

    it("moves an option up by swapping it with the previous", () => {
      const onChange = jest.fn();
      renderEditor({ options: twoOptions, onChange });
      const moveUpButtons = screen.getAllByRole("button", { name: /move up/i });
      fireEvent.click(moveUpButtons[1]);
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0]).toMatchObject({ title: "Second", order: 0 });
      expect(options[1]).toMatchObject({ title: "First", order: 1 });
    });

    it("disables Move up for the first option", () => {
      renderEditor({ options: twoOptions });
      const moveUpButtons = screen.getAllByRole("button", { name: /move up/i });
      expect(moveUpButtons[0]).toBeDisabled();
      expect(moveUpButtons[1]).not.toBeDisabled();
    });

    it("disables Move down for the last option", () => {
      renderEditor({ options: twoOptions });
      const moveDownButtons = screen.getAllByRole("button", { name: /move down/i });
      expect(moveDownButtons[0]).not.toBeDisabled();
      expect(moveDownButtons[1]).toBeDisabled();
    });
  });
});

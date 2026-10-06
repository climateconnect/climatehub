import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import TimeSlotFieldEditor from "./TimeSlotFieldEditor";
import { RegistrationFieldOption } from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../general/DatePicker", () => ({
  __esModule: true,
  default: ({ label, date, handleChange, minDate }: any) => (
    <input
      aria-label={label}
      data-testid={`datepicker-${label}`}
      value={date ? date.toISOString() : ""}
      onChange={(e) => handleChange(e.target.value ? new Date(e.target.value) : null)}
      data-mindate={minDate ? minDate.toISOString() : ""}
    />
  ),
}));

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
  isDraft = false,
  fieldError = undefined as string | undefined,
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContext as any}>
        <TimeSlotFieldEditor
          title={title}
          description={description}
          options={options}
          onChange={onChange}
          onRequestDeleteOption={onRequestDeleteOption}
          titleDisabled={titleDisabled}
          isDraft={isDraft}
          fieldError={fieldError}
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

describe("TimeSlotFieldEditor", () => {
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

    it("renders start_time and end_time date pickers for each option", () => {
      renderEditor({
        options: [
          {
            title: "",
            order: 0,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
          },
        ],
      });
      expect(screen.getByTestId("datepicker-Start time")).toBeInTheDocument();
      expect(screen.getByTestId("datepicker-End time")).toBeInTheDocument();
    });

    it("renders the capacity input for each option", () => {
      renderEditor({
        options: [
          {
            title: "",
            order: 0,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
            available_amount: 20,
          },
        ],
      });
      expect(screen.getByRole("spinbutton", { name: /available amount/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    });
  });

  // ── Title change ──────────────────────────────────────────────────────────

  describe("title change", () => {
    it("calls onChange with updated title", () => {
      const onChange = jest.fn();
      renderEditor({ onChange });
      fireEvent.change(screen.getByRole("textbox", { name: /title/i }), {
        target: { value: "Pickup slot" },
      });
      expect(onChange).toHaveBeenCalledWith({
        title: "Pickup slot",
        description: "",
        options: [],
      });
    });
  });

  // ── Description change ────────────────────────────────────────────────────

  describe("description change", () => {
    it("calls onChange with updated description", () => {
      const onChange = jest.fn();
      renderEditor({ title: "Pickup", onChange });
      fireEvent.change(screen.getByRole("textbox", { name: /description/i }), {
        target: { value: "Choose when to pick up." },
      });
      expect(onChange).toHaveBeenCalledWith({
        title: "Pickup",
        description: "Choose when to pick up.",
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
        start_time: null,
        end_time: null,
        available_amount: null,
      });
    });

    it("assigns an incremented order to a subsequent option", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [
          {
            title: "",
            order: 0,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
          },
        ],
        onChange,
      });
      fireEvent.click(screen.getByText(/add option/i));
      const [{ options }] = onChange.mock.calls[0];
      expect(options[1].order).toBe(1);
    });
  });

  // ── Editing option capacity ───────────────────────────────────────────────

  describe("editing option capacity", () => {
    it("calls onChange with updated available_amount", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [
          {
            title: "",
            order: 0,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
            available_amount: 10,
          },
        ],
        onChange,
      });
      fireEvent.change(screen.getByRole("spinbutton", { name: /available amount/i }), {
        target: { value: "50" },
      });
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0].available_amount).toBe(50);
    });

    it("sets available_amount to null when the input is cleared", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [
          {
            title: "",
            order: 0,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
            available_amount: 10,
          },
        ],
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
          {
            title: "",
            order: 0,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
          },
          {
            title: "",
            order: 1,
            start_time: "2026-08-01T14:00:00Z",
            end_time: "2026-08-01T16:00:00Z",
          },
        ],
        onChange,
      });
      const deleteButtons = screen.getAllByRole("button", { name: /delete option/i });
      fireEvent.click(deleteButtons[0]);
      const [{ options }] = onChange.mock.calls[0];
      expect(options).toHaveLength(1);
      expect(options[0].order).toBe(0);
    });

    it("reassigns orders contiguously after deletion", () => {
      const onChange = jest.fn();
      renderEditor({
        options: [
          {
            title: "",
            order: 0,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
          },
          {
            title: "",
            order: 1,
            start_time: "2026-08-01T14:00:00Z",
            end_time: "2026-08-01T16:00:00Z",
          },
          {
            title: "",
            order: 2,
            start_time: "2026-08-01T18:00:00Z",
            end_time: "2026-08-01T20:00:00Z",
          },
        ],
        onChange,
      });
      const deleteButtons = screen.getAllByRole("button", { name: /delete option/i });
      fireEvent.click(deleteButtons[1]); // delete middle option
      const [{ options }] = onChange.mock.calls[0];
      expect(options).toHaveLength(2);
      expect(options[0]).toMatchObject({ order: 0 });
      expect(options[1]).toMatchObject({ order: 1 });
    });
  });

  // ── Answer-lock: titleDisabled ────────────────────────────────────────────

  describe("titleDisabled prop", () => {
    it("disables the title input when titleDisabled is true", () => {
      renderEditor({ title: "Pickup", titleDisabled: true });
      expect(screen.getByRole("textbox", { name: /title/i })).toBeDisabled();
    });

    it("leaves the title input enabled when titleDisabled is false", () => {
      renderEditor({ title: "Pickup", titleDisabled: false });
      expect(screen.getByRole("textbox", { name: /title/i })).not.toBeDisabled();
    });

    it("leaves the description input editable even when titleDisabled is true", () => {
      renderEditor({ titleDisabled: true });
      expect(screen.getByRole("textbox", { name: /description/i })).not.toBeDisabled();
    });
  });

  // ── Reordering options ────────────────────────────────────────────────────

  describe("reordering options", () => {
    const twoOptions: RegistrationFieldOption[] = [
      { title: "", order: 0, start_time: "2026-08-01T10:00:00Z", end_time: "2026-08-01T12:00:00Z" },
      { title: "", order: 1, start_time: "2026-08-01T14:00:00Z", end_time: "2026-08-01T16:00:00Z" },
    ];

    it("moves an option down by swapping it with the next", () => {
      const onChange = jest.fn();
      renderEditor({ options: twoOptions, onChange });
      const moveDownButtons = screen.getAllByRole("button", { name: /move down/i });
      fireEvent.click(moveDownButtons[0]);
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0]).toMatchObject({ order: 0, start_time: "2026-08-01T14:00:00Z" });
      expect(options[1]).toMatchObject({ order: 1, start_time: "2026-08-01T10:00:00Z" });
    });

    it("moves an option up by swapping it with the previous", () => {
      const onChange = jest.fn();
      renderEditor({ options: twoOptions, onChange });
      const moveUpButtons = screen.getAllByRole("button", { name: /move up/i });
      fireEvent.click(moveUpButtons[1]);
      const [{ options }] = onChange.mock.calls[0];
      expect(options[0]).toMatchObject({ order: 0, start_time: "2026-08-01T14:00:00Z" });
      expect(options[1]).toMatchObject({ order: 1, start_time: "2026-08-01T10:00:00Z" });
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

  // ── isDraft prop ──────────────────────────────────────────────────────────

  describe("isDraft prop", () => {
    it("does not mark title as required when isDraft is true", () => {
      renderEditor({ isDraft: true });
      expect(screen.getByRole("textbox", { name: /title/i })).not.toBeRequired();
    });

    it("marks title as required when isDraft is false", () => {
      renderEditor({ isDraft: false });
      expect(screen.getByRole("textbox", { name: /title/i })).toBeRequired();
    });
  });

  // ── Error display ────────────────────────────────────────────────────────

  describe("fieldError on title", () => {
    it("shows error text on title input when fieldError is provided", () => {
      renderEditor({ fieldError: "This field is required." });
      expect(screen.getByText("This field is required.")).toBeInTheDocument();
    });

    it("marks title input as invalid when fieldError is provided", () => {
      renderEditor({ fieldError: "This field is required." });
      expect(screen.getByRole("textbox", { name: /title/i })).toBeInvalid();
    });

    it("does not show error when fieldError is not provided", () => {
      renderEditor();
      expect(screen.queryByText("This field is required.")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /title/i })).not.toHaveAttribute(
        "aria-invalid",
        "true"
      );
    });
  });

  // ── Delete confirmation for options with answers ──────────────────────────

  describe("delete confirmation for options with answers", () => {
    it("calls onRequestDeleteOption instead of immediate delete when option has_answers is true", () => {
      const onChange = jest.fn();
      const onRequestDeleteOption = jest.fn();
      renderEditor({
        options: [
          {
            id: 1,
            title: "",
            order: 0,
            has_answers: true,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
          },
        ],
        onChange,
        onRequestDeleteOption,
      });
      fireEvent.click(screen.getByRole("button", { name: /delete option/i }));
      expect(onRequestDeleteOption).toHaveBeenCalledWith(0, expect.objectContaining({ id: 1 }));
      expect(onChange).not.toHaveBeenCalled();
    });

    it("deletes immediately when option has_answers is false", () => {
      const onChange = jest.fn();
      const onRequestDeleteOption = jest.fn();
      renderEditor({
        options: [
          {
            id: 1,
            title: "",
            order: 0,
            has_answers: false,
            start_time: "2026-08-01T10:00:00Z",
            end_time: "2026-08-01T12:00:00Z",
          },
        ],
        onChange,
        onRequestDeleteOption,
      });
      fireEvent.click(screen.getByRole("button", { name: /delete option/i }));
      expect(onRequestDeleteOption).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();
    });
  });
});

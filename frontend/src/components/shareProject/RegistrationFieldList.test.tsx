import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import RegistrationFieldList from "./RegistrationFieldList";
import { RegistrationField } from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Avoid tiptap browser-API dependency in tests
jest.mock("./CheckboxFieldEditor", () => ({
  __esModule: true,
  default: ({ description, onChange }: any) => (
    <textarea
      data-testid="checkbox-description"
      value={description}
      onChange={(e) => onChange(e.target.value)}
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

function renderFieldList({ fields = [] as RegistrationField[], onFieldsChange = jest.fn() } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={defaultContext as any}>
          <RegistrationFieldList fields={fields} onFieldsChange={onFieldsChange} />
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

function makeField(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    field_type: "checkbox",
    order: 0,
    is_required: false,
    label: "Checkbox 1",
    settings: { description: "" },
    _clientKey: `test_key_${Math.random()}`,
    ...overrides,
  };
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

describe("RegistrationFieldList", () => {
  // ── Spec test case 1: empty state ─────────────────────────────────────────

  describe("empty state", () => {
    it("renders the Add field button", () => {
      renderFieldList();
      expect(screen.getByRole("button", { name: /add field/i })).toBeInTheDocument();
    });

    it("renders no field cards when fields array is empty", () => {
      renderFieldList();
      expect(screen.queryByRole("button", { name: /delete field/i })).not.toBeInTheDocument();
    });
  });

  // ── Spec test case 2: add checkbox field and verify rendered card ──────────

  describe("checkbox field rendering", () => {
    it("renders field label, description editor, and required toggle for a checkbox field", () => {
      renderFieldList({ fields: [makeField()] });
      expect(screen.getByText("Checkbox 1")).toBeInTheDocument();
      expect(screen.getByTestId("checkbox-description")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /required/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete field/i })).toBeInTheDocument();
    });
  });

  // ── Spec test case 3: add option select field and verify rendered card ─────

  describe("option select field rendering", () => {
    it("renders field label, title input, and add option button for an option_select field", () => {
      renderFieldList({
        fields: [
          makeField({
            field_type: "option_select",
            label: "Single choice 1",
            settings: { title: "" },
            options: [],
          }),
        ],
      });
      expect(screen.getByText("Single choice 1")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /title/i })).toBeInTheDocument();
      expect(screen.getByText(/add option/i)).toBeInTheDocument();
    });
  });

  // ── Inventory field rendering ─────────────────────────────────────────────

  describe("inventory field rendering", () => {
    it("renders the field label for an inventory field", () => {
      renderFieldList({
        fields: [
          makeField({
            field_type: "inventory",
            label: "Inventory 1",
            settings: { title: "", description: "" },
            options: [],
          }),
        ],
      });
      expect(screen.getByText("Inventory 1")).toBeInTheDocument();
    });
  });

  // ── Adding fields via type picker ─────────────────────────────────────────

  describe("adding fields", () => {
    it("opens type picker menu when Add field is clicked", () => {
      renderFieldList();
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      expect(screen.getByRole("menuitem", { name: /checkbox/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /single choice/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /inventory/i })).toBeInTheDocument();
    });

    it("calls onFieldsChange with a checkbox field with default label when Checkbox is selected", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /checkbox/i }));
      expect(onFieldsChange).toHaveBeenCalledTimes(1);
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        field_type: "checkbox",
        order: 0,
        is_required: false,
        label: "Checkbox 1",
        settings: { description: "" },
      });
    });

    it("calls onFieldsChange with an option_select field when Single choice is selected", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /single choice/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[0]).toMatchObject({
        field_type: "option_select",
        order: 0,
        is_required: false,
        label: "Single choice 1",
        options: [],
      });
    });

    it("calls onFieldsChange with an inventory field when Inventory is selected", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /inventory/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[0]).toMatchObject({
        field_type: "inventory",
        order: 0,
        is_required: false,
        label: "Inventory 1",
        settings: { title: "", description: "" },
        options: [],
      });
    });

    it("assigns an incremented order to additional fields", () => {
      const onFieldsChange = jest.fn();
      const existing = makeField({ order: 0 });
      renderFieldList({ fields: [existing], onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /checkbox/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[1].order).toBe(1);
    });
  });

  // ── Default label generation ──────────────────────────────────────────────

  describe("default label generation", () => {
    it("generates 'Checkbox 1' for the first checkbox field", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /checkbox/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[0].label).toBe("Checkbox 1");
    });

    it("generates 'Checkbox 2' when a checkbox already exists", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({
        fields: [makeField({ field_type: "checkbox", label: "Checkbox 1" })],
        onFieldsChange,
      });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /checkbox/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[1].label).toBe("Checkbox 2");
    });

    it("generates per-type labels independently", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({
        fields: [
          makeField({ field_type: "checkbox", label: "Checkbox 1", order: 0, _clientKey: "k1" }),
          makeField({
            field_type: "checkbox",
            label: "Checkbox 2",
            order: 1,
            _clientKey: "k2",
          }),
        ],
        onFieldsChange,
      });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /single choice/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[2].label).toBe("Single choice 1");
    });

    it("skips taken default labels and picks the next available number", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({
        fields: [
          makeField({ field_type: "checkbox", label: "Checkbox 1", order: 0, _clientKey: "k1" }),
          makeField({
            field_type: "checkbox",
            label: "Checkbox 3",
            order: 1,
            _clientKey: "k2",
          }),
        ],
        onFieldsChange,
      });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /checkbox/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[2].label).toBe("Checkbox 2");
    });

    it("skips manually-set labels that match the default pattern", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({
        fields: [
          makeField({ field_type: "checkbox", label: "Checkbox 1", order: 0, _clientKey: "k1" }),
          makeField({
            field_type: "checkbox",
            label: "Checkbox 2",
            order: 1,
            _clientKey: "k2",
          }),
          makeField({
            field_type: "checkbox",
            label: "Checkbox 3",
            order: 2,
            _clientKey: "k3",
          }),
        ],
        onFieldsChange,
      });
      fireEvent.click(screen.getByRole("button", { name: /add field/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /checkbox/i }));
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[3].label).toBe("Checkbox 4");
    });
  });

  // ── Inline label editing ──────────────────────────────────────────────────

  describe("inline label editing", () => {
    it("replaces type text with the label value in the field header", () => {
      renderFieldList({ fields: [makeField({ label: "My custom label" })] });
      expect(screen.getByText("My custom label")).toBeInTheDocument();
    });

    it("shows a pencil icon next to the label", () => {
      renderFieldList({ fields: [makeField()] });
      expect(screen.getByRole("button", { name: /edit label/i })).toBeInTheDocument();
    });

    it("replaces label with a text input when pencil icon is clicked", () => {
      renderFieldList({ fields: [makeField({ label: "Checkbox 1" })] });
      fireEvent.click(screen.getByRole("button", { name: /edit label/i }));
      const input = screen.getByRole("textbox", { name: /field label/i });
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("Checkbox 1");
    });

    it("saves the new label on blur", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: [makeField({ label: "Checkbox 1" })], onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /edit label/i }));
      const input = screen.getByRole("textbox", { name: /field label/i });
      fireEvent.change(input, { target: { value: "New label" } });
      fireEvent.blur(input);
      expect(onFieldsChange).toHaveBeenCalledTimes(1);
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[0].label).toBe("New label");
    });

    it("saves the new label on Enter key", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: [makeField({ label: "Checkbox 1" })], onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /edit label/i }));
      const input = screen.getByRole("textbox", { name: /field label/i });
      fireEvent.change(input, { target: { value: "Enter label" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onFieldsChange).toHaveBeenCalledTimes(1);
      const [fields] = onFieldsChange.mock.calls[0];
      expect(fields[0].label).toBe("Enter label");
    });

    it("the TextField has maxLength=30", () => {
      renderFieldList({ fields: [makeField()] });
      fireEvent.click(screen.getByRole("button", { name: /edit label/i }));
      const input = screen.getByRole("textbox", { name: /field label/i });
      expect(input).toHaveAttribute("maxLength", "30");
    });

    it("restores the previous label when empty value is saved", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: [makeField({ label: "Keep me" })], onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /edit label/i }));
      const input = screen.getByRole("textbox", { name: /field label/i });
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.blur(input);
      expect(onFieldsChange).not.toHaveBeenCalled();
    });

    it("rejects a duplicate label and shows error", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({
        fields: [
          makeField({ label: "Checkbox 1", order: 0, _clientKey: "k1" }),
          makeField({ label: "Checkbox 2", order: 1, _clientKey: "k2" }),
        ],
        onFieldsChange,
      });
      const editButtons = screen.getAllByRole("button", { name: /edit label/i });
      fireEvent.click(editButtons[0]);
      const input = screen.getByRole("textbox", { name: /field label/i });
      fireEvent.change(input, { target: { value: "Checkbox 2" } });
      fireEvent.blur(input);
      expect(onFieldsChange).not.toHaveBeenCalled();
      expect(screen.getByText(/label already used/i)).toBeInTheDocument();
    });

    it("cancels editing on Escape key", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: [makeField({ label: "Original" })], onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /edit label/i }));
      const input = screen.getByRole("textbox", { name: /field label/i });
      fireEvent.change(input, { target: { value: "Changed" } });
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onFieldsChange).not.toHaveBeenCalled();
      expect(screen.getByText("Original")).toBeInTheDocument();
    });
  });

  // ── Spec test case 4: max 15 fields limit ─────────────────────────────────

  describe("max fields limit", () => {
    it("disables the Add field button when 15 fields are already present", () => {
      const fields = Array.from({ length: 15 }, (_, i) =>
        makeField({ order: i, label: `Field ${i + 1}`, _clientKey: `key_${i}` })
      );
      renderFieldList({ fields });
      expect(screen.getByRole("button", { name: /add field/i })).toBeDisabled();
    });

    it("shows the max-reached message on the button when 10 fields are present", () => {
      const fields = Array.from({ length: 15 }, (_, i) =>
        makeField({ order: i, label: `Field ${i + 1}`, _clientKey: `key_${i}` })
      );
      renderFieldList({ fields });
      expect(screen.getByText(/maximum of 15 fields reached/i)).toBeInTheDocument();
    });
  });

  // ── Spec test case 5: reordering fields ───────────────────────────────────

  describe("reordering fields", () => {
    const twoFields: RegistrationField[] = [
      makeField({ field_type: "checkbox", order: 0, label: "Checkbox 1", _clientKey: "k1" }),
      makeField({
        field_type: "option_select",
        order: 1,
        label: "Single choice 1",
        settings: { title: "" },
        options: [],
        _clientKey: "k2",
      }),
    ];

    it("swaps field types and orders when Move down is clicked on the first field", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: twoFields, onFieldsChange });
      const moveDownButtons = screen.getAllByRole("button", { name: /move down/i });
      fireEvent.click(moveDownButtons[0]);
      const [result] = onFieldsChange.mock.calls[0];
      expect(result[0]).toMatchObject({ field_type: "option_select", order: 0 });
      expect(result[1]).toMatchObject({ field_type: "checkbox", order: 1 });
    });

    it("swaps field types and orders when Move up is clicked on the second field", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: twoFields, onFieldsChange });
      const moveUpButtons = screen.getAllByRole("button", { name: /move up/i });
      fireEvent.click(moveUpButtons[1]);
      const [result] = onFieldsChange.mock.calls[0];
      expect(result[0]).toMatchObject({ field_type: "option_select", order: 0 });
      expect(result[1]).toMatchObject({ field_type: "checkbox", order: 1 });
    });

    it("disables Move up for the first field", () => {
      renderFieldList({ fields: twoFields });
      const moveUpButtons = screen.getAllByRole("button", { name: /move up/i });
      expect(moveUpButtons[0]).toBeDisabled();
      expect(moveUpButtons[1]).not.toBeDisabled();
    });

    it("disables Move down for the last field", () => {
      renderFieldList({ fields: twoFields });
      const moveDownButtons = screen.getAllByRole("button", { name: /move down/i });
      expect(moveDownButtons[0]).not.toBeDisabled();
      expect(moveDownButtons[1]).toBeDisabled();
    });
  });

  // ── Deleting fields ────────────────────────────────────────────────────────

  describe("deleting fields", () => {
    it("calls onFieldsChange with an empty array when the only field is deleted", () => {
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: [makeField()], onFieldsChange });
      fireEvent.click(screen.getByRole("button", { name: /delete field/i }));
      expect(onFieldsChange).toHaveBeenCalledWith([]);
    });

    it("reassigns orders contiguously after deleting the middle field", () => {
      const fields: RegistrationField[] = [
        makeField({ order: 0, label: "Checkbox 1", _clientKey: "k1" }),
        makeField({
          field_type: "option_select",
          order: 1,
          label: "Single choice 1",
          settings: { title: "" },
          options: [],
          _clientKey: "k2",
        }),
        makeField({ order: 2, label: "Checkbox 2", _clientKey: "k3" }),
      ];
      const onFieldsChange = jest.fn();
      renderFieldList({ fields, onFieldsChange });
      const deleteButtons = screen.getAllByRole("button", { name: /delete field/i });
      fireEvent.click(deleteButtons[1]); // delete field at index 1
      const [result] = onFieldsChange.mock.calls[0];
      expect(result).toHaveLength(2);
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
    });
  });

  // ── Required toggle ────────────────────────────────────────────────────────

  describe("required toggle", () => {
    it("calls onFieldsChange with is_required=true when the toggle is switched on", () => {
      const field = makeField({ is_required: false });
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: [field], onFieldsChange });
      fireEvent.click(screen.getByRole("checkbox", { name: /required/i }));
      const [result] = onFieldsChange.mock.calls[0];
      expect(result[0].is_required).toBe(true);
    });

    it("calls onFieldsChange with is_required=false when the toggle is switched off", () => {
      const field = makeField({ is_required: true });
      const onFieldsChange = jest.fn();
      renderFieldList({ fields: [field], onFieldsChange });
      fireEvent.click(screen.getByRole("checkbox", { name: /required/i }));
      const [result] = onFieldsChange.mock.calls[0];
      expect(result[0].is_required).toBe(false);
    });
  });

  // ── Answer-lock: delete confirmation ─────────────────────────────────────

  describe("delete confirmation for fields with answers", () => {
    function renderWithDeleteCallback(fields: RegistrationField[]) {
      const onFieldsChange = jest.fn();
      const onRequestDeleteField = jest.fn();
      render(
        <ThemeProvider theme={theme}>
          <StylesThemeProvider theme={theme}>
            <UserContext.Provider value={defaultContext as any}>
              <RegistrationFieldList
                fields={fields}
                onFieldsChange={onFieldsChange}
                onRequestDeleteField={onRequestDeleteField}
              />
            </UserContext.Provider>
          </StylesThemeProvider>
        </ThemeProvider>
      );
      return { onFieldsChange, onRequestDeleteField };
    }

    it("calls onRequestDeleteField instead of immediate delete when has_answers is true", () => {
      const field = makeField({ id: 1, has_answers: true });
      const { onFieldsChange, onRequestDeleteField } = renderWithDeleteCallback([field]);
      fireEvent.click(screen.getByRole("button", { name: /delete field/i }));
      expect(onRequestDeleteField).toHaveBeenCalledWith(0, field);
      expect(onFieldsChange).not.toHaveBeenCalled();
    });

    it("deletes immediately (no callback) when has_answers is false even if field has an id", () => {
      const field = makeField({ id: 1, has_answers: false });
      const { onFieldsChange, onRequestDeleteField } = renderWithDeleteCallback([field]);
      fireEvent.click(screen.getByRole("button", { name: /delete field/i }));
      expect(onRequestDeleteField).not.toHaveBeenCalled();
      expect(onFieldsChange).toHaveBeenCalledWith([]);
    });

    it("deletes immediately when has_answers is undefined", () => {
      const field = makeField({ id: 1 }); // has_answers not set
      const { onFieldsChange, onRequestDeleteField } = renderWithDeleteCallback([field]);
      fireEvent.click(screen.getByRole("button", { name: /delete field/i }));
      expect(onRequestDeleteField).not.toHaveBeenCalled();
      expect(onFieldsChange).toHaveBeenCalledWith([]);
    });
  });
});

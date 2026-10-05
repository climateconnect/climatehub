import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import ViewRegistrationAnswersModal, {
  ViewRegistrationAnswersModalRegistration,
} from "./ViewRegistrationAnswersModal";
import { RegistrationField, RegistrationFieldAnswer } from "../../types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const defaultContextValue = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
};

function makeCheckboxField(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 10,
    field_type: "checkbox",
    order: 0,
    is_required: false,
    label: "Checkbox 1",
    settings: { description: "I agree to the terms" },
    ...overrides,
  };
}

function makeOptionField(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 20,
    field_type: "option_select",
    order: 1,
    is_required: false,
    label: "Single choice 1",
    settings: { title: "T-shirt size" },
    options: [
      { id: 201, title: "Small", order: 0 },
      { id: 202, title: "Medium", order: 1 },
      { id: 203, title: "Large", order: 2 },
    ],
    ...overrides,
  };
}

function makeRegistration(
  overrides: Partial<ViewRegistrationAnswersModalRegistration> = {}
): ViewRegistrationAnswersModalRegistration {
  return {
    user_first_name: "Jane",
    user_last_name: "Doe",
    cancelled_at: null,
    field_answers: [],
    ...overrides,
  };
}

function renderModal({
  open = true,
  onClose = jest.fn(),
  registration = makeRegistration(),
  fields = [] as RegistrationField[],
  cancelAction,
  title = "Registration answers from Jane Doe",
}: {
  open?: boolean;
  onClose?: jest.Mock;
  registration?: ViewRegistrationAnswersModalRegistration | null;
  fields?: RegistrationField[];
  cancelAction?: { onCancelClick: jest.Mock };
  title?: string;
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContextValue as any}>
        <ViewRegistrationAnswersModal
          open={open}
          onClose={onClose}
          registration={registration}
          title={title}
          fields={fields}
          cancelAction={cancelAction}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ViewRegistrationAnswersModal", () => {
  describe("rendering control", () => {
    it("renders nothing when registration is null", () => {
      const { container } = renderModal({ registration: null });
      // Dialog should not be in the document
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when open is false and registration is null", () => {
      renderModal({ open: false, registration: null });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does not show dialog when open is false but registration is supplied", () => {
      renderModal({ open: false, registration: makeRegistration() });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders dialog when open is true", () => {
      renderModal({ open: true, registration: makeRegistration() });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  describe("title", () => {
    it("renders the registrant's full name in the title", () => {
      renderModal({
        registration: makeRegistration({
          user_first_name: "Alice",
          user_last_name: "Schmidt",
        }),
        title: "Registration answers from Alice Schmidt",
      });
      expect(screen.getByText(/Alice Schmidt/)).toBeInTheDocument();
    });
  });

  describe("close behaviour", () => {
    it("calls onClose when the close icon button is clicked", () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      // Icon button + footer button both share the "close" label.
      const closeButtons = screen.getAllByRole("button", { name: /close/i });
      fireEvent.click(closeButtons[0]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the Close action button is clicked", () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      // There are two close buttons (icon + action). Both should call onClose.
      const closeButtons = screen.getAllByRole("button", { name: /close/i });
      fireEvent.click(closeButtons[closeButtons.length - 1]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("empty / no-answer states", () => {
    it("does not show empty-state message when the event has no custom fields", () => {
      renderModal({ registration: makeRegistration({ field_answers: [] }), fields: [] });
      expect(screen.queryByText(/no answers submitted/i)).not.toBeInTheDocument();
    });

    it("shows empty-state message when there are fields but no answers", () => {
      renderModal({
        registration: makeRegistration({ field_answers: [] }),
        fields: [makeCheckboxField()],
      });
      expect(screen.getByText(/no answers submitted/i)).toBeInTheDocument();
    });

    it("skips fields that have no matching answer (registered before field was added)", () => {
      const checkbox = makeCheckboxField({ id: 10, settings: { description: "Old field" } });
      const option = makeOptionField({ id: 20 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 20, value_boolean: null, value_option: 202 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [checkbox, option],
      });
      expect(screen.queryByText("Old field")).not.toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
    });
  });

  describe("checkbox answers", () => {
    it("renders the checkbox description for a checked answer", () => {
      const field = makeCheckboxField({
        id: 10,
        settings: { description: "I agree to the terms" },
      });
      const answers: RegistrationFieldAnswer[] = [
        { field: 10, value_boolean: true, value_option: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      expect(screen.getByText(/I agree to the terms/i)).toBeInTheDocument();
    });

    it("renders the 'checked' indicator icon for true answers", () => {
      const field = makeCheckboxField({ id: 10 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 10, value_boolean: true, value_option: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      expect(screen.getByLabelText(/^Checked$/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/^Not checked$/i)).not.toBeInTheDocument();
    });

    it("does not render the checkbox field when the answer is false (user did not check it)", () => {
      const field = makeCheckboxField({ id: 10 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 10, value_boolean: false, value_option: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      expect(screen.queryByText(/I agree to the terms/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Checked$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Not checked$/i)).not.toBeInTheDocument();
    });

    it("renders the checkbox indicator as a non-interactive element (not an input)", () => {
      const field = makeCheckboxField({ id: 10 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 10, value_boolean: true, value_option: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      // Read-only display — no checkbox input should be rendered.
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("renders HTML description from the field settings", () => {
      const field = makeCheckboxField({
        id: 10,
        settings: { description: "<strong>Important</strong> agreement" },
      });
      const answers: RegistrationFieldAnswer[] = [
        { field: 10, value_boolean: true, value_option: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      // Dialog is rendered in a portal on document.body, not the container.
      const strong = document.body.querySelector("strong");
      expect(strong).toBeInTheDocument();
      expect(strong).toHaveTextContent("Important");
    });
  });

  describe("option-select answers", () => {
    it("renders the field title and selected option title", () => {
      const field = makeOptionField({ id: 20 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 20, value_boolean: null, value_option: 202 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      expect(screen.getByText("T-shirt size")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
    });

    it("renders only the selected option, not the other options", () => {
      const field = makeOptionField({ id: 20 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 20, value_boolean: null, value_option: 202 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      expect(screen.queryByText("Small")).not.toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.queryByText("Large")).not.toBeInTheDocument();
    });

    it("renders no-selection placeholder when value_option does not match any option", () => {
      const field = makeOptionField({ id: 20 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 20, value_boolean: null, value_option: 999 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      expect(screen.getByText(/no selection/i)).toBeInTheDocument();
    });

    it("does not render an interactive radio group", () => {
      const field = makeOptionField({ id: 20 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 20, value_boolean: null, value_option: 202 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [field],
      });
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });
  });

  describe("field ordering", () => {
    it("renders fields in field.order sequence, not field_answers order", () => {
      const first = makeOptionField({
        id: 20,
        order: 0,
        settings: { title: "First field" },
        options: [{ id: 201, title: "Alpha", order: 0 }],
      });
      const second = makeCheckboxField({
        id: 10,
        order: 1,
        settings: { description: "Second field description" },
      });
      // Answers supplied in reverse order to confirm the component uses
      // field.order, not the answer array order, for rendering.
      const answers: RegistrationFieldAnswer[] = [
        { field: 10, value_boolean: true, value_option: null },
        { field: 20, value_boolean: null, value_option: 201 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [second, first],
      });

      const dialog = screen.getByRole("dialog");
      const dialogText = dialog.textContent ?? "";
      const firstIdx = dialogText.indexOf("First field");
      const secondIdx = dialogText.indexOf("Second field description");
      expect(firstIdx).toBeGreaterThan(-1);
      expect(secondIdx).toBeGreaterThan(-1);
      expect(firstIdx).toBeLessThan(secondIdx);
    });
  });

  describe("cancelled registrations", () => {
    it("shows the cancelled notice when cancelled_at is set", () => {
      renderModal({
        registration: makeRegistration({ cancelled_at: "2026-05-15T12:00:00Z" }),
      });
      expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    });

    it("does not show the cancelled notice for active registrations", () => {
      renderModal({ registration: makeRegistration({ cancelled_at: null }) });
      expect(screen.queryByText(/this registration has been cancelled/i)).not.toBeInTheDocument();
    });

    it("still renders answers for cancelled registrations (historical record)", () => {
      const field = makeOptionField({ id: 20 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 20, value_boolean: null, value_option: 203 },
      ];
      renderModal({
        registration: makeRegistration({
          cancelled_at: "2026-05-15T12:00:00Z",
          field_answers: answers,
        }),
        fields: [field],
      });
      expect(screen.getByText("Large")).toBeInTheDocument();
    });
  });

  describe("mixed field types", () => {
    it("renders both checkbox and option-select answers together", () => {
      const checkbox = makeCheckboxField({
        id: 10,
        order: 0,
        settings: { description: "I accept the code of conduct" },
      });
      const option = makeOptionField({ id: 20, order: 1 });
      const answers: RegistrationFieldAnswer[] = [
        { field: 10, value_boolean: true, value_option: null },
        { field: 20, value_boolean: null, value_option: 201 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [checkbox, option],
      });
      expect(screen.getByText(/I accept the code of conduct/)).toBeInTheDocument();
      expect(screen.getByText("T-shirt size")).toBeInTheDocument();
      expect(screen.getByText("Small")).toBeInTheDocument();
      expect(screen.getByLabelText(/^Checked$/i)).toBeInTheDocument();
    });
  });

  describe("inventory fields", () => {
    it("renders the field title and the selected option with quantity", () => {
      const inventory: RegistrationField = {
        id: 30,
        field_type: "inventory",
        order: 0,
        is_required: false,
        label: "Inventory 1",
        settings: { title: "Pick a T-shirt" },
        options: [
          { id: 301, title: "Small", order: 0 },
          { id: 302, title: "Large", order: 1 },
        ],
      };
      const answers: RegistrationFieldAnswer[] = [
        { field: 30, value_boolean: null, value_option: 302, value_number: 2 },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [inventory],
      });
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Pick a T-shirt")).toBeInTheDocument();
      expect(within(dialog).getByText(/Large\s*\u00d7\s*2/)).toBeInTheDocument();
    });

    it("falls back to 'No selection' when no option was chosen", () => {
      const inventory: RegistrationField = {
        id: 31,
        field_type: "inventory",
        order: 0,
        is_required: false,
        label: "Inventory 2",
        settings: { title: "Inventory item" },
        options: [],
      };
      const answers: RegistrationFieldAnswer[] = [
        { field: 31, value_boolean: null, value_option: null, value_number: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [inventory],
      });
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Inventory item")).toBeInTheDocument();
      expect(within(dialog).getByText(/no selection/i)).toBeInTheDocument();
    });
  });

  describe("time_slot_select fields", () => {
    it("renders the field title and the formatted time range of the selected slot", () => {
      const timeSlot: RegistrationField = {
        id: 40,
        field_type: "time_slot_select",
        order: 0,
        is_required: false,
        label: "Time slots",
        settings: { title: "Choose a time slot" },
        options: [
          {
            id: 401,
            title: "Morning",
            order: 0,
            start_time: "2026-07-01T09:00:00Z",
            end_time: "2026-07-01T11:00:00Z",
          },
        ],
      };
      const answers: RegistrationFieldAnswer[] = [
        { field: 40, value_boolean: null, value_option: 401, value_number: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [timeSlot],
      });
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Choose a time slot")).toBeInTheDocument();
      // Time-range string contains an en-dash between start and end times.
      expect(within(dialog).getByText(/\u2013/)).toBeInTheDocument();
    });

    it("falls back to the option title when start/end times are missing", () => {
      const timeSlot: RegistrationField = {
        id: 41,
        field_type: "time_slot_select",
        order: 0,
        is_required: false,
        label: "Time slots",
        settings: { title: "Choose a time slot" },
        options: [{ id: 411, title: "Afternoon", order: 0 }],
      };
      const answers: RegistrationFieldAnswer[] = [
        { field: 41, value_boolean: null, value_option: 411, value_number: null },
      ];
      renderModal({
        registration: makeRegistration({ field_answers: answers }),
        fields: [timeSlot],
      });
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Afternoon")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // cancelAction prop — guest self-cancel (spec 20260526_1130)
  // ---------------------------------------------------------------------------

  describe("cancelAction prop", () => {
    it("does not render a cancel button when cancelAction is omitted (organiser context unchanged)", () => {
      renderModal({ registration: makeRegistration() });
      // Only the icon-button close and the footer Close button should be present.
      const buttons = screen.getAllByRole("button");
      const cancelBtn = buttons.find((b) => /cancel registration/i.test(b.textContent ?? ""));
      expect(cancelBtn).toBeUndefined();
    });

    it("renders a 'Cancel registration' button when cancelAction is provided (guest self-cancel)", () => {
      renderModal({
        registration: makeRegistration(),
        cancelAction: { onCancelClick: jest.fn() },
      });
      expect(screen.getByRole("button", { name: /cancel registration/i })).toBeInTheDocument();
    });

    it("calls onCancelClick when the cancel button is clicked", () => {
      const onCancelClick = jest.fn();
      renderModal({
        registration: makeRegistration(),
        cancelAction: { onCancelClick },
      });
      fireEvent.click(screen.getByRole("button", { name: /cancel registration/i }));
      expect(onCancelClick).toHaveBeenCalledTimes(1);
    });

    it("cancel button is distinct from the Close button — Close still calls onClose", () => {
      const onClose = jest.fn();
      const onCancelClick = jest.fn();
      renderModal({
        onClose,
        registration: makeRegistration(),
        cancelAction: { onCancelClick },
      });
      // Click the footer Close button (last button).
      const buttons = screen.getAllByRole("button");
      const closeBtn = buttons.find((b) => /^close$/i.test(b.textContent ?? ""));
      fireEvent.click(closeBtn!);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCancelClick).not.toHaveBeenCalled();
    });
  });
});

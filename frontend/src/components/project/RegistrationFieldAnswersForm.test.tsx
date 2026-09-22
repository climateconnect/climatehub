import React, { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import RegistrationFieldAnswersForm, {
  RegistrationFieldAnswersFormHandle,
} from "./RegistrationFieldAnswersForm";
import { RegistrationField, RegistrationFieldOption } from "../../types";
import UserContext from "../context/UserContext";

const texts = {
  this_field_is_required: "This field is required",
  you_must_check_this_box: "You must check this box",
  please_select_an_option: "Please select an option",
  please_select_inventory_option: "Please select an inventory option",
  please_enter_quantity: "Please enter a quantity",
  quantity_available: "available",
  max_per_guest: "Max per guest",
  quantity_exceeds_max: "Quantity exceeds max",
  inventory_sold_out: "Sold out",
  please_select_time_slot: "Please select a time slot",
  seats_available: "seats available",
  registration_text_field_required_error: "Please answer this question.",
  registration_text_field_max_length_error: "Maximum 300 characters.",
};

function makeCheckboxField(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 11,
    field_type: "checkbox",
    order: 1,
    is_required: true,
    label: "Checkbox 1",
    settings: { description: "I accept the rules" },
    ...overrides,
  };
}

function makeOptionField(overrides: Partial<RegistrationField> = {}): RegistrationField {
  return {
    id: 22,
    field_type: "option_select",
    order: 2,
    is_required: true,
    label: "Single choice 1",
    settings: { title: "T-shirt size" },
    options: [
      { id: 102, title: "M", order: 1 },
      { id: 101, title: "S", order: 0 },
    ],
    ...overrides,
  };
}

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

function renderForm({
  fields,
  serverErrors,
  ref,
  onFirstInteraction,
}: {
  fields: RegistrationField[];
  serverErrors?: Record<number, string>;
  ref?: React.RefObject<RegistrationFieldAnswersFormHandle>;
  onFirstInteraction?: () => void;
}) {
  return render(
    <UserContext.Provider value={{ locale: "en" } as any}>
      <ThemeProvider theme={theme}>
        <StylesThemeProvider theme={theme}>
          <RegistrationFieldAnswersForm
            ref={ref}
            fields={fields}
            serverErrors={serverErrors}
            onFirstInteraction={onFirstInteraction}
            texts={texts}
          />
        </StylesThemeProvider>
      </ThemeProvider>
    </UserContext.Provider>
  );
}

describe("RegistrationFieldAnswersForm", () => {
  it("renders fields in order", () => {
    renderForm({
      fields: [
        makeOptionField({ order: 2, settings: { title: "Second field" } }),
        makeCheckboxField({ order: 1, settings: { description: "First field" } }),
      ],
    });

    const pageText = document.body.textContent ?? "";
    expect(pageText.indexOf("First field")).toBeLessThan(pageText.indexOf("Second field"));
  });

  it("returns null and shows required errors when validate fails", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [makeCheckboxField(), makeOptionField()],
    });

    let result: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      result = formRef.current?.validate() ?? null;
    });

    expect(result).toBeNull();
    expect(screen.getByText(texts.you_must_check_this_box)).toBeInTheDocument();
    const optionErrorMessages = screen.getAllByText(texts.please_select_an_option);
    expect(optionErrorMessages.length).toBeGreaterThanOrEqual(2);
    expect(optionErrorMessages.some((el) => el.tagName === "P")).toBe(true);
  });

  it("clears field errors on change and returns answers when valid", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [makeCheckboxField(), makeOptionField()],
    });

    act(() => {
      formRef.current?.validate();
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "102" } });

    expect(screen.queryByText(texts.you_must_check_this_box)).not.toBeInTheDocument();
    const optionErrorMessages = screen.queryAllByText(texts.please_select_an_option);
    const hasErrorParagraph = optionErrorMessages.some((el) => el.tagName === "P");
    expect(hasErrorParagraph).toBe(false);

    let answers: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      answers = formRef.current?.validate() ?? null;
    });

    expect(answers).toEqual([
      { fieldId: 11, valueBoolean: true },
      { fieldId: 22, valueOption: 102 },
    ]);
  });

  it("renders server errors for matching field ids", () => {
    renderForm({
      fields: [makeCheckboxField({ is_required: false }), makeOptionField({ is_required: false })],
      serverErrors: {
        11: "Server checkbox error",
        22: "Server option error",
      },
    });

    expect(screen.getByText("Server checkbox error")).toBeInTheDocument();
    expect(screen.getByText("Server option error")).toBeInTheDocument();
  });

  it("includes false value for unchecked optional checkbox on validate", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [makeCheckboxField({ id: 33, is_required: false, order: 0 })],
    });

    let answers: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      answers = formRef.current?.validate() ?? null;
    });

    expect(answers).toEqual([{ fieldId: 33, valueBoolean: false }]);
  });
});

describe("RegistrationFieldAnswersForm inventory fields", () => {
  it("seeds the single option, shows no dropdown, and validates with entered quantity", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [
        makeInventoryField([
          {
            id: 201,
            title: "Number of people",
            order: 0,
            remaining_amount: 200,
            max_amount_per_guest: 5,
          },
        ]),
      ],
    });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Number of people (200 available)")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2" } });

    let answers: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      answers = formRef.current?.validate() ?? null;
    });

    expect(answers).toEqual([{ fieldId: 44, valueOption: 201, valueNumber: 2 }]);
  });

  it("blocks submit for required single-option field with empty quantity", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [makeInventoryField([{ id: 201, title: "Number of people", order: 0 }])],
    });

    let result: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      result = formRef.current?.validate() ?? null;
    });

    expect(result).toBeNull();
    expect(screen.getByText(texts.please_enter_quantity)).toBeInTheDocument();
  });

  it("submits no answer for optional single-option field with empty quantity", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [
        makeInventoryField([{ id: 201, title: "Number of people", order: 0 }], {
          is_required: false,
        }),
      ],
    });

    let answers: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      answers = formRef.current?.validate() ?? null;
    });

    expect(answers).toEqual([]);
    expect(screen.queryByText(texts.please_enter_quantity)).not.toBeInTheDocument();
  });

  it("blocks submit for required sold-out single-option field with sold-out error", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [
        makeInventoryField([{ id: 201, title: "Number of people", order: 0, remaining_amount: 0 }]),
      ],
    });

    expect(screen.getByText("Number of people (Sold out)")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    let result: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      result = formRef.current?.validate() ?? null;
    });

    expect(result).toBeNull();
    expect(screen.getByText(texts.inventory_sold_out)).toBeInTheDocument();
  });

  it("submits no answer for optional sold-out single-option field", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [
        makeInventoryField(
          [{ id: 201, title: "Number of people", order: 0, remaining_amount: 0 }],
          { is_required: false }
        ),
      ],
    });

    let answers: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      answers = formRef.current?.validate() ?? null;
    });

    expect(answers).toEqual([]);
    expect(screen.queryByText(texts.inventory_sold_out)).not.toBeInTheDocument();
  });

  it("keeps the dropdown for multi-option inventory fields without seeding an answer", () => {
    const formRef = createRef<RegistrationFieldAnswersFormHandle>();

    renderForm({
      ref: formRef,
      fields: [
        makeInventoryField([
          { id: 201, title: "Solar module", order: 0, remaining_amount: 0 },
          { id: 202, title: "Wind turbine", order: 1, remaining_amount: 5 },
        ]),
      ],
    });

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    let result: ReturnType<RegistrationFieldAnswersFormHandle["validate"]> = null;
    act(() => {
      result = formRef.current?.validate() ?? null;
    });

    expect(result).toBeNull();
    const errorMessages = screen.getAllByText(texts.please_select_inventory_option);
    expect(errorMessages.some((el) => el.tagName === "P")).toBe(true);
  });

  it("does not fire onFirstInteraction for the automatic single-option default", () => {
    const onFirstInteraction = jest.fn();

    renderForm({
      fields: [
        makeInventoryField([{ id: 201, title: "Number of people", order: 0 }], {
          is_required: false,
        }),
      ],
      onFirstInteraction,
    });

    expect(onFirstInteraction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "1" } });

    expect(onFirstInteraction).toHaveBeenCalledTimes(1);
  });
});

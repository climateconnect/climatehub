import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import SignupPersonalInfoStep from "./SignupPersonalInfoStep";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the LocationSearchBar component
jest.mock("../search/LocationSearchBar", () => {
  return function MockLocationSearchBar({ onSelect, value, label, required }: any) {
    return (
      <div data-testid="location-search-bar">
        <label htmlFor="location-input">
          {label}
          {required && " *"}
        </label>
        <input
          id="location-input"
          data-testid="location-input"
          type="text"
          value={value?.name || ""}
          onChange={(e) => {
            // Simulate selecting a location
            if (e.target.value) {
              onSelect({
                city: e.target.value,
                country: "Test Country",
                name: `${e.target.value}, Test Country`,
              });
            }
          }}
        />
      </div>
    );
  };
});

// Mock the isLocationValid function
jest.mock("../../../public/lib/locationOperations", () => ({
  isLocationValid: (location: any) => {
    return location && location.city && location.country;
  },
}));

// Mock getTexts
jest.mock("../../../public/texts/texts", () => {
  return jest.fn(() => ({
    create_your_account: "Create your account",
    signup_step_1_headline: "Tell us a bit about yourself to get started on Climate Connect.",
    email: "Email",
    email_cannot_be_changed: "This is the email you'll use to log in",
    first_name: "First name",
    first_name_is_required: "First name is required",
    last_name: "Last name",
    last_name_is_required: "Last name is required",
    location: "Location",
    please_choose_one_of_the_location_options: "Please choose a valid location from the dropdown",
    agree_to_tos_and_privacy_policy_with_email_consent:
      "I agree to the terms of service and privacy policy and would like to receive emails about updates, news and interesting projects",
    you_must_accept_terms_and_privacy_policy:
      "You must accept the terms of service and privacy policy",
    back: "Back",
    continue: "Continue",
  }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContextValue(locale: "en" | "de" = "en") {
  return {
    locale: locale,
    user: null,
    locales: [] as any,
    pathName: "/",
    donationGoals: [],
    hubUrl: "",
    signIn: jest.fn(),
  };
}

function renderSignupPersonalInfoStep({
  email = "test@example.com",
  onContinue = jest.fn(),
  onBack = jest.fn(),
  hubUrl = undefined,
  locale = "en" as "en" | "de",
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(locale) as any}>
        <SignupPersonalInfoStep
          email={email}
          onContinue={onContinue}
          onBack={onBack}
          hubUrl={hubUrl}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("SignupPersonalInfoStep", () => {
  describe("rendering", () => {
    it("renders heading and description", () => {
      renderSignupPersonalInfoStep();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Create your account");
      expect(screen.getByText(/tell us a bit about yourself/i)).toBeInTheDocument();
    });

    it("renders email field as disabled with the provided email", () => {
      renderSignupPersonalInfoStep({ email: "user@example.com" });

      const emailInput = screen.getByDisplayValue("user@example.com");
      expect(emailInput).toBeDisabled();
      expect(emailInput).toHaveValue("user@example.com");
    });

    it("renders first name input field", () => {
      renderSignupPersonalInfoStep();

      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });

    it("renders last name input field", () => {
      renderSignupPersonalInfoStep();

      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    });

    it("renders location search bar", () => {
      renderSignupPersonalInfoStep();

      expect(screen.getByTestId("location-search-bar")).toBeInTheDocument();
    });

    it("renders privacy/terms and newsletter checkbox", () => {
      renderSignupPersonalInfoStep();

      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      expect(screen.getByText(/i agree to the/i)).toBeInTheDocument();
      expect(screen.getByText(/terms of service/i)).toBeInTheDocument();
      expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
    });

    it("renders Back and Continue buttons", () => {
      renderSignupPersonalInfoStep();

      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows error when Continue is clicked with empty first name", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Fill last name, location, and check terms
      fireEvent.change(screen.getByLabelText(/last name/i), {
        target: { value: "User" },
      });
      fireEvent.change(screen.getByTestId("location-input"), {
        target: { value: "Berlin" },
      });
      fireEvent.click(screen.getByRole("checkbox"));

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
        expect(onContinue).not.toHaveBeenCalled();
      });
    });

    it("shows error when Continue is clicked with empty last name", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Fill first name, location, and check terms
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "Test" },
      });
      fireEvent.change(screen.getByTestId("location-input"), {
        target: { value: "Berlin" },
      });
      fireEvent.click(screen.getByRole("checkbox"));

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
        expect(onContinue).not.toHaveBeenCalled();
      });
    });

    it("shows error when Continue is clicked without location", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Fill names and check terms
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "Test" },
      });
      fireEvent.change(screen.getByLabelText(/last name/i), {
        target: { value: "User" },
      });
      fireEvent.click(screen.getByRole("checkbox"));

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/please choose a valid location/i)).toBeInTheDocument();
        expect(onContinue).not.toHaveBeenCalled();
      });
    });

    it("shows error when Continue is clicked without accepting terms", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Fill all fields but don't check terms
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "Test" },
      });
      fireEvent.change(screen.getByLabelText(/last name/i), {
        target: { value: "User" },
      });
      fireEvent.change(screen.getByTestId("location-input"), {
        target: { value: "Berlin" },
      });

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/you must accept the terms/i)).toBeInTheDocument();
        expect(onContinue).not.toHaveBeenCalled();
      });
    });

    it("clears error when user starts typing after validation error", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Trigger validation error
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      });

      // Start typing in first name
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "T" },
      });

      await waitFor(() => {
        expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("calls onContinue with correct data when all fields are valid", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Fill all required fields
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "Test" },
      });
      fireEvent.change(screen.getByLabelText(/last name/i), {
        target: { value: "User" },
      });
      fireEvent.change(screen.getByTestId("location-input"), {
        target: { value: "Berlin" },
      });
      fireEvent.click(screen.getByRole("checkbox"));

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(onContinue).toHaveBeenCalledWith({
          first_name: "Test",
          last_name: "User",
          location: expect.objectContaining({
            city: "Berlin",
            country: "Test Country",
          }),
          send_newsletter: true,
        });
      });
    });

    it("trims whitespace from first and last names", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Fill with names that have leading/trailing whitespace
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "  Test  " },
      });
      fireEvent.change(screen.getByLabelText(/last name/i), {
        target: { value: "  User  " },
      });
      fireEvent.change(screen.getByTestId("location-input"), {
        target: { value: "Berlin" },
      });
      fireEvent.click(screen.getByRole("checkbox"));

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(onContinue).toHaveBeenCalledWith(
          expect.objectContaining({
            first_name: "Test",
            last_name: "User",
          })
        );
      });
    });

    it("sets send_newsletter to true when terms checkbox is checked", async () => {
      const onContinue = jest.fn();
      renderSignupPersonalInfoStep({ onContinue });

      // Fill all fields
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "Test" },
      });
      fireEvent.change(screen.getByLabelText(/last name/i), {
        target: { value: "User" },
      });
      fireEvent.change(screen.getByTestId("location-input"), {
        target: { value: "Berlin" },
      });
      fireEvent.click(screen.getByRole("checkbox"));

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(onContinue).toHaveBeenCalledWith(
          expect.objectContaining({
            send_newsletter: true,
          })
        );
      });
    });
  });

  describe("navigation", () => {
    it("calls onBack when Back button is clicked", () => {
      const onBack = jest.fn();
      renderSignupPersonalInfoStep({ onBack });

      fireEvent.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has proper required attributes on required fields", () => {
      renderSignupPersonalInfoStep();

      expect(screen.getByLabelText(/first name/i)).toBeRequired();
      expect(screen.getByLabelText(/last name/i)).toBeRequired();
    });

    it("displays error messages with proper accessibility", async () => {
      renderSignupPersonalInfoStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        // Check that error messages are displayed (they use FormHelperText with error prop)
        const errorMessages = screen.getAllByText(/is required|must accept/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });
});

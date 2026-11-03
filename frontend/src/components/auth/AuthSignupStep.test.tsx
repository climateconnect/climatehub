import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import AuthSignupStep from "./AuthSignupStep";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

// Mock parseLocation
jest.mock("../../../public/lib/locationOperations", () => ({
  parseLocation: (location: any) => ({
    city: location.city,
    country: location.country,
  }),
}));

// Mock SignupPersonalInfoStep
jest.mock("./SignupPersonalInfoStep", () => {
  return function MockSignupPersonalInfoStep({ email, onContinue, onBack }: any) {
    return (
      <div data-testid="signup-personal-info-step">
        <div>Email: {email}</div>
        <button onClick={onBack}>Back</button>
        <button
          onClick={() =>
            onContinue({
              first_name: "Test",
              last_name: "User",
              location: { city: "Berlin", country: "Germany" },
              send_newsletter: true,
            })
          }
        >
          Continue
        </button>
      </div>
    );
  };
});

// Mock SignupInterestsStep
jest.mock("./SignupInterestsStep", () => {
  return function MockSignupInterestsStep({
    email,
    onSubmit,
    onBack,
    isLoading,
    errorMessage,
  }: any) {
    return (
      <div data-testid="signup-interests-step">
        <div>Email: {email}</div>
        {errorMessage && <div role="alert">{errorMessage}</div>}
        <button onClick={onBack} disabled={isLoading}>
          Back
        </button>
        <button onClick={() => onSubmit({ interest_sectors: ["1", "2"] })} disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </div>
    );
  };
});

// Mock getTexts
jest.mock("../../../public/texts/texts", () => {
  return jest.fn(() => ({
    an_error_occurred_please_try_again: "An error occurred. Please try again.",
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

function renderAuthSignupStep({
  email = "test@example.com",
  onBack = jest.fn(),
  onSignupComplete = jest.fn(),
  hubUrl = undefined,
  locale = "en" as "en" | "de",
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(locale) as any}>
        <AuthSignupStep
          email={email}
          onBack={onBack}
          onSignupComplete={onSignupComplete}
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
  mockApiRequest.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("AuthSignupStep", () => {
  describe("initial rendering", () => {
    it("renders SignupPersonalInfoStep initially", () => {
      renderAuthSignupStep();

      expect(screen.getByTestId("signup-personal-info-step")).toBeInTheDocument();
      expect(screen.queryByTestId("signup-interests-step")).not.toBeInTheDocument();
    });

    it("passes email to SignupPersonalInfoStep", () => {
      renderAuthSignupStep({ email: "user@example.com" });

      expect(screen.getByText("Email: user@example.com")).toBeInTheDocument();
    });
  });

  describe("step navigation", () => {
    it("transitions to interests step when personal info is completed", async () => {
      renderAuthSignupStep();

      expect(screen.getByTestId("signup-personal-info-step")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.queryByTestId("signup-personal-info-step")).not.toBeInTheDocument();
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });
    });

    it("passes personal info data to interests step", async () => {
      renderAuthSignupStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });
    });

    it("goes back to personal info step when back is clicked on interests step", async () => {
      renderAuthSignupStep();

      // Go to step 2
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      // Go back to step 1
      const backButtons = screen.getAllByRole("button", { name: /back/i });
      fireEvent.click(backButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId("signup-personal-info-step")).toBeInTheDocument();
        expect(screen.queryByTestId("signup-interests-step")).not.toBeInTheDocument();
      });
    });

    it("calls onBack when back is clicked on personal info step", () => {
      const onBack = jest.fn();
      renderAuthSignupStep({ onBack });

      fireEvent.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("account creation", () => {
    it("calls signup API with correct data when create account is clicked", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user: { id: 1 } } }); // signup
      mockApiRequest.mockResolvedValueOnce({ data: { session_key: "abc123" } }); // request-token

      const onSignupComplete = jest.fn();
      renderAuthSignupStep({ email: "newuser@example.com", onSignupComplete });

      // Go to step 2
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      // Create account
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "post",
            url: "/signup/",
            payload: expect.objectContaining({
              email: "newuser@example.com",
              first_name: "Test",
              last_name: "User",
              location: { city: "Berlin", country: "Germany" },
              send_newsletter: true,
              sectors: ["1", "2"],
            }),
          })
        );
      });
    });

    it("calls onSignupComplete after signup succeeds", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user: { id: 1 } } }); // signup

      const onSignupComplete = jest.fn();
      renderAuthSignupStep({ email: "newuser@example.com", onSignupComplete });

      // Go to step 2
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      // Create account
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      // Wait for signup call
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "post",
            url: "/signup/",
          })
        );
      });

      //Wait for onSignupComplete to be called
      await waitFor(() => {
        expect(onSignupComplete).toHaveBeenCalled();
      });
    });

    it("calls onSignupComplete after both APIs succeed", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user: { id: 1 } } }); // signup

      const onSignupComplete = jest.fn();
      renderAuthSignupStep({ onSignupComplete });

      // Go to step 2 and create account
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(onSignupComplete).toHaveBeenCalled();
      });
    });

    it("includes hub parameter when hubUrl is provided", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user: { id: 1 } } });

      renderAuthSignupStep({ hubUrl: "berlin" });

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              hub: "berlin",
            }),
          })
        );
      });
    });

    it("sends empty string for hub when hubUrl is not provided", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user: { id: 1 } } });

      renderAuthSignupStep({ hubUrl: undefined });

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              hub: "",
            }),
          })
        );
      });
    });
  });

  describe("error handling", () => {
    it("displays error message when signup API fails", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { message: "Email already exists" } },
      });

      renderAuthSignupStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Email already exists")).toBeInTheDocument();
      });
    });

    it("handles signup API error with detail field", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { detail: "Invalid location" } },
      });

      renderAuthSignupStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Invalid location")).toBeInTheDocument();
      });
    });

    it("handles signup API error with array response", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: ["First error message"] },
      });

      renderAuthSignupStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("First error message")).toBeInTheDocument();
      });
    });

    it("displays generic error when no specific error message available", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: {} },
      });

      renderAuthSignupStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/an error occurred/i)).toBeInTheDocument();
      });
    });

    it("does not call onSignupComplete if signup fails", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { message: "Signup failed" } },
      });

      const onSignupComplete = jest.fn();
      renderAuthSignupStep({ onSignupComplete });

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(1); // Only signup call
        expect(onSignupComplete).not.toHaveBeenCalled();
      });
    });

    it("clears error message when going back to step 1", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { message: "Error" } },
      });

      renderAuthSignupStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
      });

      // Go back
      const backButtons = screen.getAllByRole("button", { name: /back/i });
      fireEvent.click(backButtons[0]);

      // Go forward again
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.queryByText("Error")).not.toBeInTheDocument();
      });
    });
  });

  describe("loading state", () => {
    it("shows loading state while creating account", async () => {
      let resolveSignup: any;
      mockApiRequest.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSignup = resolve;
        })
      );

      renderAuthSignupStep();

      fireEvent.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-interests-step")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
      });

      // Resolve the promise
      resolveSignup({ data: { user: { id: 1 } } });
      mockApiRequest.mockResolvedValueOnce({ data: { session_key: "abc123" } });
    });
  });
});

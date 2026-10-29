import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import AuthEmailStep from "./AuthEmailStep";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockReactGAEvent = jest.fn();

function makeContextValue(locale: "en" | "de" = "en") {
  return {
    locale: locale,
    user: null,
    locales: [] as any,
    pathName: "/",
    donationGoals: [],
    hubUrl: "",
    signIn: jest.fn(),
    ReactGA: { event: mockReactGAEvent },
  };
}

function renderAuthEmailStep({
  onUserStatusDetermined = jest.fn(),
  hubUrl = undefined,
  locale = "en" as "en" | "de",
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(locale) as any}>
        <AuthEmailStep onUserStatusDetermined={onUserStatusDetermined} hubUrl={hubUrl} />
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

describe("AuthEmailStep", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mockApiRequest.mockReset();
  });

  describe("rendering", () => {
    it("renders heading and subtitle", () => {
      renderAuthEmailStep();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome!");
      expect(
        screen.getByText(/register or log in with your existing account/i)
      ).toBeInTheDocument();
    });

    it("renders the email input field", () => {
      renderAuthEmailStep();

      expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    });

    it("renders the Next button", () => {
      renderAuthEmailStep();

      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });
  });

  describe("button state", () => {
    it("Next button is disabled when email is empty", () => {
      renderAuthEmailStep();

      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("Next button is enabled when email is entered", () => {
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });

      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    });

    it("Next button is disabled when email is cleared", () => {
      renderAuthEmailStep();

      const input = screen.getByRole("textbox", { name: /email/i });
      fireEvent.change(input, { target: { value: "user@example.com" } });
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();

      fireEvent.change(input, { target: { value: "" } });
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
  });

  describe("submission", () => {
    it("calls onUserStatusDetermined with 'returning_otp' on success", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user_status: "returning_otp" } });
      const onUserStatusDetermined = jest.fn();
      renderAuthEmailStep({ onUserStatusDetermined });

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "existing@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(onUserStatusDetermined).toHaveBeenCalledWith(
          "returning_otp",
          "existing@example.com"
        );
      });
    });

    it("calls onUserStatusDetermined with 'returning_password' on success", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user_status: "returning_password" } });
      const onUserStatusDetermined = jest.fn();
      renderAuthEmailStep({ onUserStatusDetermined });

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "existing@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(onUserStatusDetermined).toHaveBeenCalledWith(
          "returning_password",
          "existing@example.com"
        );
      });
    });

    it("calls onUserStatusDetermined with 'new' for unknown email", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user_status: "new" } });
      const onUserStatusDetermined = jest.fn();
      renderAuthEmailStep({ onUserStatusDetermined });

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "newuser@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(onUserStatusDetermined).toHaveBeenCalledWith("new", "newuser@example.com");
      });
    });

    it("normalizes email to lowercase before submission", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user_status: "new" } });
      const onUserStatusDetermined = jest.fn();
      renderAuthEmailStep({ onUserStatusDetermined });

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "NewUser@Example.COM" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(onUserStatusDetermined).toHaveBeenCalledWith("new", "newuser@example.com");
      });
    });
  });

  describe("loading state", () => {
    it("shows a loading spinner while submitting", async () => {
      mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("Next button is disabled while loading", async () => {
      // Never resolve — keeps loading state true indefinitely
      mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      // Button is replaced by spinner; verify spinner is visible
      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });
    });
  });

  describe("error handling", () => {
    it("shows error message from response.detail", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { detail: "Too many requests. Please try again later." } },
      });
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Too many requests. Please try again later."
        );
      });
    });

    it("shows error message from response.message", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { message: "Something went wrong." } },
      });
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
      });
    });

    it("shows error message from response.email field error", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { email: ["Enter a valid email address."] } },
      });
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "not-an-email" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
      });
    });

    it("shows generic error message when API error has no structured message", async () => {
      mockApiRequest.mockRejectedValueOnce({ response: { data: {} } });
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
      });
    });
  });

  describe("i18n", () => {
    it("renders German translations when locale is 'de'", () => {
      renderAuthEmailStep({ locale: "de" });

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Willkommen!");
      expect(
        screen.getByText(/anmelden oder mit bestehendem account einloggen/i)
      ).toBeInTheDocument();
    });
  });

  describe("analytics", () => {
    beforeEach(() => {
      mockReactGAEvent.mockClear();
    });

    it("tracks auth_email_entered on successful submission", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user_status: "new" } });
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "newuser@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(mockReactGAEvent).toHaveBeenCalledWith("auth_email_entered", {
          locale: "en",
          user_status: "new",
        });
      });
    });

    it("tracks auth_email_entered with hub_slug when provided", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { user_status: "returning_otp" } });
      renderAuthEmailStep({ hubUrl: "berlin" });

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(mockReactGAEvent).toHaveBeenCalledWith("auth_email_entered", {
          locale: "en",
          hub_slug: "berlin",
          user_status: "returning_otp",
        });
      });
    });

    it("tracks auth_email_error on API failure", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 429, data: { detail: "Too many requests" } },
      });
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(mockReactGAEvent).toHaveBeenCalledWith("auth_email_error", {
          locale: "en",
          error_type: "rate_limit",
        });
      });
    });

    it("tracks auth_email_error with validation type on field error", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { email: ["Enter a valid email address."] } },
      });
      renderAuthEmailStep();

      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "bad-email" },
      });
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(mockReactGAEvent).toHaveBeenCalledWith("auth_email_error", {
          locale: "en",
          error_type: "validation",
        });
      });
    });
  });
});

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import AuthOtp from "./AuthOtp";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

jest.useFakeTimers();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockSignIn = jest.fn();

function makeContextValue(locale: "en" | "de" = "en") {
  return {
    locale,
    user: null,
    locales: [] as any,
    pathName: "/",
    donationGoals: [],
    hubUrl: "",
    signIn: mockSignIn,
  };
}

function renderAuthOtp({
  email = "user@example.com",
  onBack = jest.fn(),
  onSuccess = jest.fn(),
  hubUrl = undefined,
  locale = "en" as "en" | "de",
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(locale) as any}>
        <AuthOtp email={email} onBack={onBack} onSuccess={onSuccess} hubUrl={hubUrl} />
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
  window.sessionStorage.clear();
  // Default: request-token succeeds
  mockApiRequest.mockResolvedValue({ data: { session_key: "test-session-key" } });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

describe("AuthOtp", () => {
  describe("rendering", () => {
    it("renders heading and subtitle", async () => {
      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/user@example\.com/)).toBeInTheDocument();
    });

    it("renders the code input field", async () => {
      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
      expect(screen.getByRole("textbox", { name: /6-digit code/i })).toBeInTheDocument();
    });

    it("renders verify, resend, and back buttons", async () => {
      renderAuthOtp();
      // Wait for request-token to complete and countdown to show
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /resend code \(180s\)/i })).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /verify/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });
  });

  describe("request-token on mount", () => {
    it("calls request-token with the email on mount", async () => {
      renderAuthOtp({ email: "test@example.com" });
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "post",
            url: "/api/auth/request-token",
            payload: { email: "test@example.com" },
          })
        );
      });
    });

    it("stores session_key in sessionStorage", async () => {
      renderAuthOtp();
      await waitFor(() => {
        expect(sessionStorage.getItem("auth_session_key")).toBe("test-session-key");
      });
    });

    it("starts resend countdown after token is requested", async () => {
      renderAuthOtp();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /resend code \(180s\)/i })).toBeInTheDocument();
      });
    });
  });

  describe("code input", () => {
    it("only accepts numeric characters", async () => {
      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "abc123def" } });
      expect(input).toHaveValue("123");
    });

    it("limits input to 6 characters", async () => {
      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "1234567890" } });
      expect(input).toHaveValue("123456");
    });

    it("verify button is disabled when code is fewer than 6 digits", async () => {
      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "123" } });
      expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
    });

    it("verify button is enabled when 6 digits are entered", async () => {
      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "123456" } });
      expect(screen.getByRole("button", { name: /verify/i })).not.toBeDisabled();
    });
  });

  describe("submit success", () => {
    it("calls verify-token and then signIn on success", async () => {
      mockApiRequest
        .mockResolvedValueOnce({ data: { session_key: "test-session-key" } }) // request-token
        .mockResolvedValueOnce({
          data: { token: "auth-token", expiry: "2099-01-01", user: { id: 1 } },
        }); // verify-token

      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: /verify/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "post",
            url: "/api/auth/verify-token",
            payload: { session_key: "test-session-key", code: "123456" },
          })
        );
        expect(mockSignIn).toHaveBeenCalledWith("auth-token", "2099-01-01");
      });
    });

    it("calls onSuccess callback on success", async () => {
      const onSuccess = jest.fn();
      mockApiRequest
        .mockResolvedValueOnce({ data: { session_key: "test-session-key" } })
        .mockResolvedValueOnce({
          data: { token: "auth-token", expiry: "2099-01-01", user: { id: 1 } },
        });

      renderAuthOtp({ onSuccess });
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(screen.getByRole("button", { name: /verify/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith();
      });
    });
  });

  describe("submit failure", () => {
    it("shows expired error and starts resend countdown", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { session_key: "key" } }).mockRejectedValueOnce({
        response: { data: { detail: "Code expired. Please request a new one." } },
      });

      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      // Advance past initial countdown
      act(() => {
        jest.advanceTimersByTime(180000);
      });

      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/expired/i);
      });
    });

    it("shows too many attempts error and starts resend countdown", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { session_key: "key" } }).mockRejectedValueOnce({
        response: { data: { detail: "Too many attempts. Please request a new code." } },
      });

      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
      act(() => {
        jest.advanceTimersByTime(180000);
      });

      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/too many attempts/i);
      });
    });

    it("shows invalid code error", async () => {
      mockApiRequest
        .mockResolvedValueOnce({ data: { session_key: "key" } })
        .mockRejectedValueOnce({ response: { data: { detail: "Invalid code." } } });

      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
      act(() => {
        jest.advanceTimersByTime(180000);
      });

      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/incorrect code/i);
      });
    });

    it("clears the code input after failure", async () => {
      mockApiRequest
        .mockResolvedValueOnce({ data: { session_key: "key" } })
        .mockRejectedValueOnce({ response: { data: { detail: "Invalid code." } } });

      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
      act(() => {
        jest.advanceTimersByTime(180000);
      });

      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(screen.getByRole("button", { name: /verify/i }));

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });
  });

  describe("resend", () => {
    it("resend button is disabled during countdown", async () => {
      renderAuthOtp();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /resend code \(180s\)/i })).toBeDisabled();
      });
    });

    it("resend button becomes enabled after countdown expires", async () => {
      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      act(() => {
        jest.advanceTimersByTime(180000);
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^resend code$/i })).not.toBeDisabled();
      });
    });

    it("clicking resend calls request-token again and clears input", async () => {
      mockApiRequest
        .mockResolvedValueOnce({ data: { session_key: "key1" } })
        .mockResolvedValueOnce({ data: { session_key: "key2" } });

      renderAuthOtp();
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));

      // Enter some code
      const input = screen.getByRole("textbox", { name: /6-digit code/i });
      fireEvent.change(input, { target: { value: "123456" } });

      // Advance past countdown
      act(() => {
        jest.advanceTimersByTime(180000);
      });

      const resendBtn = await screen.findByRole("button", { name: /^resend code$/i });
      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledTimes(2);
        expect(sessionStorage.getItem("auth_session_key")).toBe("key2");
        expect(input).toHaveValue("");
      });
    });
  });

  describe("back navigation", () => {
    it("calls onBack when Back button is clicked", async () => {
      const onBack = jest.fn();
      renderAuthOtp({ onBack });
      await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());

      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("removes session_key from sessionStorage when Back is clicked", async () => {
      renderAuthOtp();
      await waitFor(() => {
        expect(sessionStorage.getItem("auth_session_key")).toBe("test-session-key");
      });

      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(sessionStorage.getItem("auth_session_key")).toBeNull();
    });
  });
});

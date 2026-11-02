import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import AuthPasswordLogin from "./AuthPasswordLogin";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  getLocalePrefix: (locale: string) => (locale === "en" ? "" : `/${locale}`),
}));

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

const defaultProps = {
  email: "user@example.com",
  onBack: jest.fn(),
  onSwitchToOtp: jest.fn(),
  onForgotPassword: jest.fn(),
  onSuccess: jest.fn(),
};

function renderComponent(props: Partial<typeof defaultProps> & { locale?: "en" | "de" } = {}) {
  const { locale = "en", ...rest } = props;
  const mergedProps = { ...defaultProps, ...rest };

  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(locale) as any}>
        <AuthPasswordLogin {...mergedProps} />
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

describe("AuthPasswordLogin", () => {
  describe("rendering", () => {
    it("renders the heading", () => {
      renderComponent();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    it("renders the password input", () => {
      renderComponent();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("renders the Log in button", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    });

    it("renders the Forgot password button", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /forgot your password/i })).toBeInTheDocument();
    });

    it("renders the Use a code instead button", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /use a code instead/i })).toBeInTheDocument();
    });

    it("renders the Back button", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    });
  });

  describe("empty-password validation", () => {
    it("shows inline error and does not call API when password is empty", async () => {
      renderComponent();

      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe("successful login", () => {
    it("calls POST /login/ with lowercased email and password", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { token: "tok", expiry: "2026-01-01" } });
      renderComponent({ email: "User@Example.COM" });

      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "secret123" },
      });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "post",
            url: "/login/",
            payload: { username: "user@example.com", password: "secret123" },
          })
        );
      });
    });

    it("calls signIn with token and expiry on success", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { token: "tok123", expiry: "2026-12-31" } });
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "mypassword" },
      });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith("tok123", "2026-12-31");
      });
    });

    it("calls onSuccess after signIn on success", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { token: "tok", expiry: "exp" } });
      const onSuccess = jest.fn();
      renderComponent({ onSuccess });

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it("does not show an error message on success", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { token: "tok", expiry: "exp" } });
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "pass" },
      });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not call onSuccess on failure", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 400, data: { message: "Bad credentials." } },
      });
      const onSuccess = jest.fn();
      renderComponent({ onSuccess });

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("shows backend message on wrong password", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 400, data: { message: "Incorrect credentials." } },
      });
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Incorrect credentials.");
      });
    });

    it("clears the password field after a failed login", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 400, data: { message: "Bad credentials." } },
      });
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(screen.getByLabelText(/password/i)).toHaveValue("");
    });

    it("shows not_verified error message for unverified accounts", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { type: "not_verified", message: "Not verified." },
        },
      });
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        // The not_verified_error_message text key renders the localised message
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("shows rate-limit error on 429", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { status: 429, data: {} },
      });
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/too many attempts/i);
      });
    });

    it("shows generic error on network failure", async () => {
      mockApiRequest.mockRejectedValueOnce(new Error("Network Error"));
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
      });
    });
  });

  describe("loading state", () => {
    it("disables input and button while loading", async () => {
      mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
      renderComponent();

      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass" } });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
    });
  });

  describe("navigation callbacks", () => {
    it("calls onSwitchToOtp when Use a code instead is clicked", () => {
      const onSwitchToOtp = jest.fn();
      renderComponent({ onSwitchToOtp });

      fireEvent.click(screen.getByRole("button", { name: /use a code instead/i }));

      expect(onSwitchToOtp).toHaveBeenCalledTimes(1);
    });

    it("does not call apiRequest when Use a code instead is clicked", () => {
      renderComponent();

      fireEvent.click(screen.getByRole("button", { name: /use a code instead/i }));

      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("calls onBack when Back is clicked", () => {
      const onBack = jest.fn();
      renderComponent({ onBack });

      fireEvent.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("forgot password callback", () => {
    it("calls onForgotPassword when Forgot your password is clicked", () => {
      const onForgotPassword = jest.fn();
      renderComponent({ onForgotPassword });

      fireEvent.click(screen.getByRole("button", { name: /forgot your password/i }));

      expect(onForgotPassword).toHaveBeenCalledTimes(1);
    });

    it("does not call the API when Forgot your password is clicked", () => {
      renderComponent();

      fireEvent.click(screen.getByRole("button", { name: /forgot your password/i }));

      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });
});

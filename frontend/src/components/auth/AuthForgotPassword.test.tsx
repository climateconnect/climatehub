import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import AuthForgotPassword from "./AuthForgotPassword";

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

function makeContextValue(locale: "en" | "de" = "en") {
  return {
    locale,
    user: null,
    locales: [] as any,
    pathName: "/",
    donationGoals: [],
    hubUrl: "",
    signIn: jest.fn(),
  };
}

const defaultProps = {
  email: "user@example.com",
  onBack: jest.fn(),
};

function renderComponent(props: Partial<typeof defaultProps> & { locale?: "en" | "de" } = {}) {
  const { locale = "en", ...rest } = props;
  const mergedProps = { ...defaultProps, ...rest };

  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(locale) as any}>
        <AuthForgotPassword {...mergedProps} />
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

describe("AuthForgotPassword", () => {
  describe("on mount — API call", () => {
    it("immediately calls POST /api/send_reset_password_email/ with the email", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { message: "Email sent." } });
      renderComponent();

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: "post",
            url: "/api/send_reset_password_email/",
            payload: { email: "user@example.com" },
          })
        );
      });
    });

    it("does not require the user to submit any form", () => {
      mockApiRequest.mockResolvedValueOnce({ data: {} });
      renderComponent();

      expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows a loading spinner while the API call is in progress", () => {
      mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
      renderComponent();

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("shows loading indicator while API call is in progress", () => {
      mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
      renderComponent();

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  describe("success state", () => {
    it("shows a check-inbox confirmation after the API succeeds", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: { message: "Email sent." } });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
      });
    });

    it("no longer shows the loading spinner after success", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: {} });
      renderComponent();

      await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    });

    it("enables the Back button after success", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: {} });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
      });
    });
  });

  describe("error state", () => {
    it("shows the backend error message when the API fails", async () => {
      mockApiRequest.mockRejectedValueOnce({
        response: { data: { message: "User not found." } },
      });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("User not found.");
      });
    });

    it("shows a generic error when the API fails with no message", async () => {
      mockApiRequest.mockRejectedValueOnce(new Error("Network Error"));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
      });
    });

    it("enables navigation buttons after an error", async () => {
      mockApiRequest.mockRejectedValueOnce({ response: { data: { message: "Error." } } });
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
      });
    });
  });

  describe("i18n", () => {
    it("renders German heading when locale is 'de'", () => {
      mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
      renderComponent({ locale: "de" });

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Passwort zurücksetzen");
    });

    it("interpolates the email into the German loading message", () => {
      mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
      renderComponent({ locale: "de", email: "test@example.com" });

      expect(
        screen.getByText(/Sende einen Link zum Zurücksetzen an test@example\.com/)
      ).toBeInTheDocument();
    });

    it("interpolates the email into the German success message", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: {} });
      renderComponent({ locale: "de", email: "test@example.com" });

      await waitFor(() => {
        expect(screen.getByText(/Wir haben einen Link.*test@example\.com/)).toBeInTheDocument();
      });
    });
  });

  describe("navigation callbacks", () => {
    it("calls onBack when Back is clicked", async () => {
      mockApiRequest.mockResolvedValueOnce({ data: {} });
      const onBack = jest.fn();
      renderComponent({ onBack });

      await waitFor(() => expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled());
      fireEvent.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });
});

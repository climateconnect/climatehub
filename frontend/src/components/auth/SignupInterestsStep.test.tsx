import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import SignupInterestsStep from "./SignupInterestsStep";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSectorOptions = jest.fn();
jest.mock("../../../public/lib/getOptions", () => ({
  getSectorOptions: (...args: any[]) => mockGetSectorOptions(...args),
}));

// Mock ActiveSectorsSelector component
jest.mock("../hub/ActiveSectorsSelector", () => {
  return function MockActiveSectorsSelector({
    selectedSectors,
    sectorsToSelectFrom,
    onSelectNewSector,
    onClickRemoveSector,
    title,
  }: any) {
    return (
      <div data-testid="active-sectors-selector">
        <div>{title}</div>
        <div data-testid="available-sectors">{sectorsToSelectFrom.length} sectors available</div>
        <div data-testid="selected-sectors">{selectedSectors.length} sectors selected</div>
        <select
          data-testid="sector-select"
          onChange={(e) => {
            const mockEvent = {
              target: { value: e.target.value },
              preventDefault: jest.fn(),
            };
            onSelectNewSector(mockEvent);
          }}
        >
          <option value="">Select a sector</option>
          {sectorsToSelectFrom.map((sector: any) => (
            <option key={sector.key} value={sector.name}>
              {sector.name}
            </option>
          ))}
        </select>
        {selectedSectors.map((sector: any) => (
          <div key={sector.key} data-testid={`selected-sector-${sector.key}`}>
            {sector.name}
            <button onClick={() => onClickRemoveSector(sector)}>Remove</button>
          </div>
        ))}
      </div>
    );
  };
});

// Mock LoadingSpinner
jest.mock("../general/LoadingSpinner", () => {
  return function MockLoadingSpinner() {
    return <div data-testid="loading-spinner">Loading...</div>;
  };
});

// Mock getTexts
jest.mock("../../../public/texts/texts", () => {
  return jest.fn(() => ({
    your_area_of_interest: "Your area of interest",
    signup_step_3_headline:
      "Let the climate community know what you are already doing or which fields interest you the most.",
    name: "Name",
    select_your_interest_areas: "Select your interest areas (optional)",
    back: "Back",
    create_account: "Create account",
    creating_account: "Creating account...",
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

const mockSectors = [
  { key: "1", name: "Renewable Energy" },
  { key: "2", name: "Transportation" },
  { key: "3", name: "Agriculture" },
];

function renderSignupInterestsStep({
  email = "test@example.com",
  onSubmit = jest.fn(),
  onBack = jest.fn(),
  hubUrl = undefined,
  isLoading = false,
  errorMessage = undefined,
  locale = "en" as "en" | "de",
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={makeContextValue(locale) as any}>
        <SignupInterestsStep
          email={email}
          onSubmit={onSubmit}
          onBack={onBack}
          hubUrl={hubUrl}
          isLoading={isLoading}
          errorMessage={errorMessage}
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
  mockGetSectorOptions.mockResolvedValue(mockSectors);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("SignupInterestsStep", () => {
  describe("rendering", () => {
    it("renders heading and description", async () => {
      renderSignupInterestsStep();

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "Your area of interest"
        );
        expect(
          screen.getByText(/let the climate community know what you are already doing/i)
        ).toBeInTheDocument();
      });
    });

    it("renders Create account buttons", async () => {
      renderSignupInterestsStep();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
      });
    });
  });

  describe("sector loading", () => {
    it("shows LoadingSpinner while fetching sectors", () => {
      // Mock delay in sector loading
      mockGetSectorOptions.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSectors), 100))
      );

      renderSignupInterestsStep();

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("active-sectors-selector")).not.toBeInTheDocument();
    });

    it("displays ActiveSectorsSelector once sectors are loaded", async () => {
      renderSignupInterestsStep();

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
        expect(screen.getByTestId("active-sectors-selector")).toBeInTheDocument();
      });
    });

    it("fetches sectors with correct locale and hubUrl", async () => {
      renderSignupInterestsStep({ locale: "de", hubUrl: "berlin" });

      await waitFor(() => {
        expect(mockGetSectorOptions).toHaveBeenCalledWith("de", "berlin");
      });
    });

    it("handles sector loading error gracefully", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetSectorOptions.mockRejectedValue(new Error("Network error"));

      renderSignupInterestsStep();

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
        expect(screen.getByTestId("active-sectors-selector")).toBeInTheDocument();
        // Should display with empty sector list
        expect(screen.getByText("0 sectors available")).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("sector selection", () => {
    it("allows selecting a sector", async () => {
      renderSignupInterestsStep();

      await waitFor(() => {
        expect(screen.getByTestId("sector-select")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("sector-select"), {
        target: { value: "Renewable Energy" },
      });

      await waitFor(() => {
        expect(screen.getByText("1 sectors selected")).toBeInTheDocument();
      });
    });

    it("allows removing a selected sector", async () => {
      renderSignupInterestsStep();

      await waitFor(() => {
        expect(screen.getByTestId("sector-select")).toBeInTheDocument();
      });

      // Select a sector
      fireEvent.change(screen.getByTestId("sector-select"), {
        target: { value: "Renewable Energy" },
      });

      await waitFor(() => {
        expect(screen.getByText("1 sectors selected")).toBeInTheDocument();
      });

      // Remove it
      const removeButton = screen.getByText("Remove");
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText("0 sectors selected")).toBeInTheDocument();
      });
    });

    it("prevents selecting duplicate sectors", async () => {
      renderSignupInterestsStep();

      await waitFor(() => {
        expect(screen.getByTestId("sector-select")).toBeInTheDocument();
      });

      // Select the same sector twice
      fireEvent.change(screen.getByTestId("sector-select"), {
        target: { value: "Renewable Energy" },
      });
      fireEvent.change(screen.getByTestId("sector-select"), {
        target: { value: "Renewable Energy" },
      });

      await waitFor(() => {
        // Should still show only 1 selected
        expect(screen.getByText("1 sectors selected")).toBeInTheDocument();
      });
    });
  });

  describe("form submission", () => {
    it("calls onSubmit with empty array when no sectors selected", async () => {
      const onSubmit = jest.fn();
      renderSignupInterestsStep({ onSubmit });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        interest_sectors: [],
      });
    });

    it("calls onSubmit with selected sector IDs", async () => {
      const onSubmit = jest.fn();
      renderSignupInterestsStep({ onSubmit });

      await waitFor(() => {
        expect(screen.getByTestId("sector-select")).toBeInTheDocument();
      });

      // Select two sectors
      fireEvent.change(screen.getByTestId("sector-select"), {
        target: { value: "Renewable Energy" },
      });
      fireEvent.change(screen.getByTestId("sector-select"), {
        target: { value: "Transportation" },
      });

      await waitFor(() => {
        expect(screen.getByText("2 sectors selected")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /create account/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        interest_sectors: ["1", "2"], // sector keys
      });
    });

    it("disables create account button when isLoading is true", async () => {
      renderSignupInterestsStep({ isLoading: true });

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /creating account/i });
        expect(button).toBeDisabled();
      });
    });

    it("changes button text to 'Creating account...' when loading", async () => {
      renderSignupInterestsStep({ isLoading: true });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /creating account/i })).toBeInTheDocument();
      });
    });
  });

  describe("navigation", () => {
    it("calls onBack when Back button is clicked", async () => {
      const onBack = jest.fn();
      renderSignupInterestsStep({ onBack });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /back/i }));

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("displays error message when provided", async () => {
      renderSignupInterestsStep({
        errorMessage: "Email already exists",
      });

      await waitFor(() => {
        expect(screen.getByText("Email already exists")).toBeInTheDocument();
      });
    });

    it("does not display error message when not provided", async () => {
      renderSignupInterestsStep();

      await waitFor(() => {
        const errorText = screen.queryByRole("alert");
        expect(errorText).not.toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("disables buttons during loading with proper state", async () => {
      renderSignupInterestsStep({ isLoading: true });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
      });
    });
  });
});

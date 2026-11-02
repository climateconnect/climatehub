import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CookieBanner from "./CookieBanner";
import UserContext from "../context/UserContext";
import Cookies from "universal-cookie";
import getTexts from "../../../public/texts/texts";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";

// Mock the Cookies class
jest.mock("universal-cookie", () => {
  const mCookies = {
    set: jest.fn(),
  };
  return jest.fn(() => mCookies);
});

const mockUpdateCookies = jest.fn();
const mockCloseBanner = jest.fn();

const renderWithContext = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider
        value={{
          updateCookies: mockUpdateCookies,
          locale: "en",
          // Add other necessary context values here
        }}
      >
        {component}
      </UserContext.Provider>
    </ThemeProvider>
  );
};

describe("CookieBanner", () => {
  let cookies;

  beforeEach(() => {
    cookies = new Cookies();
    jest.clearAllMocks();
  });

  it("renders the banner with headline and buttons", () => {
    renderWithContext(<CookieBanner closeBanner={mockCloseBanner} />);

    const texts = getTexts({ page: "cookie", locale: "en" });
    expect(screen.getByText(texts.cookie_banner_headline)).toBeInTheDocument();
    expect(screen.getByText(texts.confirm_selection)).toBeInTheDocument();
    expect(screen.getByText(texts.enable_all_cookies)).toBeInTheDocument();
  });

  it('calls closeBanner and sets cookies when "Enable all cookies" is clicked', () => {
    renderWithContext(<CookieBanner closeBanner={mockCloseBanner} />);

    const texts = getTexts({ page: "cookie", locale: "en" });
    fireEvent.click(screen.getByText(texts.enable_all_cookies));

    expect(cookies.set).toHaveBeenCalledWith("acceptedNecessary", true, expect.any(Object));
    expect(cookies.set).toHaveBeenCalledWith("acceptedStatistics", true, expect.any(Object));
    expect(mockUpdateCookies).toHaveBeenCalled();
    expect(mockCloseBanner).toHaveBeenCalled();
  });

  it('calls closeBanner and sets cookies when "Confirm selection" is clicked', () => {
    renderWithContext(<CookieBanner closeBanner={mockCloseBanner} />);

    const texts = getTexts({ page: "cookie", locale: "en" });
    // First, check the statistics checkbox
    fireEvent.click(screen.getByLabelText(texts.cookies_statistics));

    // Then, confirm selection
    fireEvent.click(screen.getByText(texts.confirm_selection));

    expect(cookies.set).toHaveBeenCalledWith("acceptedNecessary", true, expect.any(Object));
    expect(cookies.set).toHaveBeenCalledWith("acceptedStatistics", true, expect.any(Object));
    expect(mockUpdateCookies).toHaveBeenCalled();
    expect(mockCloseBanner).toHaveBeenCalled();
  });
});

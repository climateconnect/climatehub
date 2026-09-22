import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import ProjectDescriptionEditor from "./ProjectDescriptionEditor";

const defaultContext = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
};

function renderEditor({
  descriptionHtml = "",
  onChange = jest.fn(),
  disabled = false,
  error = undefined as string | undefined,
} = {}) {
  return render(
    <ThemeProvider theme={theme}>
      {/*
       * `@mui/styles` (used by `makeStyles` in components under test) bundles its own
       * `@mui/private-theming` instance, separate from `@mui/material` v7's, so it can't see
       * the theme via the `ThemeProvider` above. Nest `@mui/styles`' own `ThemeProvider` with
       * the same theme so `makeStyles` consumers get a real theme instead of the empty default.
       */}
      <StylesThemeProvider theme={theme}>
        <UserContext.Provider value={defaultContext as any}>
          <ProjectDescriptionEditor
            descriptionHtml={descriptionHtml}
            onChange={onChange}
            disabled={disabled}
            error={error}
          />
        </UserContext.Provider>
      </StylesThemeProvider>
    </ThemeProvider>
  );
}

describe("ProjectDescriptionEditor", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      const { container } = renderEditor();
      expect(container).toBeTruthy();
    });

    it("renders with HTML content", () => {
      const { container } = renderEditor({
        descriptionHtml: "<p>Hello world</p>",
      });
      expect(container).toBeTruthy();
    });

    it("renders error text when error prop is provided", () => {
      renderEditor({ error: "Description is required" });
      expect(screen.getByText("Description is required")).toBeInTheDocument();
    });

    it("renders the YouTube button in the toolbar", () => {
      renderEditor();
      expect(screen.getByLabelText(/Insert YouTube video/i)).toBeInTheDocument();
    });

    it("renders character counter with limit", () => {
      renderEditor();
      expect(screen.getByText(/4000/)).toBeInTheDocument();
    });
  });

  describe("toolbar", () => {
    it("renders formatting buttons", () => {
      renderEditor();
      expect(screen.getByLabelText(/Insert YouTube video/i)).toBeInTheDocument();
    });

    it("does not render toolbar when disabled", () => {
      renderEditor({ disabled: true });
      expect(screen.queryByLabelText(/Insert YouTube video/i)).not.toBeInTheDocument();
    });
  });
});

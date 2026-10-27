import { render, screen } from "@testing-library/react";
import { createTheme } from "@mui/material/styles";
// TODO: MiniProfilePreview still uses makeStyles, which needs this provider; drop it once migrated (#2290)
import { ThemeProvider } from "@mui/styles";
import React from "react";
import { renderMentionSuggestion } from "./InputWithMentions";

const suggestion = {
  first_name: "Ada",
  last_name: "Lovelace",
  thumbnail_image: "/images/ada.png",
  location: "Berlin",
};

const renderSuggestion = (s) =>
  render(<ThemeProvider theme={createTheme()}>{renderMentionSuggestion(s)}</ThemeProvider>);

describe("renderMentionSuggestion", () => {
  it("shows avatar, name and location without a link", () => {
    renderSuggestion(suggestion);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Berlin")).toBeTruthy();
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("omits location when missing", () => {
    renderSuggestion({ ...suggestion, location: null });
    expect(screen.queryByText("Berlin")).toBeNull();
  });
});

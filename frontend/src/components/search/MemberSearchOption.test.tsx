import { render, screen } from "@testing-library/react";
import { createTheme } from "@mui/material/styles";
// TODO: MiniProfilePreview still uses makeStyles, which needs this provider; drop it once migrated (#2290)
import { ThemeProvider } from "@mui/styles";
import React from "react";
import MemberSearchOption from "./MemberSearchOption";

const member = {
  id: 1,
  first_name: "Ada",
  last_name: "Lovelace",
  url_slug: "ada",
  thumbnail_image: "/images/ada.png",
  location: "Berlin",
  badges: [],
};

const renderOption = (option) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <MemberSearchOption option={option} />
    </ThemeProvider>
  );

describe("MemberSearchOption", () => {
  it("renders name, image and location without a link", () => {
    renderOption(member);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Berlin")).toBeTruthy();
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("omits location and image when missing", () => {
    renderOption({ ...member, location: null, thumbnail_image: null });
    expect(screen.queryByText("Berlin")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

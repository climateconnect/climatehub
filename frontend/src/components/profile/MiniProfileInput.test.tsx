import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
// TODO: MiniProfileInput still uses makeStyles, which needs this provider; drop it once migrated (#2290)
import { ThemeProvider } from "@mui/styles";
import React from "react";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import MiniProfileInput from "./MiniProfileInput";

const rolesOptions = [
  { id: 1, role_type: "all", name: "Super-Admin" },
  { id: 2, role_type: "read write", name: "Administrator" },
  { id: 3, role_type: "read only", name: "Member" },
];

// Shape of a member that was just added from the member search: no `name`, no `image`
const memberFromSearch = {
  id: 7,
  first_name: "Ada",
  last_name: "Lovelace",
  url_slug: "ada",
  thumbnail_image: "https://storage.example.org/ada.jpeg",
  location: "Berlin",
  badges: [],
  role: rolesOptions[2],
  role_in_project: "",
  edited: true,
};

const renderInput = (profile) =>
  render(
    <UserContext.Provider value={{ locale: "en" }}>
      <MuiThemeProvider theme={theme}>
        <ThemeProvider theme={theme}>
          <MiniProfileInput
            profile={profile}
            rolesOptions={rolesOptions}
            fullRolesOptions={rolesOptions}
            creatorRole={rolesOptions[0]}
            availabilityOptions={[]}
            onChange={() => {}}
            allowAppointingCreator
          />
        </ThemeProvider>
      </MuiThemeProvider>
    </UserContext.Provider>
  );

describe("MiniProfileInput", () => {
  it("shows name and avatar for a member added from search", () => {
    renderInput(memberFromSearch);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toBe(memberFromSearch.thumbnail_image);
  });

  it("names a member added from search in the transfer Super Admin dialog", () => {
    renderInput(memberFromSearch);
    fireEvent.click(screen.getByRole("button", { name: /super admin/i }));
    expect(screen.getByText(/If you make Ada Lovelace the Super Admin/)).toBeTruthy();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });
});

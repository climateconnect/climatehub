import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";

import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import OpenJoinRequestsList from "./OpenJoinRequestsList";

const requests = [
  {
    id: 3,
    user_profile: { url_slug: "a", first_name: "Alice", last_name: "A" },
    message: "let me in",
    requested_at: "2026-11-01T10:00:00Z",
  },
];

const renderList = (reqs, onSelect = jest.fn()) => {
  render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={{ locale: "en" } as any}>
        <OpenJoinRequestsList requests={reqs} onSelect={onSelect} />
      </UserContext.Provider>
    </ThemeProvider>
  );
  return onSelect;
};

describe("OpenJoinRequestsList", () => {
  it("renders requests and selects on click", () => {
    const onSelect = renderList(requests);
    expect(screen.getByText("Alice A")).toBeInTheDocument();
    expect(screen.getByText(/let me in/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Alice A"));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("renders nothing when empty", () => {
    renderList([]);
    expect(screen.queryByText(/Open join requests/)).not.toBeInTheDocument();
  });
});

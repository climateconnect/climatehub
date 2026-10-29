import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import ProjectRegistrationsContent from "./ProjectRegistrationsContent";
import { EventRegistrationData, Project } from "../../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("universal-cookie", () => {
  return jest.fn(() => ({ get: jest.fn(() => "test-token") }));
});

const mockApiRequest = jest.fn();
jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

// Modals are not under test here.
jest.mock("./EditEventRegistrationModal", () => () => null);
jest.mock("./SendEmailToGuestsModal", () => () => null);
jest.mock("./CancelGuestRegistrationModal", () => () => null);
jest.mock("./ViewRegistrationAnswersModal", () => () => null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(id: number, firstName: string, numberOfSeats: number, cancelled = false) {
  return {
    id,
    user_first_name: firstName,
    user_last_name: "Guest",
    user_url_slug: `guest-${id}`,
    user_thumbnail_image: null,
    registered_at: "2026-10-01T10:00:00.000Z",
    cancelled_at: cancelled ? "2026-10-02T10:00:00.000Z" : null,
    cancellation_reason: null,
    number_of_seats: numberOfSeats,
    field_answers: [],
  };
}

function makeRegistration(overrides: Partial<EventRegistrationData> = {}): EventRegistrationData {
  return {
    max_participants: 20,
    max_seats_per_registration: 3,
    available_seats: 16,
    registration_end_date: "2099-03-31T23:59:00.000Z",
    status: "open",
    notify_admins: true,
    is_draft: false,
    registration_enabled: true,
    fields: [],
    last_guest_email_sent_at: null,
    ...overrides,
  };
}

function renderContent(eventRegistration: EventRegistrationData) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={{ locale: "en" } as any}>
        <ProjectRegistrationsContent
          project={{ url_slug: "test-event", end_date: "2099-06-30T23:59:00.000Z" } as Project}
          eventRegistration={eventRegistration}
          onEventRegistrationUpdated={jest.fn()}
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiRequest.mockResolvedValue({
    data: [makeRow(1, "Ada", 3), makeRow(2, "Bob", 1), makeRow(3, "Cy", 2, true)],
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectRegistrationsContent – seats", () => {
  it("shows a seats column and the per-registration maximum", async () => {
    renderContent(makeRegistration());
    await waitFor(() => expect(screen.getByText("Ada")).toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: "Seats" })).toBeInTheDocument();
    expect(screen.getByText("Max. seats per registration")).toBeInTheDocument();
  });

  it("totals seats of active registrations only in the footer", async () => {
    renderContent(makeRegistration());
    await waitFor(() => expect(screen.getByText("4 seats booked")).toBeInTheDocument());
  });

  it("hides the seats column and total for single-seat events", async () => {
    mockApiRequest.mockResolvedValue({ data: [makeRow(1, "Ada", 1)] });
    renderContent(makeRegistration({ max_seats_per_registration: 1 }));
    await waitFor(() => expect(screen.getByText("Ada")).toBeInTheDocument());
    expect(screen.queryByRole("columnheader", { name: "Seats" })).not.toBeInTheDocument();
    expect(screen.queryByText(/seats? booked/)).not.toBeInTheDocument();
  });
});

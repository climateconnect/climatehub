import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import ROLE_TYPES from "../../../public/data/role_types";
import { parseOrganization } from "../../../public/lib/organizationOperations";
import OrganizationPage from "../../../pages/organizations/[organizationUrl]";

jest.mock("universal-cookie", () => jest.fn(() => ({ get: jest.fn(() => "test-token") })));

jest.mock("next/router", () => ({
  useRouter: () => ({
    locale: "en",
    query: {},
    asPath: "/organizations/test-org",
  }),
}));

// Heavy children are stubbed; the contact button and the drawer wiring are under test
jest.mock("../layouts/WideLayout", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("../indexPage/hubsSubHeader/HubsSubHeader", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../account/AccountPage", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("../profile/ProfilePreviews", () => ({ __esModule: true, default: () => null }));
jest.mock("../project/ProjectPreviews", () => ({ __esModule: true, default: () => null }));

const mockChatDrawer = jest.fn();
jest.mock("../communication/chat/ChatDrawer", () => ({
  __esModule: true,
  default: (props: any) => {
    mockChatDrawer(props);
    return props.open ? <div data-testid="chat-drawer" /> : null;
  },
}));

const creator = {
  id: 1,
  url_slug: "jane-doe",
  first_name: "Jane",
  last_name: "Doe",
  isCreator: true,
  permission: ROLE_TYPES.all_type,
};
const me = { id: 2, url_slug: "me", first_name: "My", last_name: "Self" };
// Built through parseOrganization from a server-shaped response, like the real page
const organization = parseOrganization({
  id: 3,
  name: "Test Org",
  url_slug: "test-org",
  types: [],
  sectors: [],
  short_description: "desc",
});

function renderPage({ user = me as any, members = [creator] as any[] } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider
        value={{ locale: "en", user, CUSTOM_HUB_URLS: [], isLoading: false } as any}
      >
        <OrganizationPage
          organization={organization}
          projects={[]}
          projectsHasMore={false}
          members={members}
          rolesOptions={[{ role_type: "read write", name: "Administrator" }]}
          following={false}
          hubThemeData={undefined}
          hubs={[]}
          hubUrl=""
        />
      </UserContext.Provider>
    </ThemeProvider>
  );
}

describe("OrganizationPage contact drawer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens the chat drawer instead of navigating when clicking Send message", () => {
    renderPage();
    expect(screen.queryByTestId("chat-drawer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(screen.getByTestId("chat-drawer")).toBeInTheDocument();
    const props = mockChatDrawer.mock.calls.at(-1)![0];
    expect(props.contactPerson).toEqual(creator);
    expect(props.origin).toEqual({ type: "organization", urlSlug: "test-org", id: 3 });
  });
});

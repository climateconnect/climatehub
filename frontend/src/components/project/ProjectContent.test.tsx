import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import { HubContext } from "../context/HubContext";
import ProjectContent from "./ProjectContent";

// `AppLink` (used via `MiniOrganizationPreview`) reads the active hub from
// `HubContext` and the locale from the Next router, so tests that render
// `ProjectContent` must provide both contexts.
jest.mock("next/router", () => ({
  useRouter: () => ({ locale: "en" }),
}));

// ResizeObserver is not available in JSDOM
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

const defaultContext = {
  locale: "en" as any,
  user: null,
  locales: [],
  pathName: "/",
  donationGoals: [],
  CUSTOM_HUB_URLS: [],
};

const mockCreator = {
  id: 1,
  name: "Test Org",
  url_slug: "test-org",
  thumbnail_image: null,
  image: null,
  biography: "",
};

const baseProject = {
  isPersonalProject: false,
  description_html: null as string | null,
  description: null as string | null,
  project_type: { type_id: "project", name: "Project" },
  collaborating_organizations: [],
  parent_project_id: null,
  creation_date: "2024-01-01T00:00:00Z",
  start_date: "2024-01-01T00:00:00Z",
  end_date: null,
  timeline_posts: [],
  devlink_component: null,
  url_slug: "test-project",
  is_online: false,
  creator: mockCreator,
};

function renderProjectContent(projectOverrides = {}) {
  const project = { ...baseProject, ...projectOverrides };
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider value={defaultContext as any}>
        <HubContext.Provider value={{ hubUrl: "", hubData: null, hubTheme: null, hubs: [] }}>
          <ProjectContent
            discussionTabLabel=""
            handleTabChange={jest.fn()}
            latestParentComment={[]}
            leaveProject={jest.fn()}
            project={project}
            projectTabsRef={{ current: null }}
            typesByTabValue={{}}
            showRequesters={false}
            toggleShowRequests={jest.fn()}
            handleSendProjectJoinRequest={jest.fn()}
            requestedToJoinProject={false}
            hubUrl={undefined}
            eventRegistration={null}
            onEventRegistrationUpdated={jest.fn()}
            onMembersRefreshed={jest.fn()}
          />
        </HubContext.Provider>
      </UserContext.Provider>
    </ThemeProvider>
  );
}

describe("ProjectContent", () => {
  describe("description rendering", () => {
    it('shows "no description" placeholder when description_html is null', () => {
      renderProjectContent({ description_html: null });
      expect(screen.getByText(/hasn't added a description yet/)).toBeInTheDocument();
    });

    it('shows "no description" placeholder when description_html is empty', () => {
      renderProjectContent({ description_html: "" });
      expect(screen.getByText(/hasn't added a description yet/)).toBeInTheDocument();
    });

    it("renders description_html content directly", () => {
      renderProjectContent({
        description_html: "<p>Hello <strong>world</strong></p>",
      });
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("keeps empty <p> tags from the editor (blank lines) in the DOM", () => {
      // The tiptap editor stores a blank line the author created as an empty
      // <p></p>. It must not be stripped, so the display CSS can render it as a
      // visible empty line (WYSIWYG with the editor).
      renderProjectContent({
        description_html: "<p>And a new paragraph</p><p></p><p>Empty line above</p>",
      });
      expect(document.querySelector("p:empty")).not.toBeNull();
    });

    it("renders YouTube iframe from description_html", () => {
      const html =
        '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="480"></iframe></div>';
      renderProjectContent({ description_html: html });
      const iframe = document.querySelector("iframe");
      expect(iframe).toBeInTheDocument();
      expect(iframe?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    });
  });

  describe("full description", () => {
    it("renders a long description in full without a show more / show less toggle", () => {
      renderProjectContent({
        description_html: "<p>" + "a".repeat(1000) + "</p>",
      });
      expect(screen.getByText("a".repeat(1000))).toBeInTheDocument();
      expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/show less/i)).not.toBeInTheDocument();
      expect(document.querySelector("[class*='descriptionClamped']")).not.toBeInTheDocument();
    });

    it("does not show a toggle for short descriptions", () => {
      renderProjectContent({ description_html: "<p>Short</p>" });
      expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/show less/i)).not.toBeInTheDocument();
    });
  });
});

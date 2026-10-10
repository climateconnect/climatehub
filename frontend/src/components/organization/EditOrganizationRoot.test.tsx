import React from "react";
import { render, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import { ThemeProvider as StylesThemeProvider } from "@mui/styles";
import theme from "../../themes/theme";
import EditOrganizationRoot from "./EditOrganizationRoot";
import UserContext from "../context/UserContext";
import FeedbackContext from "../context/FeedbackContext";
import { apiRequest } from "../../../public/lib/apiOperations";

const pushMock = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: (...args: any[]) => pushMock(...args),
  }),
}));

jest.mock("../../../public/lib/apiOperations", () => ({
  ...jest.requireActual("../../../public/lib/apiOperations"),
  apiRequest: jest.fn(),
}));

jest.mock("../../../public/lib/imageOperations", () => ({
  ...jest.requireActual("../../../public/lib/imageOperations"),
  blobFromObjectUrl: jest.fn((url) => Promise.resolve(url)),
}));

jest.mock("../account/EditAccountPage", () => {
  const { useRef } = jest.requireActual("react");
  return function MockEditAccountPage(props: any) {
    // Like the real EditAccountPage, hand the same form-state object to every
    // callback so mutations by the parent would persist between clicks.
    const editedAccount = useRef({ ...props.account }).current;
    if (props.checkTranslationsRef) {
      props.checkTranslationsRef.current = { scrollIntoView: jest.fn() };
    }
    return (
      <div data-testid="edit-account-page">
        <button data-testid="submit-button" onClick={() => props.handleSubmit(editedAccount)}>
          {props.submitMessage}
        </button>
        {props.onSecondarySubmit && (
          <button
            data-testid="secondary-button"
            onClick={() => props.onSecondarySubmit(editedAccount)}
          >
            {props.secondarySubmitMessage}
          </button>
        )}
        <button
          data-testid="check-translations-button"
          onClick={() => props.onClickCheckTranslations(editedAccount)}
        />
      </div>
    );
  };
});

jest.mock("../general/TranslateTexts", () => {
  return function MockTranslateTexts(props: any) {
    return (
      <div data-testid="translate-texts">
        <button data-testid="translations-submit-button" onClick={props.onSubmit}>
          {props.submitButtonText}
        </button>
        {props.saveAsDraft && (
          <button data-testid="translations-save-draft-button" onClick={props.saveAsDraft} />
        )}
      </div>
    );
  };
});

jest.mock("../general/PageNotFound", () => {
  return function MockPageNotFound() {
    return <div data-testid="page-not-found" />;
  };
});

const baseOrganization = {
  name: "Test Org",
  url_slug: "test-org",
  language: "de",
  types: [{ hide_get_involved: false }],
  info: {
    location: {},
    short_description: "Short description",
    about: "About",
    get_involved: "How to get involved",
  },
};

function makeUserContext(locale: "en" | "de", user: any = null) {
  return {
    user,
    locale,
    locales: ["en", "de"],
    pathName: "/",
    donationGoals: [],
    hubUrl: "",
  };
}

function renderComponent({
  locale = "en" as "en" | "de",
  organization = baseOrganization,
  showFeedbackMessage = jest.fn(),
  user = null as any,
  user_role = undefined as any,
} = {}) {
  return {
    showFeedbackMessage,
    ...render(
      <ThemeProvider theme={theme}>
        <StylesThemeProvider theme={theme}>
          <UserContext.Provider value={makeUserContext(locale, user) as any}>
            <FeedbackContext.Provider value={{ showFeedbackMessage }}>
              <EditOrganizationRoot
                allSectors={[]}
                errorMessage=""
                existingName=""
                existingUrlSlug=""
                handleSetErrorMessage={jest.fn()}
                handleSetExistingName={jest.fn()}
                handleSetExistingUrlSlug={jest.fn()}
                handleSetLocationOptionsOpen={jest.fn()}
                infoMetadata={{}}
                initialTranslations={{}}
                locationInputRef={{ current: null }}
                organization={organization as any}
                tagOptions={[]}
                hubUrl={undefined}
                user_role={user_role}
              />
            </FeedbackContext.Provider>
          </UserContext.Provider>
        </StylesThemeProvider>
      </ThemeProvider>
    ),
  };
}

// Minimal raw API-shaped organization, as returned by GET /api/organizations/{slug}/,
// matching what parseOrganization() (used internally by getOrganizationByUrlIfExists)
// expects to receive.
function rawOrganizationFixture(overrides: any = {}) {
  return {
    url_slug: "test-org",
    background_image: null,
    name: "Test Org",
    image: null,
    types: [],
    language: "de",
    translations: {},
    sectors: [],
    number_of_followers: 0,
    projects_count: 0,
    is_draft: true,
    parent_organization: null,
    child_organizations: [],
    ...overrides,
  };
}

describe("EditOrganizationRoot language notice", () => {
  it("shows source-language guidance when organization language differs from locale", async () => {
    const { showFeedbackMessage } = renderComponent({ locale: "en" });

    await waitFor(() => {
      expect(showFeedbackMessage).toHaveBeenCalledTimes(1);
    });

    const payload = (showFeedbackMessage as jest.Mock).mock.calls[0][0];
    expect(payload.message).toContain("uses that source language automatically");
    expect(payload.message).toContain("Check Translations");
  });

  it("does not show source-language guidance when organization language matches locale", async () => {
    const showFeedbackMessage = jest.fn();

    renderComponent({
      locale: "en",
      organization: { ...baseOrganization, language: "en" },
      showFeedbackMessage,
    });

    await waitFor(() => {
      expect(showFeedbackMessage).not.toHaveBeenCalled();
    });
  });
});

describe("EditOrganizationRoot draft publishing", () => {
  const draftOrganization = { ...baseOrganization, is_draft: true };
  // Publishing runs the same full validation as any other save (image + at
  // least one type + name); leave image out of draftOrganization above so
  // tests that don't publish aren't forced through the image blob pipeline.
  const publishableDraftOrganization = {
    ...draftOrganization,
    image: "http://example.com/image.png",
  };
  const user = { url_slug: "test-user" };

  beforeEach(() => {
    jest.clearAllMocks();
    (apiRequest as jest.Mock).mockImplementation(({ method }) => {
      if (method === "get") {
        return Promise.resolve({ data: rawOrganizationFixture({ is_draft: true }) });
      }
      return Promise.resolve({});
    });
  });

  it("shows a Publish submit label and a Save draft action for a draft organization", () => {
    const { getByTestId } = renderComponent({ organization: draftOrganization, user });

    expect(getByTestId("submit-button")).toHaveTextContent("Publish");
    expect(getByTestId("secondary-button")).toHaveTextContent("Save draft");
  });

  it("does not show a Save draft action for a published organization", () => {
    const { queryByTestId } = renderComponent({ organization: baseOrganization, user });

    expect(queryByTestId("secondary-button")).not.toBeInTheDocument();
  });

  it("publishing sets is_draft to false and redirects with the published message", async () => {
    const { getByTestId } = renderComponent({
      organization: publishableDraftOrganization,
      user,
    });

    fireEvent.click(getByTestId("submit-button"));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });

    const patchCall = (apiRequest as jest.Mock).mock.calls.find(
      ([opts]) => opts.method === "patch"
    );
    expect(patchCall[0].payload.is_draft).toBe(false);
    expect(pushMock).toHaveBeenCalledWith({
      pathname: "/organizations/test-org",
      query: {
        message: "Your organisation has been published. Great work!",
        hub: undefined,
      },
    });
  });

  it("saving as draft does not change is_draft and redirects to the user's profile", async () => {
    const { getByTestId } = renderComponent({ organization: draftOrganization, user });

    fireEvent.click(getByTestId("secondary-button"));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });

    const patchCall = (apiRequest as jest.Mock).mock.calls.find(
      ([opts]) => opts.method === "patch"
    );
    expect(patchCall[0].payload.is_draft).toBeUndefined();
    expect(pushMock).toHaveBeenCalledWith({
      pathname: "/profiles/test-user",
      query: {
        message: "You have successfully edited your organisation.",
        hub: undefined,
      },
    });
  });

  it("saving as draft after a failed publish does not publish the organization", async () => {
    let patchCount = 0;
    (apiRequest as jest.Mock).mockImplementation(({ method }) => {
      if (method === "get") {
        return Promise.resolve({ data: rawOrganizationFixture({ is_draft: true }) });
      }
      patchCount += 1;
      return patchCount === 1
        ? Promise.reject({ response: { data: { message: "Server error" } } })
        : Promise.resolve({});
    });
    const { getByTestId } = renderComponent({
      organization: publishableDraftOrganization,
      user,
    });

    fireEvent.click(getByTestId("submit-button"));
    await waitFor(() => expect(patchCount).toBe(1));

    fireEvent.click(getByTestId("secondary-button"));
    await waitFor(() => expect(pushMock).toHaveBeenCalled());

    const patchCalls = (apiRequest as jest.Mock).mock.calls.filter(
      ([opts]) => opts.method === "patch"
    );
    expect(patchCalls[1][0].payload.is_draft).toBeUndefined();
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/profiles/test-user" })
    );
  });

  it("labels the translations step submit as Publish for a draft and offers Save as draft", async () => {
    const { getByTestId } = renderComponent({ organization: draftOrganization, user });

    fireEvent.click(getByTestId("check-translations-button"));

    await waitFor(() => {
      expect(getByTestId("translations-submit-button")).toHaveTextContent("Publish");
    });
    expect(getByTestId("translations-save-draft-button")).toBeInTheDocument();
  });

  it("saving as draft from the translations step keeps the organization a draft", async () => {
    const { getByTestId } = renderComponent({ organization: draftOrganization, user });

    fireEvent.click(getByTestId("check-translations-button"));
    await waitFor(() => getByTestId("translations-save-draft-button"));
    fireEvent.click(getByTestId("translations-save-draft-button"));

    await waitFor(() => expect(pushMock).toHaveBeenCalled());

    const patchCall = (apiRequest as jest.Mock).mock.calls.find(
      ([opts]) => opts.method === "patch"
    );
    expect(patchCall[0].payload.is_draft).toBeUndefined();
    expect(patchCall[0].payload.translations).toBeDefined();
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/profiles/test-user" })
    );
  });

  it("does not offer Save as draft on the translations step for a published organization", async () => {
    const { getByTestId, queryByTestId } = renderComponent({
      organization: baseOrganization,
      user,
    });

    fireEvent.click(getByTestId("check-translations-button"));

    await waitFor(() => {
      expect(getByTestId("translations-submit-button")).toHaveTextContent("Save");
    });
    expect(queryByTestId("translations-save-draft-button")).not.toBeInTheDocument();
  });

  it("shows the Delete Draft label instead of Delete organisation for a draft admin", () => {
    const { getByLabelText, queryByLabelText } = renderComponent({
      organization: draftOrganization,
      user,
      user_role: { role_type: "all" },
    });

    expect(getByLabelText("Delete Draft")).toBeInTheDocument();
    expect(queryByLabelText("Delete organisation")).not.toBeInTheDocument();
  });

  it("shows the normal delete label for a published organization admin", () => {
    const { getByLabelText, queryByLabelText } = renderComponent({
      organization: baseOrganization,
      user,
      user_role: { role_type: "all" },
    });

    expect(getByLabelText("Delete organisation")).toBeInTheDocument();
    expect(queryByLabelText("Delete Draft")).not.toBeInTheDocument();
  });
});

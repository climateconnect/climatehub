import React from "react";
import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@mui/material/styles";
import theme from "../../themes/theme";
import EditOrganizationRoot from "./EditOrganizationRoot";
import UserContext from "../context/UserContext";
import FeedbackContext from "../context/FeedbackContext";

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("../account/EditAccountPage", () => {
  return function MockEditAccountPage(props: any) {
    if (props.checkTranslationsRef) {
      props.checkTranslationsRef.current = { scrollIntoView: jest.fn() };
    }
    return <div data-testid="edit-account-page" />;
  };
});

jest.mock("../general/TranslateTexts", () => {
  return function MockTranslateTexts() {
    return <div data-testid="translate-texts" />;
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

function makeUserContext(locale: "en" | "de") {
  return {
    user: null,
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
} = {}) {
  return {
    showFeedbackMessage,
    ...render(
      <ThemeProvider theme={theme}>
        <UserContext.Provider value={makeUserContext(locale) as any}>
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
            />
          </FeedbackContext.Provider>
        </UserContext.Provider>
      </ThemeProvider>
    ),
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

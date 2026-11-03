/**
 * Unit tests for event registration helper functions
 * Tests the core display logic for the registration button state machine
 */

import {
  shouldShowRegisterButton,
  getRegisterButtonText,
  isRegisterButtonDisabled,
  getRegistrationUIState,
  formatSeatCount,
  getSelectableSeatMax,
  sumActiveSeats,
} from "./eventRegistrationHelpers";
import getTexts from "../../public/texts/texts";
import { Project } from "../types";

describe("shouldShowRegisterButton", () => {
  describe("when registration should NOT be shown", () => {
    it("should return false when project has no registration_config", () => {
      const project = {} as Project;

      const result = shouldShowRegisterButton(project);

      expect(result).toBe(false);
    });

    it('should return false when registration status is "ended"', () => {
      const project = {
        registration_config: {
          status: "ended",
        },
      } as Project;

      const result = shouldShowRegisterButton(project);

      expect(result).toBe(false);
    });

    it("should return false when project is a draft", () => {
      const project = {
        is_draft: true,
        registration_config: {
          status: "open",
        },
      } as Project;

      const result = shouldShowRegisterButton(project);

      expect(result).toBe(false);
    });
  });

  describe("when registration should be shown", () => {
    it('should return true when config exists and status is "open"', () => {
      const project = {
        registration_config: {
          status: "open",
        },
      } as Project;

      const result = shouldShowRegisterButton(project);

      expect(result).toBe(true);
    });

    it('should return true when config exists and status is "full"', () => {
      const project = {
        registration_config: {
          status: "full",
        },
      } as Project;

      const result = shouldShowRegisterButton(project);

      expect(result).toBe(true);
    });

    it('should return true when config exists and status is "closed"', () => {
      const project = {
        registration_config: {
          status: "closed",
        },
      } as Project;

      const result = shouldShowRegisterButton(project);

      expect(result).toBe(true);
    });
  });
});

describe("getRegisterButtonText", () => {
  const mockTexts = {
    register_now: "Register Now",
    booked_out: "Booked Out",
  };

  it('should return "Register Now" text when status is "open"', () => {
    const project = {
      registration_config: {
        status: "open",
      },
    } as Project;

    const result = getRegisterButtonText(project, mockTexts);

    expect(result).toBe("Register Now");
  });

  it('should return "Booked Out" text when status is "full"', () => {
    const project = {
      registration_config: {
        status: "full",
      },
    } as Project;

    const result = getRegisterButtonText(project, mockTexts);

    expect(result).toBe("Booked Out");
  });

  it('should return "Booked Out" text when status is "closed"', () => {
    const project = {
      registration_config: {
        status: "closed",
      },
    } as Project;

    const result = getRegisterButtonText(project, mockTexts);

    expect(result).toBe("Booked Out");
  });

  it('should return "Booked Out" text when status is "ended"', () => {
    const project = {
      registration_config: {
        status: "ended",
      },
    } as Project;

    const result = getRegisterButtonText(project, mockTexts);

    expect(result).toBe("Booked Out");
  });

  it('should return "Booked Out" text when registration_config is undefined', () => {
    const project = {} as Project;

    const result = getRegisterButtonText(project, mockTexts);

    expect(result).toBe("Booked Out");
  });

  it('should return "Booked Out" text when status is undefined', () => {
    const project = {
      registration_config: {},
    } as Project;

    const result = getRegisterButtonText(project, mockTexts);

    expect(result).toBe("Booked Out");
  });
});

describe("isRegisterButtonDisabled", () => {
  it('should return true when status is "closed"', () => {
    const project = {
      registration_config: {
        status: "closed",
      },
    } as Project;

    const result = isRegisterButtonDisabled(project);

    expect(result).toBe(true);
  });

  it('should return true when status is "full"', () => {
    const project = {
      registration_config: {
        status: "full",
      },
    } as Project;

    const result = isRegisterButtonDisabled(project);

    expect(result).toBe(true);
  });

  it('should return false when status is "open"', () => {
    const project = {
      registration_config: {
        status: "open",
      },
    } as Project;

    const result = isRegisterButtonDisabled(project);

    expect(result).toBe(false);
  });

  it('should return false when status is "ended"', () => {
    const project = {
      registration_config: {
        status: "ended",
      },
    } as Project;

    const result = isRegisterButtonDisabled(project);

    expect(result).toBe(false);
  });

  it("should return false when registration_config is undefined", () => {
    const project = {} as Project;

    const result = isRegisterButtonDisabled(project);

    expect(result).toBe(false);
  });

  it("should return false when status is undefined", () => {
    const project = {
      registration_config: {},
    } as Project;

    const result = isRegisterButtonDisabled(project);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRegistrationUIState — priority state machine (spec: member_cancel_event_registration)
// ---------------------------------------------------------------------------

describe("getRegistrationUIState", () => {
  const openProject = {
    registration_config: { status: "open" },
  } as Project;

  const fullProject = {
    registration_config: { status: "full" },
  } as Project;

  const closedProject = {
    registration_config: { status: "closed" },
  } as Project;

  const endedProject = {
    registration_config: { status: "ended" },
  } as Project;

  const noConfigProject = {} as Project;

  // ── "hidden" ──────────────────────────────────────────────────────────────

  describe('"hidden" — no config or ended status', () => {
    it("returns hidden when project has no registration_config", () => {
      expect(getRegistrationUIState(noConfigProject)).toBe("hidden");
    });

    it('returns hidden when status is "ended" and user is not registered', () => {
      expect(getRegistrationUIState(endedProject)).toBe("hidden");
    });

    it("returns hidden when project is a draft", () => {
      const draftProject = {
        is_draft: true,
        registration_config: { status: "open" },
      } as Project;
      expect(getRegistrationUIState(draftProject, false, false, false)).toBe("hidden");
    });
  });

  // ── Priority 1: "attended" ─────────────────────────────────────────────────

  describe('"attended" — priority 1: user had active registration at event start', () => {
    it("returns attended when hasAttended is true", () => {
      expect(getRegistrationUIState(openProject, false, true, false)).toBe("attended");
    });

    it("returns attended even when status is ended (past event)", () => {
      expect(getRegistrationUIState(endedProject, false, true, false)).toBe("attended");
    });

    it("returns attended even when isUserRegistered is also true (coexistence per spec)", () => {
      // spec: has_attended and is_registered can coexist — attended always wins
      expect(getRegistrationUIState(openProject, true, true, false)).toBe("attended");
    });
  });

  // ── Priority 2: "cancel" ───────────────────────────────────────────────────

  describe('"cancel" — priority 2: active registration, event not yet started', () => {
    it("returns cancel when user is registered and has not attended", () => {
      expect(getRegistrationUIState(openProject, true, false, false)).toBe("cancel");
    });

    it("returns cancel regardless of registration status (full event, still registered)", () => {
      expect(getRegistrationUIState(fullProject, true, false, false)).toBe("cancel");
    });
  });

  // ── Priority 3: "adminClosed" ──────────────────────────────────────────────

  describe('"adminClosed" — priority 3: registration cancelled by admin', () => {
    it("returns adminClosed when adminCancelled is true and user is not registered", () => {
      expect(getRegistrationUIState(openProject, false, false, true)).toBe("adminClosed");
    });

    it("returns adminClosed even when event registration is still open to others", () => {
      expect(getRegistrationUIState(openProject, false, false, true)).toBe("adminClosed");
    });

    it("returns adminClosed even when event registration is full", () => {
      expect(getRegistrationUIState(fullProject, false, false, true)).toBe("adminClosed");
    });
  });

  // ── Priority 4: "register" ─────────────────────────────────────────────────

  describe('"register" — priority 4: registration open, user not registered', () => {
    it('returns register when status is "open" and user is not registered', () => {
      expect(getRegistrationUIState(openProject, false, false, false)).toBe("register");
    });

    it("returns register when isUserRegistered and adminCancelled are both undefined/false", () => {
      expect(getRegistrationUIState(openProject)).toBe("register");
    });
  });

  // ── Priority 5: "closed" ───────────────────────────────────────────────────

  describe('"closed" — priority 5: registration not open, user not registered', () => {
    it('returns closed when status is "full"', () => {
      expect(getRegistrationUIState(fullProject, false, false, false)).toBe("closed");
    });

    it('returns closed when status is "closed"', () => {
      expect(getRegistrationUIState(closedProject, false, false, false)).toBe("closed");
    });
  });
});

describe("formatSeatCount", () => {
  it("uses singular and plural copy in English", () => {
    const texts = getTexts({ page: "project", locale: "en" });
    expect(formatSeatCount(1, texts)).toBe("1 seat");
    expect(formatSeatCount(2, texts)).toBe("2 seats");
  });

  it("uses singular and plural copy in German", () => {
    const texts = getTexts({ page: "project", locale: "de" });
    expect(formatSeatCount(1, texts)).toBe("1 Platz");
    expect(formatSeatCount(3, texts)).toBe("3 Plätze");
  });
});

describe("getSelectableSeatMax", () => {
  it("is the per-registration maximum when enough seats are left", () => {
    expect(getSelectableSeatMax(3, 10)).toBe(3);
  });

  it("is capped by the seats left", () => {
    expect(getSelectableSeatMax(5, 2)).toBe(2);
  });

  it("is the maximum alone for unlimited capacity", () => {
    expect(getSelectableSeatMax(4, null)).toBe(4);
  });

  it("defaults to 1 when the maximum is absent and never drops below 1", () => {
    expect(getSelectableSeatMax(undefined, 10)).toBe(1);
    expect(getSelectableSeatMax(3, 0)).toBe(1);
  });
});

describe("sumActiveSeats", () => {
  it("sums seats of active registrations only, defaulting missing counts to 1", () => {
    expect(
      sumActiveSeats([
        { cancelled_at: null, number_of_seats: 3 },
        { cancelled_at: "2026-10-01T10:00:00Z", number_of_seats: 2 },
        { cancelled_at: null },
      ])
    ).toBe(4);
  });
});

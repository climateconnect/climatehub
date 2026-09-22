import getProjectInfoMetadata from "../data/getProjectInfoMetadata";
import { getLocationFilterKeys } from "../data/locationFilters";
import getOrganizationInfoMetadata from "../data/organization_info_metadata";
import profile_info_metadata from "../data/profile_info_metadata";

export function parseData({ type, data }) {
  if (type === "projects") return parseProjects(data);
  if (type === "organizations") return parseOrganizations(data);
  if (type === "members") return parseMembers(data);
  if (type === "ideas") return parseIdeas(data);
}

const parseProjects = (projects) => {
  return projects.map((project) => ({
    ...project,
    location: project.location,
    sectors: project.sectors.sort((a, b) => a.order - b.order).map((s) => s.sector),
  }));
};

export function parseProjectStubs(projects) {
  return projects.map((p) => {
    const project = p.project;
    return {
      ...project,
      location: project.location,
      sectors: project.sectors.sort((a, b) => a.order - b.order).map((s) => s.sector),
    };
  });
}

/**
 * Parses organization stubs as returned by GET /api/member/<slug>/organizations/,
 * where each item is wrapped as `{ organization: {...} }`. The `key` field is
 * added to each type so that OrganizationPreviewHeader can render stable Chip
 * keys (see `parseOrganization` in organizationOperations.ts for the same
 * pattern).
 */
export function parseOrganizationStubs(organizations) {
  return organizations.map((o) => ({
    ...o.organization,
    types: o.organization.types.map((t) => ({
      ...t.organization_tag,
      key: t.organization_tag.id,
    })),
    info: {
      location: o.organization.location,
      short_description: o.organization?.short_description,
    },
  }));
}

/**
 * Parses a flat array of project stub objects (as returned by e.g.
 * GET /api/members/me/registered-events/ which uses ProjectStubSerializer directly,
 * without a wrapping `.project` key).
 */
export function parseDirectProjectStubs(projects) {
  return projects.map((project) => ({
    ...project,
    location: project.location,
    sectors: project.sectors.sort((a, b) => a.order - b.order).map((s) => s.sector),
  }));
}

const parseMembers = (members) => {
  return members;
};

const parseIdeas = (ideas) => {
  return ideas.map((idea) => ({
    ...idea,
  }));
};

const parseOrganizations = (organizations) => {
  return organizations.map((organization) => ({
    ...organization,
    types: organization.types.map((type) => ({
      ...type.organization_tag,
      key: type.organization_tag.id,
    })),
    info: {
      location: organization.location,
    },
  }));
};

export function getMessageFromUrl(message) {
  if (typeof message === "object") return message;
  else return decodeURIComponent(message).replaceAll("+", " ");
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
export function getInfoMetadataByType(type, locale?) {
  if (type === "organizations") return getOrganizationInfoMetadata(locale);
  if (type === "profiles" || type === "members") return profile_info_metadata(locale);
  if (type === "projects") return getProjectInfoMetadata();
}

export function getReducedPossibleFilters(possibleFilters, locationFilter = undefined) {
  const reducedPossibleFilters = possibleFilters.reduce((map, obj) => {
    const locationKeys = getLocationFilterKeys();
    //don't add location keys to the reduced possible filters. They are represented by the locationFilter
    if (locationKeys.includes(obj.key)) {
      return map;
    }
    // Handle initializing to an array for multiselects, otherwise an empty string
    if (obj.type === "multiselect" || obj.type === "openMultiSelectDialogButton") {
      map[obj.key] = [];
    } else {
      map[obj.key] = "";
    }

    return map;
  }, {});
  if (locationFilter) {
    reducedPossibleFilters.location = locationFilter;
  }
  return reducedPossibleFilters;
}

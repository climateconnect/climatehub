import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ResponsiveImage, {
  BACKGROUND_SOURCES,
  BACKGROUND_SOURCES_SMALL,
  THUMBNAIL_SOURCES,
  HERO_SOURCES,
  resolveVariantUrl,
} from "./ResponsiveImage";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { ImageVariants } from "../../types";

// getImageUrl's behaviour depends on ENVIRONMENT and API_URL, which come from a
// gitignored .env locally and are absent in CI — so a test asserting its real
// output passes on one and fails on the other. Mock it as identity: the URLs
// below are already absolute, and the one test that cares about the wiring
// asserts the call instead of the result.
jest.mock("../../../public/lib/imageOperations", () => ({
  getImageUrl: jest.fn((url?: string) => url),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL = "https://cdn.example.org/projects/1/original.jpeg";

const FULL_VARIANTS: ImageVariants = {
  image: {
    "1200": "https://cdn.example.org/projects/1/original_1200.webp",
    "600": "https://cdn.example.org/projects/1/original_600.webp",
  },
  thumbnail_image: {
    webp: "https://cdn.example.org/projects/1/thumb_webp.webp",
  },
  background_image: {
    "1200": "https://cdn.example.org/projects/1/bg_1200.webp",
    "600": "https://cdn.example.org/projects/1/bg_600.webp",
  },
};

/** The <picture> element wrapping the rendered <img>. */
function getSources(): HTMLSourceElement[] {
  const picture = screen.getByRole("img").parentElement as HTMLElement;
  return Array.from(picture.querySelectorAll("source"));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("ResponsiveImage", () => {
  it("renders a WebP <source> per available variant", () => {
    render(<ResponsiveImage src={ORIGINAL} variants={FULL_VARIANTS} alt="A project" />);

    const sources = getSources();
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute("srcset", FULL_VARIANTS.image["1200"]);
    expect(sources[0]).toHaveAttribute("type", "image/webp");
    expect(sources[0]).toHaveAttribute("media", "(min-width: 900px)");
    expect(sources[1]).toHaveAttribute("srcset", FULL_VARIANTS.image["600"]);
    expect(sources[1]).not.toHaveAttribute("media");
  });

  it("always renders the original as the <img> fallback", () => {
    render(<ResponsiveImage src={ORIGINAL} variants={FULL_VARIANTS} alt="A project" />);

    expect(screen.getByRole("img")).toHaveAttribute("src", ORIGINAL);
  });

  it("renders no <source> elements for a legacy row with no variants", () => {
    render(<ResponsiveImage src={ORIGINAL} alt="A project" />);

    expect(getSources()).toHaveLength(0);
    expect(screen.getByRole("img")).toHaveAttribute("src", ORIGINAL);
  });

  it("skips variants that were never generated", () => {
    const partial: ImageVariants = { image: { "600": FULL_VARIANTS.image["600"] } };
    render(<ResponsiveImage src={ORIGINAL} variants={partial} alt="A project" />);

    const sources = getSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toHaveAttribute("srcset", FULL_VARIANTS.image["600"]);
  });

  it("ignores variants belonging to a different image field", () => {
    const backgroundOnly: ImageVariants = {
      background_image: FULL_VARIANTS.background_image,
    };
    render(<ResponsiveImage src={ORIGINAL} variants={backgroundOnly} alt="A project" />);

    expect(getSources()).toHaveLength(0);
  });

  it("reads the field named by the given sources", () => {
    render(
      <ResponsiveImage
        src={ORIGINAL}
        variants={FULL_VARIANTS}
        sources={THUMBNAIL_SOURCES}
        alt="A card"
      />
    );

    const sources = getSources();
    expect(sources[0]).toHaveAttribute("srcset", FULL_VARIANTS.thumbnail_image.webp);
  });

  it("puts the layout class on <picture>, which is what the layout sizes", () => {
    render(
      <ResponsiveImage
        src={ORIGINAL}
        variants={FULL_VARIANTS}
        className="inlineImage"
        alt="A project"
      />
    );

    const picture = screen.getByRole("img").parentElement as HTMLElement;
    expect(picture.tagName).toBe("PICTURE");
    expect(picture).toHaveClass("inlineImage");
    expect(screen.getByRole("img")).not.toHaveClass("inlineImage");
  });

  it("passes through alt text and lazy loading", () => {
    render(
      <ResponsiveImage
        src={ORIGINAL}
        variants={FULL_VARIANTS}
        alt="Project image of Solar Roof"
        loading="lazy"
      />
    );

    const img = screen.getByAltText("Project image of Solar Roof");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});

// ---------------------------------------------------------------------------
// resolveVariantUrl — the single-URL path used by CSS backgrounds / CardMedia
// ---------------------------------------------------------------------------

describe("resolveVariantUrl", () => {
  it("returns the first available candidate", () => {
    expect(resolveVariantUrl(FULL_VARIANTS, HERO_SOURCES, ORIGINAL)).toBe(
      FULL_VARIANTS.image["1200"]
    );
  });

  it("falls through to the next candidate when the first is missing", () => {
    const partial: ImageVariants = { image: { "600": FULL_VARIANTS.image["600"] } };
    expect(resolveVariantUrl(partial, HERO_SOURCES, ORIGINAL)).toBe(FULL_VARIANTS.image["600"]);
  });

  it("falls back to the original when no variant exists", () => {
    expect(resolveVariantUrl(undefined, HERO_SOURCES, ORIGINAL)).toBe(ORIGINAL);
    expect(resolveVariantUrl({}, HERO_SOURCES, ORIGINAL)).toBe(ORIGINAL);
  });

  it("prefers the thumbnail WebP for cards, not the larger 600px image", () => {
    expect(resolveVariantUrl(FULL_VARIANTS, THUMBNAIL_SOURCES, ORIGINAL)).toBe(
      FULL_VARIANTS.thumbnail_image.webp
    );
  });

  it("falls back to the 600px image for cards on rows with no thumbnail", () => {
    const noThumb: ImageVariants = { image: FULL_VARIANTS.image };
    expect(resolveVariantUrl(noThumb, THUMBNAIL_SOURCES, ORIGINAL)).toBe(FULL_VARIANTS.image["600"]);
  });

  it("routes the variant URL through getImageUrl, not just the fallback", () => {
    // Local dev storage returns "/media/..."; without getImageUrl the browser
    // resolves that against the frontend origin (:3000) instead of the backend
    // and 404s. Azure returns absolute URLs, which getImageUrl passes through.
    const relative: ImageVariants = {
      image: { "1200": "/media/projects/12/a3f9_1200.webp" },
    };

    resolveVariantUrl(relative, HERO_SOURCES, ORIGINAL);

    expect(getImageUrl).toHaveBeenCalledWith("/media/projects/12/a3f9_1200.webp");
  });

  it("picks the banner size matching the viewport", () => {
    expect(resolveVariantUrl(FULL_VARIANTS, BACKGROUND_SOURCES, ORIGINAL)).toBe(
      FULL_VARIANTS.background_image["1200"]
    );
    expect(resolveVariantUrl(FULL_VARIANTS, BACKGROUND_SOURCES_SMALL, ORIGINAL)).toBe(
      FULL_VARIANTS.background_image["600"]
    );
  });
});

import React from "react";
import { getImageUrl } from "../../../public/lib/imageOperations";
import type { ImageVariants } from "../../types";

/**
 * One candidate entry in the `image_variants` map.
 *
 * `field` is the image field the variant belongs to ("image",
 * "thumbnail_image", "background_image"); `key` is the variant within it
 * ("1200"/"600" for resized variants, "webp" for the format-only thumbnail
 * conversion). Numeric keys double as the `w` descriptor in `<picture>`
 * srcsets.
 */
export type VariantSource = {
  field?: string;
  key: string;
};

/**
 * Hero images (project detail, headers). In `<ResponsiveImage>` both widths go
 * into one srcset and the browser picks by rendered size and pixel density;
 * as a single-URL list for {@link resolveVariantUrl}, the larger one wins.
 */
export const HERO_SOURCES: VariantSource[] = [
  { field: "image", key: "1200" },
  { field: "image", key: "600" },
];

/**
 * Header banners are CSS `background-image`s, which cannot use `<picture>`, so
 * the viewport has to be resolved in JS. Pass the matching list to
 * {@link resolveVariantUrl} — each falls back to the other size, then to the
 * original, so a half-backfilled row still renders.
 */
export const BACKGROUND_SOURCES: VariantSource[] = [
  { field: "background_image", key: "1200" },
  { field: "background_image", key: "600" },
];

export const BACKGROUND_SOURCES_SMALL: VariantSource[] = [
  { field: "background_image", key: "600" },
  { field: "background_image", key: "1200" },
];

/**
 * Any surface small enough to be served by the thumbnail: project/organization
 * cards, and the avatars on organization and profile detail pages.
 *
 * Both want the format-only thumbnail WebP. For cards the 600px variant of the
 * full image would be a *larger* download than the 290x160 thumbnail they are
 * already fed; for detail-page avatars the `image` field holds the uploader's
 * full-size crop (1859px for a 142px slot is typical), so the thumbnail has to
 * be asked for explicitly. The `image` entry is the fallback for rows with no
 * thumbnail.
 */
export const THUMBNAIL_SOURCES: VariantSource[] = [
  { field: "thumbnail_image", key: "webp" },
  { field: "image", key: "600" },
];

function lookupVariant(
  variants: ImageVariants | undefined,
  source: VariantSource
): string | undefined {
  const field = source.field ?? "image";
  const url = variants?.[field]?.[source.key];
  // Variant URLs need the same treatment as the original: on Azure they are
  // already absolute and pass through untouched, but local dev storage returns
  // "/media/..." which would otherwise resolve against the frontend's own
  // origin (port 3000) instead of the backend's.
  return url ? getImageUrl(url) : undefined;
}

/**
 * Pick the best available variant URL, falling back to the original image.
 *
 * Use this where a single URL is required and `<picture>` is not available —
 * CSS `background-image`, MUI `CardMedia`, Open Graph tags. Candidates are
 * tried in order and `media` is ignored, so the caller decides which list to
 * pass for the viewport it is rendering.
 */
export function resolveVariantUrl(
  variants: ImageVariants | undefined,
  sources: VariantSource[],
  originalUrl: string
): string {
  for (const source of sources) {
    const url = lookupVariant(variants, source);
    if (url) return url;
  }
  return getImageUrl(originalUrl);
}

export interface ResponsiveImageProps {
  /** Original image URL (JPEG/PNG). Used as the `<img>` fallback. */
  src: string;
  /** The `image_variants` payload from the API. */
  variants?: ImageVariants;
  /** Variant candidates, in order of preference. Defaults to {@link HERO_SOURCES}. */
  sources?: VariantSource[];
  /** Alt text. Pass "" for decorative images. */
  alt?: string;
  /**
   * Layout class. Applied to the `<picture>` element, which is the box the
   * surrounding layout sees — a flex item, for instance. The `<img>` inside
   * fills it.
   */
  className?: string;
  /** Inline style for the `<picture>` element. */
  style?: React.CSSProperties;
  /** Class for the inner `<img>`, for the rare case it needs its own styling. */
  imgClassName?: string;
  /** Inline style for the inner `<img>`, merged over the fill-the-picture default. */
  imgStyle?: React.CSSProperties;
  /** Rendered width (`sizes`) for the WebP srcset; the browser picks by it and DPR. Defaults to 100vw. */
  sizes?: string;
  /** Native lazy-loading hint. */
  loading?: "eager" | "lazy";
}

/**
 * Build the WebP srcset for the available variants.
 *
 * Resized variants are listed with `w` descriptors so the browser chooses by
 * rendered size *and* pixel density: a 400px-wide phone at DPR 3 gets the
 * 1200px file, a 550px desktop slot at DPR 1 the 600px one. A srcset cannot
 * mix `w` descriptors with bare URLs, so a format-only variant (e.g. the
 * thumbnail's "webp" key) is only used when no resized variant exists.
 */
function buildSrcSet(available: { source: VariantSource; url: string }[]): string | undefined {
  const resized = available.filter(({ source }) => /^\d+$/.test(source.key));
  if (resized.length > 0) {
    return resized.map(({ source, url }) => `${url} ${source.key}w`).join(", ");
  }
  return available[0]?.url;
}

/**
 * Renders a `<picture>` with a WebP `<source>` when variants exist, and a
 * plain `<img>` with the original URL when they do not — so legacy rows that
 * were never backfilled keep working.
 *
 * Use it for the large image surfaces (project detail hero, headers). Surfaces
 * that want a single URL rather than a `<picture>` — CSS backgrounds, CardMedia,
 * avatars — use {@link resolveVariantUrl} directly.
 */
export default function ResponsiveImage({
  src,
  variants,
  sources = HERO_SOURCES,
  alt = "",
  className,
  style,
  imgClassName,
  imgStyle,
  sizes,
  loading,
}: ResponsiveImageProps) {
  const fallbackUrl = getImageUrl(src);

  // Drop candidates that have no variant so the browser never gets a srcset
  // entry pointing at a file that was never generated.
  const available = sources
    .map((source) => ({ source, url: lookupVariant(variants, source) }))
    .filter((entry): entry is { source: VariantSource; url: string } => !!entry.url);
  const srcSet = buildSrcSet(available);

  return (
    <picture className={className} style={{ display: "block", ...style }}>
      {srcSet && <source srcSet={srcSet} sizes={sizes} type="image/webp" />}
      <img
        src={fallbackUrl}
        alt={alt}
        className={imgClassName}
        style={{ width: "100%", height: "auto", display: "block", ...imgStyle }}
        loading={loading}
      />
    </picture>
  );
}

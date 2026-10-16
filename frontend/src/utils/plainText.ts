// Matches real HTML tags only, so stray "<" / ">" (e.g. "I <3 climate") are kept.
const HTML_TAG_REGEX = /<\/?[a-zA-Z][^>]*>/g;

export const stripHtmlTags = (text: string): string => text.replace(HTML_TAG_REGEX, "");

/** Strips HTML tags and surrounding whitespace so user input is sent as plain text. */
export const toPlainText = (text: string): string => stripHtmlTags(text).trim();

/** Length in Unicode code points (matches Python's len()). */
export const codePointLength = (text: string): number => [...text].length;

/** Truncates to at most maxLength Unicode code points. */
export const truncateCodePoints = (text: string, maxLength: number): string =>
  [...text].slice(0, maxLength).join("");

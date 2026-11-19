import re

import bleach
from bleach.css_sanitizer import CSSSanitizer
from django.core.files.storage import default_storage

YOUTUBE_IFRAME_SRC_RE = re.compile(
    r"^https://www\.youtube-nocookie\.com/embed/[\w-]+(\?.*)?$"
)

PROJECT_DESCRIPTION_ALLOWED_TAGS = [
    "p",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "a",
    "br",
    "ul",
    "ol",
    "li",
    "blockquote",
    "div",
    "iframe",
    "figure",
    "figcaption",
    "img",
]

PROJECT_DESCRIPTION_ALLOWED_ATTRIBUTES = {
    "a": ["href", "target", "rel"],
    "div": ["data-youtube-video"],
    "iframe": [
        "src",
        "width",
        "height",
        "allowfullscreen",
        "frameborder",
        "title",
        "autoplay",
        "disablekbcontrols",
        "enableiframeapi",
        "endtime",
        "ivloadpolicy",
        "loop",
        "modestbranding",
        "origin",
        "playlist",
        "rel",
        "start",
    ],
    "figure": ["class"],
    "img": [
        "src",
        "srcset",
        "sizes",
        "alt",
        "width",
        "height",
        "data-image-id",
        "loading",
    ],
}

# Classes a rich-text image block may carry: one size and one alignment.
RICH_TEXT_IMAGE_SIZE_CLASSES = (
    "image-size-small",
    "image-size-medium",
    "image-size-full",
)
RICH_TEXT_IMAGE_ALIGN_CLASSES = (
    "image-align-left",
    "image-align-center",
    "image-align-right",
)
RICH_TEXT_IMAGE_DIR = "rich_text_images/"


def _strip_dangerous_tags(html):
    """Remove tags that can execute code or inject styles, including their content.

    Note: <iframe> is NOT stripped here — it is handled by a post-bleach
    filter that only allows YouTube-nocookie iframes through.
    """
    return re.sub(
        r"<(script|object|embed|style)\b[^>]*>.*?</\1>|<(script|object|embed|style)\b[^>]*/>",
        "",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )


def _filter_non_youtube_iframes(html):
    """Remove <iframe> elements whose src does not match the YouTube-nocookie allowlist.

    If an iframe's src is missing or doesn't match, the entire iframe element is dropped.
    """

    def _check_iframe(match):
        full_tag = match.group(0)
        src_match = re.search(r'src=["\']([^"\']*)["\']', full_tag)
        if src_match and YOUTUBE_IFRAME_SRC_RE.match(src_match.group(1)):
            return full_tag
        return ""

    return re.sub(
        r"<iframe\b[^>]*>.*?</iframe>|<iframe\b[^>]*/>",
        _check_iframe,
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )


def _rich_text_image_url_re():
    """Regex for URLs of stored rich-text image variants.

    Local storage returns a path ("/media/..."); the upload endpoint makes it
    absolute with the backend's host, so any host is accepted before that path.
    """
    base = default_storage.url(RICH_TEXT_IMAGE_DIR + "x.webp")[: -len("x.webp")]
    prefix = re.escape(base)
    if base.startswith("/"):
        prefix = r"https?://[^/\s\"']+" + prefix
    return re.compile("^" + prefix + r"[0-9a-f]{32}\.webp$")


def _attribute(tag, name):
    match = re.search(r'\s%s="([^"]*)"' % re.escape(name), tag)
    return match.group(1) if match else None


def _filter_foreign_images(html):
    """Keep only <img> elements that show a stored rich-text image.

    An <img> needs a numeric data-image-id, and its src and every srcset URL
    must point to a stored variant. bleach checks the protocol of src but not of
    srcset, so without this filter srcset could carry any URL. Everything else
    (other hosts, data: URLs, tracking pixels) is removed.
    """
    url_re = _rich_text_image_url_re()

    def _check_img(match):
        tag = match.group(0)
        image_id = _attribute(tag, "data-image-id")
        src = _attribute(tag, "src")
        srcset = _attribute(tag, "srcset") or ""
        urls = [src] + [
            candidate.strip().split(" ")[0]
            for candidate in srcset.split(",")
            if candidate.strip()
        ]
        if (
            image_id
            and image_id.isdigit()
            and all(url and url_re.match(url) for url in urls)
        ):
            return tag
        return ""

    html = re.sub(r"<img\b[^>]*>", _check_img, html, flags=re.IGNORECASE)

    def _check_figure_class(match):
        allowed = RICH_TEXT_IMAGE_SIZE_CLASSES + RICH_TEXT_IMAGE_ALIGN_CLASSES
        classes = [c for c in match.group(1).split() if c in allowed]
        return ' class="%s"' % " ".join(classes) if classes else ""

    html = re.sub(
        r'(?<=<figure)\s+class="([^"]*)"',
        _check_figure_class,
        html,
        flags=re.IGNORECASE,
    )
    # A figure without an image is left over from a removed <img>.
    return re.sub(
        r"<figure\b[^>]*>(?:(?!<img\b).)*?</figure>",
        "",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )


def sanitize_html(html_input, allowed_tags=None, allowed_attributes=None):
    """
    Sanitize HTML using bleach, stripping disallowed tags and attributes.
    Forces rel="noopener noreferrer" on every <a> tag.
    Filters CSS styles via ``CSSSanitizer`` — only ``text-align`` and
    ``background-color`` are permitted.
    Returns "" for blank or empty input.

    Callers may pass a custom allowlist to support different rich-text fields.
    The defaults cover the checkbox description (bold + links only).
    """
    if not html_input or not html_input.strip():
        return ""
    if allowed_tags is None:
        allowed_tags = ["p", "strong", "b", "a", "br"]
    if allowed_attributes is None:
        allowed_attributes = {"a": ["href", "target"]}

    # Pre-process: remove dangerous tags AND their content before bleach.
    # <iframe> is NOT stripped here — it is handled by a post-bleach filter
    # that only allows YouTube-nocookie iframes through.
    cleaned = _strip_dangerous_tags(html_input)

    # Determine whether any caller-provided attribute list includes "style".
    has_style_attrs = any("style" in attrs for attrs in allowed_attributes.values())

    css_sanitizer = (
        CSSSanitizer(allowed_css_properties=["text-align", "background-color"])
        if has_style_attrs
        else None
    )

    cleaned = bleach.clean(
        cleaned,
        tags=allowed_tags,
        attributes=allowed_attributes,
        css_sanitizer=css_sanitizer,
        strip=True,
    )

    # Post-bleach: filter iframes to only allow YouTube-nocookie embeds.
    if "iframe" in allowed_tags:
        cleaned = _filter_non_youtube_iframes(cleaned)

    # Post-bleach: only images stored by the platform.
    if "img" in allowed_tags:
        cleaned = _filter_foreign_images(cleaned)

    # Force rel="noopener noreferrer" on every <a> tag, replacing any existing rel.
    def _force_rel(match):
        tag_inner = match.group(1)
        tag_inner = re.sub(
            r'\s+rel=["\'][^"\']*["\']', "", tag_inner, flags=re.IGNORECASE
        )
        return f'<a{tag_inner} rel="noopener noreferrer">'

    cleaned = re.sub(r"<a([^>]*)>", _force_rel, cleaned)

    # Remove empty style="" left by CSSSanitizer when all properties are stripped.
    cleaned = re.sub(r'\s+style=""', "", cleaned)

    return cleaned

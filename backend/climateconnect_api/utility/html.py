import html
import re
from dataclasses import dataclass, field
from functools import partial

import bleach
from bleach import html5lib_shim
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
    "figure": ["class", "style"],
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
# An image block's style holds only facts about the image, set by the server:
# natural width in px (--w) and aspect ratio width/height (--r). All layout
# rules live in the frontend CSS.
RICH_TEXT_IMAGE_STYLE_RE = re.compile(r"^--w: \d{1,5}; --r: \d{1,3}(\.\d{1,4})?;?$")


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


@dataclass
class RichTextImageBlock:
    """One image block: <figure> with an <img> and an optional plain-text caption.

    Attribute values and the caption are plain text (entities decoded).
    """

    classes: list = field(default_factory=list)
    style: str = None
    image: dict = field(default_factory=dict)
    caption: str = ""

    def tokens(self):
        """The block as html5lib tokens, in its canonical form."""
        figure = {"class": " ".join(self.classes) or None, "style": self.style}
        yield _start_tag("StartTag", "figure", figure)
        yield _start_tag("EmptyTag", "img", self.image)
        if self.caption:
            yield _start_tag("StartTag", "figcaption", {})
            yield {"type": "Characters", "data": self.caption}
            yield {"type": "EndTag", "name": "figcaption", "namespace": None}
        yield {"type": "EndTag", "name": "figure", "namespace": None}


def _start_tag(kind, name, attributes):
    # bleach keeps entities in attribute values as text and only escapes a "&"
    # that does not start an entity, so a literal "&" is written as "&amp;".
    data = {
        (None, key): value.replace("&", "&amp;")
        for key, value in attributes.items()
        if value is not None
    }
    return {"type": kind, "name": name, "namespace": None, "data": data}


def _plain_attributes(token):
    return {key: html.unescape(value) for (_ns, key), value in token["data"].items()}


class RichTextImageFilter(html5lib_shim.Filter):
    """Keep only valid image blocks, in their canonical form.

    Runs inside bleach on the parsed tokens, after sanitising, so attribute
    values are read as values (quotes and characters such as ">" in an alt
    text don't matter). An image block keeps the first <img> that shows a
    stored rich-text image: a numeric data-image-id, and src and every srcset
    URL pointing to a stored variant (bleach checks the protocol of src but not
    of srcset). The figure keeps only known classes and a style that matches
    RICH_TEXT_IMAGE_STYLE_RE; the caption becomes plain text. Blocks without
    such an image and images outside a block are removed.

    *resolve_block*, if given, receives each :class:`RichTextImageBlock` and
    returns the block to write, or ``None`` to remove it.
    """

    def __init__(self, source, resolve_block=None):
        super().__init__(source)
        self.resolve_block = resolve_block
        self.url_re = _rich_text_image_url_re()

    def __iter__(self):
        block, depth = None, 0
        for token in super().__iter__():
            kind, name = token["type"], token.get("name")
            is_tag = kind in ("StartTag", "EmptyTag", "EndTag")
            if block is None:
                if kind == "StartTag" and name == "figure":
                    block, depth = [token], 1
                elif not (is_tag and name == "img"):
                    yield token
                continue
            block.append(token)
            if is_tag and name == "figure":
                depth += 1 if kind == "StartTag" else -1
                if depth == 0:
                    yield from self._image_block(block)
                    block = None
        if block:
            yield from self._image_block(block)

    def _is_stored_image(self, image):
        image_id = image.get("data-image-id") or ""
        urls = [image.get("src")] + [
            candidate.split()[0]
            for candidate in (image.get("srcset") or "").split(",")
            if candidate.strip()
        ]
        return image_id.isdigit() and all(
            url and self.url_re.match(url) for url in urls
        )

    def _image_block(self, tokens):
        figure = _plain_attributes(tokens[0])
        image, caption, in_caption = None, [], False
        for token in tokens[1:]:
            kind, name = token["type"], token.get("name")
            if kind == "EmptyTag" and name == "img" and image is None:
                attributes = _plain_attributes(token)
                if self._is_stored_image(attributes):
                    image = attributes
            elif kind in ("StartTag", "EndTag") and name == "figcaption":
                in_caption = kind == "StartTag"
            elif in_caption and kind in ("Characters", "SpaceCharacters"):
                caption.append(token["data"])
            elif in_caption and kind == "Entity":
                caption.append(html.unescape("&%s;" % name))
        if image is None:
            return
        allowed = RICH_TEXT_IMAGE_SIZE_CLASSES + RICH_TEXT_IMAGE_ALIGN_CLASSES
        style = figure.get("style")
        block = RichTextImageBlock(
            classes=[c for c in (figure.get("class") or "").split() if c in allowed],
            style=style if style and RICH_TEXT_IMAGE_STYLE_RE.match(style) else None,
            image=image,
            caption=" ".join("".join(caption).split()),
        )
        if self.resolve_block is not None:
            block = self.resolve_block(block)
        if block is not None:
            yield from block.tokens()


def sanitize_html(
    html_input, allowed_tags=None, allowed_attributes=None, resolve_image_block=None
):
    """
    Sanitize HTML using bleach, stripping disallowed tags and attributes.
    Forces rel="noopener noreferrer" on every <a> tag.
    Filters CSS styles via ``CSSSanitizer`` — only ``text-align`` and
    ``background-color`` are permitted.
    Returns "" for blank or empty input.

    Callers may pass a custom allowlist to support different rich-text fields.
    The defaults cover the checkbox description (bold + links only).

    If the allowlist includes ``img``, image blocks are filtered by
    :class:`RichTextImageFilter`; *resolve_image_block* is passed on to it.
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
        CSSSanitizer(
            allowed_css_properties=["text-align", "background-color", "--w", "--r"]
        )
        if has_style_attrs
        else None
    )

    filters = []
    if "img" in allowed_tags:
        filters.append(partial(RichTextImageFilter, resolve_block=resolve_image_block))

    cleaned = bleach.Cleaner(
        tags=allowed_tags,
        attributes=allowed_attributes,
        css_sanitizer=css_sanitizer,
        strip=True,
        filters=filters,
    ).clean(cleaned)

    # Post-bleach: filter iframes to only allow YouTube-nocookie embeds.
    if "iframe" in allowed_tags:
        cleaned = _filter_non_youtube_iframes(cleaned)

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

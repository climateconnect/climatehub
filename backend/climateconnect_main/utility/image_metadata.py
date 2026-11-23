"""
Lossless removal of metadata from uploaded images.

Uploaded originals are kept at full quality (no re-encoding), but they must not
carry metadata such as the GPS location where a photo was taken, camera data,
XMP or IPTC blocks, or extra images appended by phones (depth maps, motion
photo videos). These filters work on the file's bytes: they copy the image
data unchanged and drop everything else, except colour information (ICC
profiles) that is needed to display the image correctly.

The EXIF orientation is the one piece of metadata that is kept: when the
original has an orientation other than "normal", a new minimal EXIF block with
only the orientation tag is written back, so the original still displays
upright and variants can be regenerated from it later.
"""

import io
import struct
import zlib

from PIL import Image

EXIF_ORIENTATION_TAG = 0x0112
EXIF_HEADER = b"Exif\x00\x00"


class MetadataStripError(ValueError):
    """The file structure could not be parsed, so metadata cannot be removed."""


def read_orientation(source_bytes):
    """Return the EXIF orientation (1–8) of an image, or 1 if it has none."""
    try:
        with Image.open(io.BytesIO(source_bytes)) as image:
            orientation = image.getexif().get(EXIF_ORIENTATION_TAG, 1)
    except Exception:  # noqa: BLE001 – unreadable EXIF means "no orientation"
        return 1
    return orientation if orientation in range(1, 9) else 1


def _minimal_exif(orientation):
    """EXIF (TIFF) bytes holding only the orientation tag, with the Exif header."""
    exif = Image.Exif()
    exif[EXIF_ORIENTATION_TAG] = orientation
    data = exif.tobytes()
    return data if data.startswith(EXIF_HEADER) else EXIF_HEADER + data


def strip_metadata(source_bytes, image_format):
    """Return *source_bytes* without metadata. *image_format* is a Pillow format name.

    Raises :class:`MetadataStripError` when the file cannot be parsed.
    """
    orientation = read_orientation(source_bytes)
    if image_format == "JPEG":
        return _strip_jpeg(source_bytes, orientation)
    if image_format == "PNG":
        return _strip_png(source_bytes, orientation)
    if image_format == "WEBP":
        return _strip_webp(source_bytes, orientation)
    raise MetadataStripError(f"Unsupported format: {image_format}")


# --- JPEG -------------------------------------------------------------------

_SOI = 0xD8
_EOI = 0xD9
_SOS = 0xDA
_APP0 = 0xE0
_APP1 = 0xE1
_APP2 = 0xE2
_APP14 = 0xEE
_STANDALONE_MARKERS = {0x01, *range(0xD0, 0xD8)}  # TEM, RST0–RST7


def _keep_jpeg_segment(marker, payload):
    """Decide whether a marker segment before the image data is kept."""
    if marker == _APP0:
        return payload.startswith(b"JFIF\x00")
    if marker == _APP2:
        return payload.startswith(b"ICC_PROFILE\x00")
    if marker == _APP14:
        return payload.startswith(b"Adobe")
    # Every other APPn (EXIF, XMP, IPTC, MPF, ...) and comments are dropped.
    return not (0xE0 <= marker <= 0xEF or marker == 0xFE)


def _strip_jpeg(data, orientation):
    if len(data) < 4 or data[0] != 0xFF or data[1] != _SOI:
        raise MetadataStripError("Not a JPEG file")

    out = bytearray(b"\xff\xd8")
    exif_inserted = orientation == 1
    pos = 2
    length = len(data)

    while pos < length:
        if data[pos] != 0xFF:
            raise MetadataStripError("Expected a JPEG marker")
        while pos < length and data[pos] == 0xFF:  # fill bytes
            pos += 1
        if pos >= length:
            raise MetadataStripError("Truncated JPEG marker")
        marker = data[pos]
        pos += 1

        if marker in _STANDALONE_MARKERS:
            out += bytes((0xFF, marker))
            continue
        if marker == _EOI:
            out += b"\xff\xd9"
            return bytes(out)  # anything appended after EOI is dropped
        if pos + 2 > length:
            raise MetadataStripError("Truncated JPEG segment")
        (segment_length,) = struct.unpack(">H", data[pos : pos + 2])
        if segment_length < 2 or pos + segment_length > length:
            raise MetadataStripError("Invalid JPEG segment length")
        payload = data[pos + 2 : pos + segment_length]
        segment = bytes((0xFF, marker)) + data[pos : pos + segment_length]
        pos += segment_length

        if not exif_inserted and marker != _APP0:
            out += _jpeg_app1(_minimal_exif(orientation))
            exif_inserted = True

        if marker == _SOS:
            out += segment
            pos = _copy_jpeg_scans(data, pos, out)
            return bytes(out)
        if _keep_jpeg_segment(marker, payload):
            out += segment

    raise MetadataStripError("JPEG has no image data")


def _jpeg_app1(exif_bytes):
    return b"\xff\xe1" + struct.pack(">H", len(exif_bytes) + 2) + exif_bytes


def _copy_jpeg_scans(data, pos, out):
    """Copy the entropy-coded scans (and segments between scans) up to EOI.

    Inside scan data a 0xFF byte is followed by 0x00 (stuffing) or a restart
    marker, so the first other marker ends the scan. Progressive JPEGs have
    several scans with table segments in between, which are copied unchanged.
    """
    length = len(data)
    while pos < length:
        start = pos
        while True:
            ff = data.find(b"\xff", pos)
            if ff == -1 or ff + 1 >= length:
                raise MetadataStripError("JPEG has no end marker")
            following = data[ff + 1]
            if following == 0x00 or following == 0xFF or 0xD0 <= following <= 0xD7:
                pos = ff + 1 if following == 0xFF else ff + 2
                continue
            break
        out += data[start:ff]
        marker = following
        pos = ff + 2
        if marker == _EOI:
            out += b"\xff\xd9"
            return pos
        if pos + 2 > length:
            raise MetadataStripError("Truncated JPEG segment")
        (segment_length,) = struct.unpack(">H", data[pos : pos + 2])
        if segment_length < 2 or pos + segment_length > length:
            raise MetadataStripError("Invalid JPEG segment length")
        payload = data[pos + 2 : pos + segment_length]
        if marker == _SOS or _keep_jpeg_segment(marker, payload):
            out += bytes((0xFF, marker)) + data[pos : pos + segment_length]
        pos += segment_length
    raise MetadataStripError("JPEG has no end marker")


# --- PNG --------------------------------------------------------------------

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# Only chunks that describe the image or how to display it are kept; anything
# else (text, EXIF, time, content credentials, vendor chunks) is dropped.
_PNG_KEPT_CHUNKS = {
    b"IHDR",
    b"PLTE",
    b"IDAT",
    b"IEND",
    b"tRNS",  # transparency
    b"gAMA",  # colour: gamma, chromaticities, sRGB, ICC, bit depth, HDR
    b"cHRM",
    b"sRGB",
    b"iCCP",
    b"sBIT",
    b"cICP",
    b"mDCv",
    b"cLLi",
    b"bKGD",  # background colour
    b"pHYs",  # pixel aspect ratio
    b"acTL",  # animation (APNG)
    b"fcTL",
    b"fdAT",
}


def _png_chunk(chunk_type, chunk_data):
    crc = zlib.crc32(chunk_type + chunk_data) & 0xFFFFFFFF
    return (
        struct.pack(">I", len(chunk_data))
        + chunk_type
        + chunk_data
        + struct.pack(">I", crc)
    )


def _strip_png(data, orientation):
    if not data.startswith(_PNG_SIGNATURE):
        raise MetadataStripError("Not a PNG file")

    out = bytearray(_PNG_SIGNATURE)
    pos = len(_PNG_SIGNATURE)
    length = len(data)
    exif_inserted = orientation == 1

    while pos + 8 <= length:
        (chunk_length,) = struct.unpack(">I", data[pos : pos + 4])
        chunk_type = data[pos + 4 : pos + 8]
        end = pos + 12 + chunk_length
        if end > length:
            raise MetadataStripError("Truncated PNG chunk")
        chunk = data[pos:end]
        pos = end

        if not exif_inserted and chunk_type == b"IDAT":
            # eXIf must come before the image data; PNG stores it without the
            # "Exif\0\0" header.
            out += _png_chunk(b"eXIf", _minimal_exif(orientation)[len(EXIF_HEADER) :])
            exif_inserted = True
        if chunk_type in _PNG_KEPT_CHUNKS:
            out += chunk
        if chunk_type == b"IEND":
            return bytes(out)  # anything appended after IEND is dropped

    raise MetadataStripError("PNG has no end chunk")


# --- WebP -------------------------------------------------------------------

_VP8X_FLAG_EXIF = 0x08
_VP8X_FLAG_XMP = 0x04
# Image data, alpha, animation and colour profile; everything else is dropped.
_WEBP_KEPT_CHUNKS = {b"VP8X", b"VP8 ", b"VP8L", b"ALPH", b"ANIM", b"ANMF", b"ICCP"}


def _webp_chunk(fourcc, chunk_data):
    padding = b"\x00" if len(chunk_data) % 2 else b""
    return fourcc + struct.pack("<I", len(chunk_data)) + chunk_data + padding


def _strip_webp(data, orientation):
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise MetadataStripError("Not a WebP file")
    (riff_size,) = struct.unpack("<I", data[4:8])
    end_of_riff = min(len(data), 8 + riff_size)  # data after the RIFF is dropped

    chunks = []
    pos = 12
    while pos + 8 <= end_of_riff:
        fourcc = data[pos : pos + 4]
        (chunk_length,) = struct.unpack("<I", data[pos + 4 : pos + 8])
        chunk_end = pos + 8 + chunk_length
        if chunk_end > end_of_riff:
            raise MetadataStripError("Truncated WebP chunk")
        chunks.append((fourcc, bytearray(data[pos + 8 : chunk_end])))
        pos = chunk_end + (chunk_length % 2)

    if not chunks:
        raise MetadataStripError("WebP has no chunks")

    kept = [
        (fourcc, payload) for fourcc, payload in chunks if fourcc in _WEBP_KEPT_CHUNKS
    ]
    if not kept:
        raise MetadataStripError("WebP has no image data")
    has_vp8x = kept[0][0] == b"VP8X"
    if has_vp8x:
        kept[0][1][0] &= ~(_VP8X_FLAG_EXIF | _VP8X_FLAG_XMP) & 0xFF
        if orientation != 1:
            kept[0][1][0] |= _VP8X_FLAG_EXIF
            kept.append(
                (b"EXIF", bytearray(_minimal_exif(orientation)[len(EXIF_HEADER) :]))
            )
    # A simple (non-VP8X) WebP cannot hold EXIF, so it never had an orientation.

    body = b"WEBP" + b"".join(
        _webp_chunk(fourcc, bytes(payload)) for fourcc, payload in kept
    )
    return b"RIFF" + struct.pack("<I", len(body)) + body

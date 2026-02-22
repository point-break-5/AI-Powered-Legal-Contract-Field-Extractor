"""Shared constants, enums re-exports, and small helper functions."""

SUPPORTED_FORMATS = {"pdf", "docx", "html", "htm", "txt"}


def get_file_extension(filename: str) -> str:
    """Return the lowercase extension of a filename without the leading dot."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def is_supported_format(filename: str) -> bool:
    return get_file_extension(filename) in SUPPORTED_FORMATS

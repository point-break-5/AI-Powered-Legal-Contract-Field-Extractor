"""Document parsing service — converts uploaded files to plain text."""

from __future__ import annotations

import io


def parse_pdf(content: bytes) -> str:
    import fitz  # PyMuPDF

    text_parts = []
    with fitz.open(stream=content, filetype="pdf") as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts)


def parse_docx(content: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(content))
    return "\n".join(para.text for para in doc.paragraphs if para.text.strip())


def parse_html(content: bytes) -> str:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(content, "lxml")
    # Remove script/style noise
    for tag in soup(["script", "style", "meta", "link"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def parse_txt(content: bytes) -> str:
    return content.decode("utf-8", errors="replace")


def parse_document(filename: str, content: bytes) -> str:
    """Dispatch to the correct parser based on file extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        return parse_pdf(content)
    elif ext == "docx":
        return parse_docx(content)
    elif ext in ("html", "htm"):
        return parse_html(content)
    elif ext == "txt":
        return parse_txt(content)
    else:
        raise ValueError(f"Unsupported file format: .{ext}")

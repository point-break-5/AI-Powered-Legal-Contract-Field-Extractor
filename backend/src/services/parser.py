"""Document parsing service — converts uploaded files to plain text."""

from __future__ import annotations

import io

MIN_TEXT_CHARS = 20  # pages with fewer chars than this are treated as image-only


def _ocr_pdf_page(page) -> str:
    """Render a single PyMuPDF page to an image and OCR it with Tesseract."""
    import pytesseract
    from PIL import Image

    # Render at 2x scale for better OCR accuracy
    mat = page.get_transformation_matrix()
    pix = page.get_pixmap(matrix=__import__('fitz').Matrix(2, 2))
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return pytesseract.image_to_string(img, lang="eng").strip()


def parse_pdf(content: bytes) -> str:
    import fitz  # PyMuPDF

    text_pages = []   # text-layer text, one entry per page
    ocr_pages  = []   # OCR text for image-only pages

    with fitz.open(stream=content, filetype="pdf") as doc:
        for page_num, page in enumerate(doc, start=1):
            layer_text = page.get_text().strip()

            if len(layer_text) >= MIN_TEXT_CHARS:
                # Page has a real text layer
                text_pages.append(layer_text)
            else:
                # Image-only (or near-empty) page — run OCR
                text_pages.append("")  # keep page count aligned
                try:
                    ocr_text = _ocr_pdf_page(page)
                    if ocr_text:
                        ocr_pages.append(f"[Page {page_num}] {ocr_text}")
                except Exception as e:
                    ocr_pages.append(f"[Page {page_num} OCR failed: {e}]")

    parts = []

    text_body = "\n".join(t for t in text_pages if t)
    if text_body:
        parts.append("=== Text Layer ===")
        parts.append(text_body)

    if ocr_pages:
        parts.append("=== OCR Text (image pages) ===")
        parts.extend(ocr_pages)

    return "\n".join(parts)


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

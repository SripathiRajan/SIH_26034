"""
Tests for Gazette PDF Discovery and Ingestion Pipeline
"""

import pytest
from pathlib import Path
from app.knowledge.gazette_loader import (
    get_gazette_pdf_dir,
    discover_gazette_pdfs,
    inspect_gazette_pdf,
    validate_all_gazettes,
)


def test_gazette_pdf_dir_exists():
    gazette_dir = get_gazette_pdf_dir()
    assert gazette_dir.exists(), f"Gazette directory does not exist: {gazette_dir}"
    assert gazette_dir.is_dir(), f"Gazette path is not a directory: {gazette_dir}"


def test_discover_gazette_pdfs():
    pdfs = discover_gazette_pdfs()
    assert len(pdfs) == 40, f"Expected exactly 40 gazette PDFs, found {len(pdfs)}"
    for pdf_path in pdfs:
        assert pdf_path.name.lower().endswith(".pdf"), f"{pdf_path.name} is not a PDF"
        assert pdf_path.stat().st_size > 0, f"{pdf_path.name} is empty"


def test_validate_all_gazettes():
    result = validate_all_gazettes()
    assert result["total_pdfs"] == 40
    assert result["all_can_open"] is True, "Not all PDFs could be opened"
    assert result["total_pages"] == 194, f"Expected 194 pages, found {result['total_pages']}"
    assert len(result["files"]) == 40

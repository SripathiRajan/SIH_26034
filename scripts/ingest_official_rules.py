#!/usr/bin/env python3
"""
Official Gazette & Statutory Rules Ingestion Runner
Discovers, validates, and reports on all official Gazette PDFs in backend/data/gazette_pdfs/
"""

import sys
import argparse
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.knowledge.gazette_loader import (
    get_gazette_pdf_dir,
    discover_gazette_pdfs,
    validate_all_gazettes,
)


def main():
    parser = argparse.ArgumentParser(
        description="Ingest and validate official Legal Metrology Gazette notifications."
    )
    parser.add_argument(
        "--dir",
        type=str,
        default=None,
        help="Custom directory path to gazette PDFs (defaults to backend/data/gazette_pdfs/)",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Run discovery and validation checks without building vector index",
    )
    args = parser.parse_args()

    custom_dir = Path(args.dir) if args.dir else None
    resolved_dir = custom_dir if custom_dir else get_gazette_pdf_dir()

    print("==================================================================")
    print("      PRAMAN v4 — Legal Metrology Official Gazette Ingestion       ")
    print("==================================================================")
    print(f"Target Directory : {resolved_dir}")
    print("Discovering Gazette PDF documents...")

    result = validate_all_gazettes(resolved_dir)

    print(f"\nDiscovered       : {result['total_pdfs']} Gazette PDF files")
    print(f"All Opened Valid : {result['all_can_open']}")
    print(f"Total Pages      : {result['total_pages']}")
    print("------------------------------------------------------------------")
    print(f"{'#':<3} | {'Filename':<55} | {'Pages':<5} | {'Status'}")
    print("------------------------------------------------------------------")

    for idx, f in enumerate(result["files"], 1):
        status = "OK" if f["can_open"] else f"ERR: {f['error']}"
        fname = f["filename"]
        if len(fname) > 55:
            fname = fname[:52] + "..."
        print(f"{idx:<3} | {fname:<55} | {f['page_count']:<5} | {status}")

    print("------------------------------------------------------------------")
    print(f"Summary: {result['total_pdfs']} PDFs discovered | {result['total_pages']} total pages | All Readable: {result['all_can_open']}")
    print("==================================================================")


if __name__ == "__main__":
    main()

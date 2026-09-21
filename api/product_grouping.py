"""
Product identity grouping for multi-angle scan sessions.

A scan session assumes all 1-6 views belong to ONE packaged commodity. When
photos of two different products land in a single session (e.g. a gallery
multi-select), naive field merging would silently produce a chimera record —
product A's MRP next to product B's expiry date — so mixed-product batches are
detected here on definitive signals and rejected upstream.

Signals used (in order of strength):
1. Distinct valid GTINs across views (a barcode is a unique product key).
2. Distinct declared net quantities across views (net quantity is constant for
   one package; conflicting values imply two packages).

No soft clustering on brand/manufacturer text: different products from the same
manufacturer are common in the field, and text similarity produces false
splits on sparse front-panel OCR. Only definitive evidence triggers rejection.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from api.gtin_lookup import find_gtin_in_tokens


# quantity + legal metric unit, per Rule 6(1)(c) whitelist (g/kg, ml/l)
_NET_QTY_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(kg|kilogram(?:s)?|g|gm|gram(?:s)?|ml|millilit(?:er|re)(?:s)?|l|ltr|litre(?:s)?|liter(?:s)?)\b",
    re.IGNORECASE,
)

# Normalize every spelling to (dimension, grams-or-millilitres per unit)
_UNIT_NORM = {
    "kg": ("mass", 1000.0), "kilogram": ("mass", 1000.0), "kilograms": ("mass", 1000.0),
    "g": ("mass", 1.0), "gm": ("mass", 1.0), "gram": ("mass", 1.0), "grams": ("mass", 1.0),
    "ml": ("volume", 1.0), "milliliter": ("volume", 1.0), "millilitre": ("volume", 1.0),
    "milliliters": ("volume", 1.0), "millilitres": ("volume", 1.0),
    "l": ("volume", 1000.0), "ltr": ("volume", 1000.0), "litre": ("volume", 1000.0),
    "litres": ("volume", 1000.0), "liter": ("volume", 1000.0), "liters": ("volume", 1000.0),
}

# Same-product net-quantity readings are expected to be identical; tolerate a
# small relative gap for OCR digit noise, but any unit/dimension mismatch or a
# larger divergence means two different packages.
_SAME_PRODUCT_QTY_REL_TOLERANCE = 0.05


def _view_tokens(report: Dict[str, Any]) -> List[str]:
    tokens = list(report.get("raw_ocr_tokens") or [])
    full_text = report.get("full_text") or ""
    if full_text:
        tokens.extend(full_text.split("\n"))
    return tokens


def extract_view_gtin(report: Dict[str, Any]) -> Optional[str]:
    """Returns the valid GTIN barcode visible in this single view, if any."""
    return find_gtin_in_tokens(_view_tokens(report))


def parse_net_quantity(raw: Any) -> Optional[Tuple[str, float]]:
    """Parses '500 g' / '1.5 L' into a comparable (dimension, base-unit value)."""
    if raw is None:
        return None
    match = _NET_QTY_RE.search(str(raw))
    if not match:
        return None
    unit = match.group(2).lower()
    if unit not in _UNIT_NORM:
        return None
    dimension, factor = _UNIT_NORM[unit]
    value = float(match.group(1)) * factor
    if value <= 0:
        return None
    return (dimension, value)


def _qty_evidence(values: Dict[Tuple[str, float], List[int]]) -> List[Dict[str, Any]]:
    return [
        {
            "signal": "net_quantity",
            "value": f"{qty:g} {'g' if dim == 'mass' else 'ml'}",
            "view_numbers": sorted(idx + 1 for idx in idxs),
        }
        for (dim, qty), idxs in values.items()
    ]


def detect_mixed_products(view_reports: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Inspects per-view pipeline reports and returns a structured conflict
    description when the batch definitively contains more than one product,
    or None when the views are consistent with a single package.
    """
    if len(view_reports) < 2:
        return None

    gtin_views: Dict[str, List[int]] = {}
    qty_views: Dict[Tuple[str, float], List[int]] = {}

    for idx, report in enumerate(view_reports):
        gtin = extract_view_gtin(report or {})
        if gtin:
            gtin_views.setdefault(gtin, []).append(idx)

        qty_field = ((report or {}).get("fields") or {}).get("net_quantity") or {}
        if qty_field.get("found"):
            parsed = parse_net_quantity(qty_field.get("value") or qty_field.get("captured"))
            if parsed:
                qty_views.setdefault(parsed, []).append(idx)

    # Signal 1: two or more distinct valid GTINs — definitive.
    if len(gtin_views) >= 2:
        return {
            "rule": "distinct_gtin",
            "product_count": len(gtin_views),
            "evidence": [
                {"signal": "gtin", "value": gtin, "view_numbers": sorted(i + 1 for i in idxs)}
                for gtin, idxs in gtin_views.items()
            ],
        }

    # Signal 2: conflicting declared net quantities across views.
    if len(qty_views) >= 2:
        dims = {dim for dim, _ in qty_views}
        quantities = sorted(qty for _, qty in qty_views)
        mixed = (
            len(dims) > 1
            or (quantities[-1] - quantities[0]) / quantities[0] > _SAME_PRODUCT_QTY_REL_TOLERANCE
        )
        if mixed:
            return {
                "rule": "conflicting_net_quantity",
                "product_count": 2,
                "evidence": _qty_evidence(qty_views),
            }

    return None

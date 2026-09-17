"""
PDF Report Generator Service
Generates a PRAMAN compliance inspection audit report for a ScanRecordDB row.
The report is a system-generated draft intended for review by an authorized
Legal Metrology officer — it is not a government-issued document.
"""

import os
import json
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

_IST = timezone(timedelta(hours=5, minutes=30))


def generate_audit_pdf(scan_record) -> str:
    """
    Generates a PDF inspection report for a ScanRecordDB row.
    Returns the absolute path to the generated PDF file.
    """
    from core.config import UPLOAD_DIR

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    pdf_name = f"praman_audit_{scan_record.id}.pdf"
    pdf_path = os.path.join(UPLOAD_DIR, pdf_name)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # Header — neutral system branding, no government impersonation
    story.append(Paragraph("<b>PRAMAN — Compliance Inspection Audit Report</b>", styles["Title"]))
    story.append(Paragraph(
        "System-generated draft for officer review — Legal Metrology (Packaged Commodities) Rules, 2011",
        styles["Normal"],
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.black))
    story.append(Spacer(1, 0.3 * cm))

    # Scan metadata table
    scanned_at = scan_record.scanned_at
    if scanned_at.tzinfo is None:
        scanned_at = scanned_at.replace(tzinfo=timezone.utc)
    scanned_at = scanned_at.astimezone(_IST)

    meta_data = [
        ["Scan ID", scan_record.id],
        ["Product Name", scan_record.product_name],
        ["Brand", scan_record.brand],
        ["Net Weight", scan_record.net_weight or "—"],
        ["Status", scan_record.status.upper()],
        ["Compliance", f"{scan_record.compliance_score or 0:.1f}%"],
        ["Scan Time", scanned_at.strftime("%d-%b-%Y %H:%M IST")],
        ["Processing", f"{scan_record.processing_time or 0:.2f}s"],
    ]
    t = Table(meta_data, colWidths=[5 * cm, 12 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.whitesmoke]),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    # Field compliance table
    story.append(Paragraph("<b>Field Compliance Details</b>", styles["Heading2"]))
    fields = json.loads(scan_record.fields_json) if isinstance(scan_record.fields_json, str) else scan_record.fields_json

    field_rows = [["Field", "Status", "Extracted Value", "Rule Reference", "Violation Reason"]]
    for f in (fields or []):
        status_str = f.get("status", "").upper()
        field_rows.append([
            f.get("label", ""),
            status_str,
            (f.get("extractedValue") or "—")[:40],
            f.get("ruleRef", "")[:30],
            (f.get("violationReason") or "—")[:50],
        ])

    ft = Table(field_rows, colWidths=[4 * cm, 2 * cm, 4 * cm, 3.5 * cm, 3.5 * cm])
    ft.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1565C0")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, colors.whitesmoke]),
    ]))
    story.append(ft)
    story.append(Spacer(1, 0.5 * cm))

    # Footer — honest provenance statement
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Paragraph(
        f"<font size=8>System-generated draft report by PRAMAN v4.0 — {datetime.now(_IST).strftime('%d-%b-%Y %H:%M IST')} | "
        f"AI-extracted declarations require verification by an authorized Legal Metrology officer before any enforcement action.</font>",
        styles["Normal"]
    ))

    doc.build(story)
    return pdf_path

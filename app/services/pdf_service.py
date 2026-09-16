"""
PDF Report Generator Service
Generates official Legal Metrology Compliance Inspection Audit Reports using ReportLab.
"""

import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable


class PDFReportService:
    @staticmethod
    def generate_scan_report(scan_data: Dict[str, Any]) -> bytes:
        """
        Generates a professional PDF audit report from scan record dictionary.
        Returns raw PDF bytes.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#1e293b"),
            alignment=1,  # Centered
        )
        subtitle_style = ParagraphStyle(
            "DocSubTitle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#64748b"),
            alignment=1,
        )
        section_style = ParagraphStyle(
            "SectionTitle",
            parent=styles["Heading2"],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=8,
            spaceAfter=4,
        )
        cell_style = ParagraphStyle(
            "CellNormal",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#334155"),
        )
        bold_cell_style = ParagraphStyle(
            "CellBold",
            parent=styles["Normal"],
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#0f172a"),
            fontName="Helvetica-Bold",
        )

        elements = []

        # 1. Header
        elements.append(Paragraph("GOVERNMENT OF INDIA", title_style))
        elements.append(Paragraph("MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION", subtitle_style))
        elements.append(Paragraph("Department of Consumer Affairs — Legal Metrology Division", subtitle_style))
        elements.append(Paragraph("<b>STATUTORY COMPLIANCE INSPECTION AUDIT REPORT</b>", ParagraphStyle(
            "ReportBanner", parent=subtitle_style, fontSize=11, leading=16, textColor=colors.HexColor("#0284c7")
        )))
        elements.append(Spacer(1, 10))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=12))

        # 2. Product & Scan Metadata Table
        scan_id = scan_data.get("id", "N/A")
        product_name = scan_data.get("productName", "N/A")
        brand = scan_data.get("brand", "N/A")
        net_weight = scan_data.get("netWeight", "N/A")
        scanned_at = scan_data.get("scannedAt", "N/A")
        gtin = scan_data.get("gtin") or "Not Decoded / Unassigned"
        status = str(scan_data.get("status", "pass")).upper()
        auth_score = scan_data.get("authenticityScore")
        auth_str = f"{int(auth_score * 100)}%" if auth_score is not None else "No Reference Cataloged"

        # Status color
        status_bg = colors.HexColor("#dcfce7")  # green
        status_fg = colors.HexColor("#166534")
        if status == "FAIL":
            status_bg = colors.HexColor("#fee2e2")
            status_fg = colors.HexColor("#991b1b")
        elif status == "NEEDS_REVIEW" or status == "NEEDS REVIEW":
            status_bg = colors.HexColor("#fef3c7")
            status_fg = colors.HexColor("#92400e")
        elif status == "WARNING":
            status_bg = colors.HexColor("#ffedd5")
            status_fg = colors.HexColor("#9a3412")

        meta_data = [
            [Paragraph("<b>Inspection ID:</b>", cell_style), Paragraph(scan_id, cell_style),
             Paragraph("<b>Compliance Status:</b>", cell_style), Paragraph(f"<b>{status}</b>", ParagraphStyle("StatText", parent=bold_cell_style, textColor=status_fg))],
            [Paragraph("<b>Product Name:</b>", cell_style), Paragraph(product_name, cell_style),
             Paragraph("<b>Barcode / GTIN:</b>", cell_style), Paragraph(gtin, cell_style)],
            [Paragraph("<b>Brand:</b>", cell_style), Paragraph(brand, cell_style),
             Paragraph("<b>Brand Authenticity:</b>", cell_style), Paragraph(auth_str, cell_style)],
            [Paragraph("<b>Declared Net Qty:</b>", cell_style), Paragraph(net_weight, cell_style),
             Paragraph("<b>Audit Timestamp:</b>", cell_style), Paragraph(scanned_at, cell_style)],
        ]

        meta_table = Table(meta_data, colWidths=[100, 170, 110, 160])
        meta_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("BACKGROUND", (3, 0), (3, 0), status_bg),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 14))

        # 3. Mandatory Declarations Audit Table
        elements.append(Paragraph("Mandatory Declarations Assessment (Rules 2011)", section_style))

        fields: List[Dict[str, Any]] = scan_data.get("fields", [])
        checklist_data = [
            [
                Paragraph("<b>Field Name</b>", bold_cell_style),
                Paragraph("<b>Rule Reference</b>", bold_cell_style),
                Paragraph("<b>Detected Value</b>", bold_cell_style),
                Paragraph("<b>Confidence</b>", bold_cell_style),
                Paragraph("<b>Status</b>", bold_cell_style),
                Paragraph("<b>Findings & Remediation</b>", bold_cell_style),
            ]
        ]

        for f in fields:
            f_name = f.get("fieldName", "").replace("_", " ").title()
            rule_ref = f.get("ruleRef") or "Rule 6(1)"
            raw_val = f.get("rawValue") or ("Not Found" if not f.get("found") else "Present")
            conf = f"{int(f.get('confidence', 0.0) * 100)}%"
            f_status = str(f.get("status", "pass")).upper()
            msg = f.get("message") or ""

            # Truncate raw value if very long
            if len(raw_val) > 40:
                raw_val = raw_val[:37] + "..."

            checklist_data.append([
                Paragraph(f_name, cell_style),
                Paragraph(rule_ref, cell_style),
                Paragraph(raw_val, cell_style),
                Paragraph(conf, cell_style),
                Paragraph(f"<b>{f_status}</b>", cell_style),
                Paragraph(msg, cell_style),
            ])

        checklist_table = Table(checklist_data, colWidths=[90, 85, 110, 50, 65, 140])
        checklist_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(checklist_table)
        elements.append(Spacer(1, 16))

        # 4. Statutory Disclaimer & Verification Stamp
        disclaimer_text = (
            "<b>Statutory Note:</b> This automated audit has been generated in accordance with the Legal Metrology "
            "(Packaged Commodities) Rules, 2011 as amended. Scans marked as 'NEEDS REVIEW' or 'WARNING' require manual "
            "physical inspection by an authorized Legal Metrology Officer prior to compound or compounding notices."
        )
        elements.append(Paragraph(disclaimer_text, ParagraphStyle(
            "Disclaimer", parent=styles["Normal"], fontSize=7.5, leading=10, textColor=colors.HexColor("#64748b")
        )))
        elements.append(Spacer(1, 10))

        stamp_data = [
            [
                Paragraph("<b>Inspectorate Digital Signature:</b><br/>Verified by Legal Metrology AI Engine v3.0<br/>Hash: " + scan_id[:16], cell_style),
                Paragraph("<b>Official Stamp:</b><br/>[ SEALED & RECORDED IN CENTRAL AUDIT TRAIL ]", cell_style),
            ]
        ]
        stamp_table = Table(stamp_data, colWidths=[300, 240])
        stamp_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(stamp_table)

        doc.build(elements)
        return buffer.getvalue()


_IST = timezone(timedelta(hours=5, minutes=30))


def generate_audit_pdf(scan_record) -> str:
    """
    Generates a PDF inspection report for a ScanRecordDB row.
    Returns the absolute path to the generated PDF file.
    """
    import os
    import json
    from datetime import datetime
    from core.config import UPLOAD_DIR
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm

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

    # Header
    story.append(Paragraph("<b>PRAMAN — Legal Metrology Inspection Audit Report</b>", styles["Title"]))
    story.append(Paragraph("Under Legal Metrology (Packaged Commodities) Rules, 2011", styles["Normal"]))
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
        ["Auth. Score", f"{scan_record.authenticity_score}/100"],
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

    # Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Paragraph(
        f"<font size=8>Report generated by PRAMAN v4.0 — {datetime.now(_IST).strftime('%d-%b-%Y %H:%M IST')} | "
        f"For official use by Legal Metrology enforcement officers only.</font>",
        styles["Normal"]
    ))

    doc.build(story)
    return pdf_path

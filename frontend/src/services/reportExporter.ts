import { Platform } from 'react-native';
import { ScanRecord } from '../types';

function getStatusLabel(status: string): string {
  if (status === 'pass') return 'COMPLIANT';
  if (status === 'fail') return 'NON-COMPLIANT';
  return 'REVIEW NEEDED';
}

function getStatusColor(status: string): string {
  if (status === 'pass') return '#047857';
  if (status === 'fail') return '#B91C1C';
  return '#B45309';
}

function getStatusBg(status: string): string {
  if (status === 'pass') return '#ECFDF5';
  if (status === 'fail') return '#FEF2F2';
  return '#FFFBEB';
}

function buildHtmlReport(scan: ScanRecord, officerName?: string): string {
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const inspectionDate = scan.scannedAt
    ? new Date(scan.scannedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : now;

  const violationCount = scan.fields?.filter((f) => f.status === 'fail').length ?? 0;
  const warningCount = scan.fields?.filter((f) => f.status === 'warning').length ?? 0;
  const passCount = scan.fields?.filter((f) => f.status === 'pass').length ?? 0;

  const fieldsRows = (scan.fields || [])
    .map((field) => {
      const statusColor = getStatusColor(field.status);
      const statusBg = getStatusBg(field.status);
      const label = field.label || field.fieldName || 'Field';
      const extracted = field.extractedValue || field.extractedText || 'N/A';
      const rule = field.ruleRef || field.ruleCitation || '';
      const violation = field.violationReason || field.detail || field.ruleExplanation || '';
      const statusLabel = field.status === 'pass' ? '✔ PASS' : field.status === 'fail' ? '✘ FAIL' : '⚠ REVIEW';
      return `
        <tr>
          <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0;">
            <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${statusBg};color:${statusColor};">${statusLabel}</span>
          </td>
          <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; font-weight:600; color:#0F172A;">${label}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; color:#475569; font-size:13px;">${extracted}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; color:#4F46E5; font-size:12px; font-weight:600;">${rule}</td>
          <td style="padding:10px 12px; border-bottom:1px solid #E2E8F0; color:${field.status === 'fail' ? '#B91C1C' : '#475569'}; font-size:12px;">${field.status !== 'pass' && violation ? violation : '—'}</td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PRAMAN Compliance Report — ${scan.id}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #FFFFFF; color: #0F172A; font-size: 14px; }
    .page { max-width: 900px; margin: 0 auto; padding: 40px 32px; }
    /* Header */
    .gov-banner { background: #1E3A5F; color: #BAD4EF; text-align: center; font-size: 11px; padding: 8px; margin: -40px -32px 32px; letter-spacing: 0.3px; }
    .header-grid { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #E2E8F0; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo { width: 56px; height: 56px; background: #4F46E5; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .brand-logo-text { color: white; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
    .brand-name { font-size: 26px; font-weight: 800; color: #1E1B4B; letter-spacing: 2px; }
    .brand-subtitle { font-size: 12px; color: #6B7280; }
    .report-meta { text-align: right; }
    .report-id { font-size: 13px; font-weight: 700; color: #4F46E5; }
    .report-ts { font-size: 11px; color: #94A3B8; margin-top: 4px; }
    /* Status Card */
    .status-banner { border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .status-label { font-size: 22px; font-weight: 800; }
    .status-sub { font-size: 13px; margin-top: 4px; }
    .score-circle { text-align: center; }
    .score-value { font-size: 32px; font-weight: 800; }
    .score-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    /* Info Grid */
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; }
    .info-card-label { font-size: 10px; font-weight: 700; color: #94A3B8; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 4px; }
    .info-card-value { font-size: 15px; font-weight: 700; color: #0F172A; }
    /* Violation Summary Row */
    .summary-row { display: flex; gap: 12px; margin-bottom: 24px; }
    .summary-pill { flex: 1; text-align: center; padding: 12px; border-radius: 10px; }
    /* Table */
    .section-title { font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    thead tr { background: #F8FAFC; }
    th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; color: #64748B; letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 2px solid #E2E8F0; }
    /* Legal Disclaimer */
    .disclaimer { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 14px; margin-top: 12px; }
    .disclaimer-title { font-size: 12px; font-weight: 700; color: #B45309; margin-bottom: 4px; }
    .disclaimer-text { font-size: 11px; color: #78350F; line-height: 18px; }
    /* Footer */
    .footer { text-align: center; margin-top: 36px; padding-top: 20px; border-top: 1px solid #E2E8F0; }
    .footer-text { font-size: 11px; color: #94A3B8; }
  </style>
</head>
<body>
<div class="page">
  <div class="gov-banner">Government of India — Ministry of Consumer Affairs, Food &amp; Public Distribution — Legal Metrology Division</div>

  <!-- Header -->
  <div class="header-grid">
    <div class="brand">
      <div class="brand-logo"><span class="brand-logo-text">⚖</span></div>
      <div>
        <div class="brand-name">PRAMAN</div>
        <div class="brand-subtitle">Legal Metrology Compliance Verification System</div>
      </div>
    </div>
    <div class="report-meta">
      <div class="report-id">REPORT ID: ${scan.id?.toUpperCase()}</div>
      <div class="report-ts">Generated: ${now} IST</div>
      <div class="report-ts">Inspection: ${inspectionDate} IST</div>
      ${officerName ? `<div class="report-ts" style="margin-top:4px;color:#4F46E5;">Officer: ${officerName}</div>` : ''}
    </div>
  </div>

  <!-- Compliance Status Banner -->
  <div class="status-banner" style="background:${getStatusBg(scan.status)};border:2px solid ${scan.status === 'pass' ? '#A7F3D0' : scan.status === 'fail' ? '#FECACA' : '#FDE68A'};">
    <div>
      <div class="status-label" style="color:${getStatusColor(scan.status)}">${getStatusLabel(scan.status)}</div>
      <div class="status-sub" style="color:${getStatusColor(scan.status)};">Legal Metrology (Packaged Commodities) Rules, 2011 — ${scan.fields?.length ?? 0} declarations audited</div>
    </div>
    <div class="score-circle" style="color:${getStatusColor(scan.status)};">
      <div class="score-value">${scan.authenticityScore ?? 0}%</div>
      <div class="score-label">Authenticity Score</div>
    </div>
  </div>

  <!-- Product Info -->
  <div class="info-grid">
    <div class="info-card">
      <div class="info-card-label">Product Name</div>
      <div class="info-card-value">${scan.productName}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">Brand</div>
      <div class="info-card-value">${scan.brand}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">Net Quantity</div>
      <div class="info-card-value">${scan.netWeight}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">Category</div>
      <div class="info-card-value">${scan.category ?? 'General'}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">OCR Engines Used</div>
      <div class="info-card-value" style="font-size:12px;">${(scan.ocrEnginesUsed ?? ['PaddleOCR']).join(', ')}</div>
    </div>
    <div class="info-card">
      <div class="info-card-label">Processing Time</div>
      <div class="info-card-value">${scan.processingTime ?? 1.2}s</div>
    </div>
  </div>

  <!-- Violation Summary -->
  <div class="summary-row">
    <div class="summary-pill" style="background:#ECFDF5;border:1px solid #A7F3D0;color:#047857;">
      <div style="font-size:24px;font-weight:800;">${passCount}</div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Compliant</div>
    </div>
    <div class="summary-pill" style="background:#FFFBEB;border:1px solid #FDE68A;color:#B45309;">
      <div style="font-size:24px;font-weight:800;">${warningCount}</div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Review Needed</div>
    </div>
    <div class="summary-pill" style="background:#FEF2F2;border:1px solid #FECACA;color:#B91C1C;">
      <div style="font-size:24px;font-weight:800;">${violationCount}</div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Violations</div>
    </div>
  </div>

  <!-- Declaration Audit Table -->
  <div class="section-title">Mandatory Declarations Audit — Rule 6, Legal Metrology (PC) Rules, 2011</div>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Declaration Field</th>
        <th>Extracted Text</th>
        <th>Rule Reference</th>
        <th>Violation Detail</th>
      </tr>
    </thead>
    <tbody>${fieldsRows}</tbody>
  </table>

  <!-- Legal Disclaimer -->
  <div class="disclaimer">
    <div class="disclaimer-title">⚠ Statutory Disclaimer</div>
    <div class="disclaimer-text">
      This report is generated by PRAMAN — an AI-assisted compliance screening tool. Font size measurements are
      approximate screening metrics computed from image resolution and are not statutory millimetre measurements
      under Schedule II of the Legal Metrology (Packaged Commodities) Rules, 2011. This report does not
      constitute a final enforcement order. Enforcement decisions must be confirmed by an authorised Legal
      Metrology Officer under the Legal Metrology Act, 2009. Official rules source: Department of Consumer
      Affairs, Ministry of Consumer Affairs, Food &amp; Public Distribution, Government of India.
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-text">PRAMAN · Smart India Hackathon 2024 — PS ID 26034 · Ministry of Consumer Affairs, Food & Public Distribution</div>
    <div class="footer-text" style="margin-top:4px;">This is a computer-generated report. No signature required for screening purposes.</div>
  </div>
</div>
</body>
</html>
  `;
}

export async function exportReportAsPdf(scan: ScanRecord, officerName?: string): Promise<void> {
  if (Platform.OS === 'web') {
    const html = buildHtmlReport(scan, officerName);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  } else {
    // Native fallback — just log (expo-print can be added later)
    console.log('PDF export on native: install expo-print + expo-sharing');
  }
}

export function getReportHtml(scan: ScanRecord, officerName?: string): string {
  return buildHtmlReport(scan, officerName);
}

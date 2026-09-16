Background:

Packaged commodities are widely sold through retail stores, supermarkets and e-commerce platforms across India. Under the Legal Metrology Act, 2009 and the Legal Metrology(Packaged Commodities) Rules, 2011, every packaged commodity is required to bear mandatory declarations such as name and address of manufacturer/packer/importer, net quantity, Maximum Retail Price (MRP), month and year of manufacture/packing/import,consumer care details and other prescribed declarations in a specified format and manner.These declarations are important for ensuring transparency, fair trade practices and consumer protection. However, due to the large volume and variety of packaged products available in the market, manual inspection and compliance checking by enforcement agencies becomes time-consuming and resource intensive. Non-compliance such as missing declarations, incorrect font sizes, improper MRP declarations and other such practices are frequently observed.There is scope to develop a compliance checking system capable of scanning product labels,package images and product listings to identify violations under the Legal Metrology(Packaged Commodities) Rules, 2011. Accordingly, a software system capable of automatically detecting, extracting and validating mandatory declarations and identifying noncompliances in packaged commodities through image and label analysis can be developed.

Description:

Develop a software application capable of scanning packaged commodity labels, product images and product information to automatically assess compliance with the Legal Metrology(Packaged Commodities) Rules, 2011.

The system should be capable of:

• Scanning and analyzing images of packaged commodities.
• Detecting mandatory declarations prescribed under Legal Metrology rules.
• Checking correctness, completeness and placement of declarations.
• Identifying missing or non-compliant declarations.
• Checking readability and font size requirements.
• Generating compliance reports and violation summaries.
• Maintaining a repository of scanned products and compliance history.
• Providing dashboards for enforcement officials.

Expected Solution:

The proposed solution should include:

• User-friendly web and/or mobile-based software application.
• Automated extraction and validation of mandatory declarations.
• Rule-based compliance checking for Legal Metrology (Packaged Commodities)

Rules, 2011.

• Generation of digital compliance reports in PDF and editable formats.
• Dashboard for monitoring inspections, violations and product compliance details.
• Search and retrieval facility for previously scanned products and reports.
• Technical documentation describing software architecture and deployment framework.

Key Functional Requirements:

• Image upload and product scanning functionality.
• Extraction of declarations from labels and packaging and detection of mandatory declarations
• Font size and readability analysis.
• Detection of missing, misleading or non-standard declarations.
• Generation of compliance/non-compliance reports.
• Attachment of photographs and supporting evidence.
• Repository of scanned products and inspection history.
• Role-based user access and secure authentication.
• Dashboard for monitoring compliance status and enforcement activities.
• Export of reports to PDF and editable formats.# PRAMAN: Legal Metrology Statutory Compliance Inspection Platform

**Problem Statement 26034**: *Software System to check compliance of Packaged Commodities under Legal Metrology (Packaged Commodities) Rules, 2011.*

LegalMetrix is a standalone statutory compliance inspection platform engineered for Legal Metrology Officers, Department of Consumer Affairs (DoCA) inspectors, and brand quality assurance teams. It provides client-side declaration verification, rule-by-rule statutory validation, visual evidence tracking, analytics dashboard, and multi-format audit export generation.

---

## 🏛️ Application Architecture

* **Frontend Framework**: Expo (React Native + TypeScript) with React Native Web support.
* **UI Design System**: Quiet, enterprise-neutral chrome (`#4F46E5` accent, dark/light theme, hairline borders, responsive desktop grid).
* **Client-Side Engine**: In-memory inspection simulator, statutory rule database, and interactive regulatory chatbot.

---

## 📱 Modules & Screen Structure

| Module | File Location | Description |
|---|---|---|
| **Inspect** | `src/screens/HomeScreen.tsx` | Packaging label drop zone, live photo capture, 360° product video scan, and sample demo execution. |
| **Capture** | `src/screens/CaptureScreen.tsx` | Live camera view with bounding box overlays and PDP framing. |
| **Processing** | `src/screens/ProcessingScreen.tsx` | Real-time OCR text stream and 5-stage rule verification pipeline. |
| **Result** | `src/screens/ResultScreen.tsx` | Overall compliance status badge, field evidence cards, and rule citations. |
| **Audits** | `src/screens/HistoryScreen.tsx` | Searchable, filterable audit log database with PDF/Excel report exports. |
| **Ask** | `src/screens/ChatScreen.tsx` | Interactive RAG legal assistant grounded on DoCA Packaged Commodities Rules 2011. |
| **Analytics** | `src/screens/DashboardScreen.tsx` | KPI metrics, regional compliance breakdown, violation trends, and brand flag rates. |
| **Rules DB** | `src/screens/RulesScreen.tsx` | Direct legal citations, font height specs, and mandatory declaration requirements. |

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the web application
npx expo start --web
```

* **Desktop Application URL**: `http://localhost:8081`

---

## 🔒 Statutory Disclaimer Notice

> *"Font size and readability metrics provided by this system are automated screening estimates based on image resolution and relative text height. They do not constitute statutory physical measurements in millimetres under the Legal Metrology Act, 2009. Final legal determination remains with the authorised Legal Metrology Officer."*

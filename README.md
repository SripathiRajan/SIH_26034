# PRAMAN v4 — Legal Metrology AI Inspection System

> **Statutory Compliance & Automated Inspection Platform** under the **Legal Metrology (Packaged Commodities) Rules, 2011** and **FSSAI Regulations**.

---

## 🏛️ System Architecture Overview

PRAMAN v4 integrates multi-engine Computer Vision, Optical Character Recognition (OCR), Statutory Compliance Rule Validation, and Field Audit Automation into a single, production-grade monorepo:

- **AI Vision & OCR Engine**:
  - **PaddleOCR** (Primary high-speed detection and recognition via MKL-DNN)
  - **EasyOCR** (Secondary INT8 quantized engine triggered adaptively on low confidence)
  - **Surya OCR** (Tier 2 multilingual layout and line text extraction)
  - **Florence-2 VLM** (Vision-Language Model fallback for complex / curved package declarations)
- **Legal Metrology Rule Engine**:
  - Validates statutory declarations: MRP (incl. of taxes), Net Quantity, Consumer Care, Date of Packaging/Import, Manufacturer/Packer Address, Country of Origin, and FSSAI license numbers.
  - Generates instant pass/fail/warning compliance verdicts with statutory rule citations and penalty notices.
- **Enterprise & Field Inspector Backend**:
  - FastAPI with OpenAPI / Swagger documentation
  - JWT Authentication & Role-Based Access Control (Inspectors / Auditors / Admins)
  - SQLite / PostgreSQL persistence via SQLAlchemy ORM
  - Dynamic PDF Audit Report generation via ReportLab
  - Regulatory RAG Chatbot for instantaneous legal advisory

---

## 📂 Project Layout

```
Backend/
├── app/
│   ├── main.py                       # FastAPI application entrypoint & middleware
│   ├── config.py                     # Unified Pydantic application settings
│   ├── routers/
│   │   ├── auth.py                   # /api/auth (Login, Register, User Profile)
│   │   ├── scans.py                  # /api/scan, /api/scans (History, Audit PDF, Stats)
│   │   ├── product.py                # /api/product/lookup & master catalog management
│   │   ├── rules.py                  # /api/rules (Statutory rule catalog)
│   │   ├── chat.py                   # /api/chat (Statutory metrology chatbot)
│   │   ├── sync.py                   # /api/sync (Offline queue sync for field inspectors)
│   │   └── legacy.py                 # /health, /analyze-face, /analyze-burst
│   ├── ocr/
│   │   ├── engine_base.py            # BaseOCREngine, OCRResult, TextPolygon protocols
│   │   ├── paddle_engine.py          # PaddleOCR engine implementation
│   │   ├── easyocr_engine.py         # EasyOCR engine implementation
│   │   └── ensemble.py               # Adaptive 2-tier spatial IoU ensemble
│   ├── extraction/
│   │   ├── declaration_parser.py     # Regex and contextual field extractors
│   │   └── reading_order.py          # Spatial reading-order resolver
│   ├── validation/
│   │   ├── rule_engine.py            # Legal Metrology statutory rule evaluator
│   │   ├── field_validators.py       # Individual field validators (MRP, Net Qty, etc.)
│   │   ├── rules.json                # Summary rule definitions
│   │   └── rules_db.json             # Comprehensive 31-rule statutory database
│   ├── services/
│   │   ├── scan_service.py           # Unified scan orchestration service
│   │   ├── pdf_service.py            # Official audit report generator (ReportLab)
│   │   └── chat_service.py           # Metrology legal FAQ advisor service
│   ├── chatbot/
│   │   └── rag_assistant.py          # Regulatory assistant
│   ├── knowledge/
│   │   └── vector_store.py           # Compliance vector retrieval store
│   └── vision/
│       ├── image_pipeline.py         # Preprocessing (deskew, glare filter, CLAHE)
│       └── authenticity.py           # Authenticity score calculation
├── core/
│   ├── config.py                     # Environment-driven system and cache config
│   ├── database.py                   # Database connection engine & session maker
│   ├── db_models.py                  # SQLAlchemy ORM models (ScanRecordDB, UserDB, etc.)
│   ├── auth.py                       # Passlib bcrypt hashing & JWT token generator
│   ├── image_utils.py                # Image conversion utilities
│   ├── models.py                     # Pydantic schemas
│   └── logger.py                     # Structured console and file logger
├── ocr/                              # Core OCR engine abstractions (Paddle, EasyOCR, Surya, VLM)
├── pipeline/                         # Cascaded compliance pipeline
├── api/                              # GTIN lookup, burst handlers, compliance mergers
├── frontend/                         # React Native (Expo) Mobile Inspector App
├── tests/                            # Pytest automated test suites
├── scripts/
│   └── generate_cert.py              # TLS Certificate generator for HTTPS dev
├── .env.example                      # Template for environment configuration
├── .gitignore                        # Complete production ignore specifications
├── requirements.txt                  # Pinned Python package dependencies
├── start.ps1                         # One-click dual server launcher (Backend + Frontend)
└── README.md                         # Project documentation
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Python 3.11+** installed (`python --version`)
- **Node.js 18+** & npm installed (`npm --version`)
- **PowerShell** (Windows) or **Bash** (Linux/macOS)

### 2. Environment Setup
Create your local `.env` configuration:
```powershell
cp .env.example .env
```

Install Python dependencies:
```powershell
py -3.11 -m pip install -r requirements.txt
```

Install Frontend dependencies:
```powershell
cd frontend
npm install
cd ..
```

### 3. Launching the System

#### Option A: One-Click Launcher (PowerShell)
```powershell
.\start.ps1
```
This automatically boots:
- Backend server on `http://localhost:8000` (with interactive docs at `/docs`)
- Expo Web / Metro bundler on `http://localhost:8081`

#### Option B: Manual Startup
Terminal 1 (Backend):
```powershell
py -3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 (Frontend):
```powershell
cd frontend
npx expo start --web
```

---

## 🧪 Testing & Verification

Run the comprehensive pytest suite:
```powershell
py -3.11 -m pytest tests/ -v
```

**Test Coverage**:
- `tests/test_api_endpoints.py`: All 8 REST endpoints (Health, Auth, Products, Analyze, Scans, Audit PDF, Stats, Sync)
- `tests/test_ocr_ensemble.py`: Spatial IoU clustering, mock fallback handling, confidence thresholds
- `tests/test_pipeline_extraction_rules.py`: Image quality checks, reading order resolution, declaration parsing
- `tests/test_rules.py`: Statutory rule passes and violations

---

## 📑 Core REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health check and active OCR engine status |
| `POST` | `/api/auth/register` | Register new inspector / field officer |
| `POST` | `/api/auth/login` | Login and acquire JWT bearer access token |
| `GET` | `/api/auth/me` | Current authenticated inspector profile |
| `POST` | `/api/scan` | Analyze package image (runs multi-engine OCR + rule validation) |
| `GET` | `/api/scans` | Paginated scan inspection history |
| `GET` | `/api/scans/{id}` | Scan record details and field violations breakdown |
| `GET` | `/api/scans/{id}/pdf` | Download official Legal Metrology Audit PDF Report |
| `GET` | `/api/dashboard/stats`| Inspection compliance rate & analytics summary |
| `POST` | `/api/sync` | Bulk synchronization for offline field scans |
| `GET` | `/api/rules` | Complete statutory Legal Metrology rules catalog |
| `POST` | `/api/chat` | AI regulatory legal advice query |

---

## 🔒 Security & Deployment Notes

- **Secrets**: Set `PRAMAN_SECRET_KEY` in production. The server prevents startup in `ENVIRONMENT=production` if default secret keys are used.
- **Model Caches**: Pre-trained weights for PaddleOCR, EasyOCR, and Surya/VLM are automatically cached under `.cache/` (or designated system cache paths) to ensure offline resilience.
- **Database**: Defaults to local SQLite (`praman.db`). In enterprise staging/production, configure `DATABASE_URL=postgresql://user:password@host:5432/pramandb`.

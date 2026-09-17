# PRAMAN v4 — Legal Metrology AI Inspection System

> **Automated Inspection Platform** under the **Legal Metrology (Packaged Commodities) Rules, 2011** and **FSSAI (Labelling & Display) Regulations, 2020**.

---

## 🏛️ System Architecture

PRAMAN v4 integrates multi-engine Computer Vision, Optical Character Recognition (OCR), Statutory Legal Rule Validation, and Field Audit Automation into a hardened, production-ready system:

```
[ Packaging Image / Camera Frame ]
               │
               ▼
┌──────────────────────────────────────────────┐
│ Stage 0: Preprocessing & Deskew               │
│ • Aspect ratio resize (max 1600px long edge) │
│ • Perspective deskew & glare ratio detector  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Stage 1: Tier 1 Fast Path (PaddleOCR)        │
│ • Conf >= 0.60 & all declarations found      │
│   ──► Fast Exit (Skip Tier 2)                │
└──────────────────────┬───────────────────────┘
                       │ (if missing fields or low confidence)
                       ▼
┌──────────────────────────────────────────────┐
│ Stage 2: Tier 2 Deep Ensemble                │
│ • EasyOCR + SuryaOCR running in parallel     │
│ • CLAHE contrast enhancement & Paddle retry  │
└──────────────────────┬───────────────────────┘
                       │ (if critical fields still missing)
                       ▼
┌──────────────────────────────────────────────┐
│ Stage 3: Tier 3 VLM Recovery (Florence-2)    │
│ • Targeted extraction for curved/low-contrast│
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Stage 4: Geometric Spatial IoU Token Merger  │
│ • IoU threshold >= 0.45 bounding box cluster │
│ • Reading order reconstruction               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Stage 5: Statutory Compliance Engine         │
│ • LM Rule 6(1)(a) Manufacturer name/address  │
│ • LM Rule 6(1)(c) Net quantity standard units│
│ • LM Rule 6(1)(d) Month/Year of manufacture  │
│ • LM Rule 6(1)(da) Best before / expiry date │
│ • LM Rule 6(1)(e) MRP inclusive of all taxes │
│ • LM Rule 6(2) Consumer care helpline/email  │
│ • FSSAI Regulations 2020 14-digit license    │
│ • Package flap / bottom flip detection       │
│ • Confidence gating (<0.60 -> needs_review)  │
└──────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
Backend/
├── app/
│   ├── main.py                       # FastAPI application, CORS, rate limiter middleware
│   ├── routers/
│   │   ├── auth.py                   # /api/auth (Login, Register, Me)
│   │   ├── scans.py                  # /api/analyze, /api/scans, /notes, /pdf, /stats
│   │   ├── product.py                # /api/products, GTIN catalog lookup
│   │   ├── rules.py                  # /api/rules (Official 31-rule statutory database)
│   │   ├── chat.py                   # /api/chat (Metrology RAG assistant)
│   │   ├── sync.py                   # /api/scans/sync (Offline field sync queue)
│   │   └── legacy.py                 # /health endpoint
│   ├── extraction/
│   │   ├── reading_order.py          # Spatial reading-order resolver
│   │   └── declaration_parser.py     # Contextual declaration parser
│   ├── ocr/
│   │   └── engine_base.py            # TextPolygon & OCRResult protocols
│   ├── validation/
│   │   ├── rules_db.json             # Consolidated 31-rule statutory database
│   │   └── rules.json                # Rule summary definitions
│   └── services/
│       └── pdf_service.py            # Official audit report generator (ReportLab)
├── core/
│   ├── config.py                     # Environment configuration & cache paths
│   ├── database.py                   # SQLAlchemy engine, session maker, migrations
│   ├── db_models.py                  # ScanRecordDB, UserDB, ProductMasterDB
│   ├── auth.py                       # Native bcrypt hashing & JWT verification
│   ├── limiter.py                    # SlowAPI rate limiting configuration
│   ├── image_utils.py                # Perspective deskew, glare detection, CLAHE
│   └── logger.py                     # Structured logger
├── pipeline/
│   ├── ensemble_pipeline.py          # 5-stage cascaded ensemble coordinator
│   ├── field_extractor.py            # Dot-matrix normalization & field extraction
│   ├── field_rules.py                # Statutory regex patterns & citations
│   ├── compliance_engine.py          # Ported field validators & confidence gating
│   └── spatial_merger.py             # Geometric Polygon IoU token merger
├── api/
│   ├── response_mapper.py            # Pipeline report -> ScanRecord client contract
│   └── gtin_lookup.py                # Barcode GTIN cross-verification
├── eval/
│   ├── ground_truth_schema.json      # JSON Schema for packaging annotations
│   └── annotations/                  # Benchmark test packaging annotations
├── scripts/
│   └── eval_accuracy.py              # Automated accuracy & F1 evaluation harness
├── frontend/                         # React Native (Expo) Field Inspector App
│   ├── src/
│   │   ├── api/                      # Unified ApiClient with error handling
│   │   ├── context/                  # AuthContext with persistent storage
│   │   ├── services/                 # Offline queue, storage, PDF exporter
│   │   ├── screens/                  # Inspector screens (Capture, Result, History, etc.)
│   │   └── components/               # DemoBanner, StatusPill, GlassCard, etc.
├── tests/                            # Automated pytest test suites (34 tests)
├── Dockerfile                        # Production container image
└── docker-compose.yml                # Docker Compose orchestration
```

---

## 🔒 Security & Reliability Architecture

1. **Authentication & Passwords**: Native `bcrypt` key derivation with automatic 12-round salt generation, constant-time `hmac.compare_digest` verification, and minimum 8-character password enforcement. Role spoofing is rejected; registration locks role to `"inspector"`.
2. **Rate Limiting**: Integrated `slowapi` rate limiting across sensitive endpoints (`10/minute` for `/api/auth/login`, `20/minute` for `/api/analyze`).
3. **MIME Validation & Size Limits**: Image uploads require valid JPEG, PNG, or WebP magic headers (`b'\xff\xd8\xff'`, `b'\x89PNG'`, `b'RIFF'`) and are strictly capped at 10 MB.
4. **Timezone Awareness**: All timestamps utilize UTC-aware datetimes (`datetime.now(timezone.utc)`), with formatting converted to Indian Standard Time (IST) on response mapping.
5. **Database Optimization**: Dashboard statistics use SQL aggregations (`func.count()`, `group_by()`) instead of memory-heavy full table scans.
6. **No Silent Mock Fallbacks**: Production mode throws explicit, typed `ApiError` instances if the backend is unreachable. Fictional fallbacks, fake brands, and fabricated scores are eliminated.

---

## 🚀 Running the System

### Backend Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run automated test suite
python -m pytest tests/

# 3. Run accuracy evaluation harness
python scripts/eval_accuracy.py

# 4. Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Docker Deployment

```bash
# Build and run container
docker-compose up --build -d

# Check health
curl http://localhost:8000/health
```

### Mobile / Web Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Typecheck
npx tsc --noEmit

# Run web app
npx expo start --web
```

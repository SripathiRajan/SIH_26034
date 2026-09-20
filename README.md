---
title: PRAMAN v4 Backend
emoji: ⚖️
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 4.44.0
python_version: 3.11
app_file: app.py
pinned: false
---

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
│   │   ├── scan_session.py           # /api/scan/session (multi-angle capture sessions)
│   │   ├── product.py                # /api/products, GTIN catalog lookup
│   │   ├── rules.py                  # /api/rules (Official 31-rule statutory database)
│   │   ├── chat.py                   # /api/chat (Metrology RAG assistant) + /api/chat/status
│   │   ├── sync.py                   # /api/scans/sync (Offline field sync queue)
│   │   └── legacy.py                 # /health endpoint
│   ├── knowledge/
│   │   ├── vector_store.py           # FAISS + multilingual MiniLM statutory vector search
│   │   ├── corpus_loader.py          # Gazette corpus seeding at server startup
│   │   └── gazette_loader.py         # Gazette PDF discovery & ingestion support
│   ├── chatbot/
│   │   └── rag_assistant.py          # RAG answer synthesis (Groq → Gemini → template)
│   ├── extraction/
│   │   ├── reading_order.py          # Spatial reading-order resolver
│   │   └── declaration_parser.py     # Contextual declaration parser
│   ├── ocr/
│   │   └── engine_base.py            # TextPolygon & OCRResult protocols
│   ├── validation/
│   │   ├── rules_db.json             # Consolidated 31-rule statutory database
│   │   └── rules.json                # Rule summary definitions
│   └── services/
│       ├── pdf_service.py            # Official audit report generator (ReportLab)
│       └── chat_service.py           # Keyword statutory FAQ fallback engine
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
├── tests/                            # Automated pytest test suites
├── Dockerfile                        # Production container image
└── docker-compose.yml                # Docker Compose orchestration
```

---

## 🤖 Statutory RAG Chatbot (Groq + Gazette Knowledge Base)

The **Ask Assistant** screen is powered by a Retrieval-Augmented Generation pipeline over the official gazette corpus:

1. `backend/data/rules_corpus.json` (generated by `python scripts/ingest_rules_pdfs.py` from `backend/data/gazette_pdfs/`) is loaded into a FAISS + multilingual MiniLM vector store at server startup.
2. Each user question retrieves the top-3 statutory passages with G.S.R. notification provenance.
3. Answer synthesis provider order: **Groq** (`GROQ_API_KEY`, OpenAI-compatible `chat/completions`, default model `openai/gpt-oss-120b`) → **Gemini** (`GEMINI_API_KEY`, optional) → **statutory template fallback** (fully offline-capable, no external calls).
4. Responses carry `citations`, `llm_generated`, and `llm_provider` flags — the UI displays retrieval citations as chips. API keys are never logged or returned (boolean-only `groq_configured` / `gemini_configured` in `/api/chat/status`).

**Environment setup** — create `.env` in the project root (see `.env.example`):
```
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b
```

---

## 📸 Multi-Angle Live Camera Capture Sessions

The **Capture** screen supports a multi-view inspection cart (1–6 package faces per session):

| Endpoint | Purpose |
|---|---|
| `POST /api/scan/session` | Create/resume a session with 1–6 images; returns merged statutory coverage (`found`/`missing`/`hintLine`) + per-view quality (sharpness, glare) |
| `POST /api/scan/session/{id}/finalize` | Merge all views into exactly one persisted `ScanRecord` (requires inspector auth) |
| `DELETE /api/scan/session/{id}` | Idempotent discard with temp-file cleanup |

- Sessions live in memory with a 15-minute TTL and 20-session LRU eviction.
- Views are processed strictly sequentially through the ensemble OCR pipeline (Windows-safe).
- Live viewfinder: real camera preview on Web (`getUserMedia` + canvas frame grab) and native (`expo-camera` `CameraView` + `takePictureAsync`).
- Clearing the cart or removing a thumbnail discards the backend session (`DELETE`) so temp files never linger past TTL.

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
# 1. Provision secrets in .env (project root; gitignored — see .env.example)
#    PRAMAN_SECRET_KEY=<random 64-hex string>   # required: startup fails fast without it
#    GROQ_API_KEY=gsk_...                       # optional: chatbot LLM synthesis
#    CORS_ORIGINS=https://your-app.example.com  # public origin(s) of the deployed frontend

# 2. Build and run container
docker-compose up --build -d

# 3. Check health
curl http://localhost:8000/health
```

**Production notes**
- The container runs a **single uvicorn worker on purpose**: scan sessions (`/api/scan/session`) and slowapi rate limits are in-memory and per-process — multiple workers would split session state and break finalize/discard. Scale by running multiple containers behind a load balancer **with sticky sessions**, or move `SessionStore` to a shared backend (Redis) first.
- `PRAMAN_SECRET_KEY` (not `JWT_SECRET_KEY`) is the variable the application reads for JWT signing.
- Put a TLS-terminating reverse proxy (nginx/Caddy) in front of port 8000.
- First boot downloads the multilingual MiniLM embedding model from HuggingFace (cached in the `praman_cache` volume afterwards).
- SQLite is the default store — adequate for a single-instance pilot; switch `DATABASE_URL` to PostgreSQL for multi-instance deployments.

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

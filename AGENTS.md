# PRAMAN v4 — Agent & Contributor Guide

## System Overview
PRAMAN v4 is a statutory compliance inspection system built for Indian Legal Metrology enforcement under:
- **Legal Metrology Act, 2009**
- **Legal Metrology (Packaged Commodities) Rules, 2011 (as amended)**
- **Food Safety and Standards (Labelling and Display) Regulations, 2020**

## Core Architectural Principles
1. **Zero Silent Fallbacks**: Never return mock or fictional data in production mode. If an OCR engine or backend service fails, return typed errors.
2. **Honest Metrics**: No artificial score clamping. The "Compliance Confidence" is derived from detected statutory fields and OCR confidence.
3. **Statutory Veracity**: Citations must map to verified gazette rules (`rules_db.json` / `field_rules.py`).
4. **Timezone Awareness**: All database timestamps and token expirations must use UTC (`datetime.now(timezone.utc)`). Display dates in IST (`UTC+05:30`).

## Key Component Responsibilities
- `pipeline/ensemble_pipeline.py`: The single source of truth for OCR execution (PaddleOCR -> EasyOCR/SuryaOCR -> Florence-2 VLM -> Spatial Merger -> Field Extractor -> Compliance Engine).
- `pipeline/field_extractor.py`: Extracts declared fields, normalizes dot-matrix dates (`1UN/2026` -> `JUN/2026`, `0CT` -> `OCT`), cleans MRP symbols (`?` -> `₹`), validates strict 14-digit FSSAI licenses, and detects flip/flap pointers.
- `pipeline/compliance_engine.py`: Statutory compliance rules, net quantity standard metric units whitelist (Rule 6(1)(c)), MRP tax statements (Rule 6(1)(e)), and confidence gating (`< 0.60` -> `needs_review`).
- `api/response_mapper.py`: Formats pipeline report into client `ScanRecord` interface.
- `app/routers/scan_session.py`: Multi-angle capture sessions (`/api/scan/session*`): 1–6 images, in-memory TTL/LRU store, sequential OCR, face merging, one-record finalize, idempotent discard.
- `app/chatbot/rag_assistant.py`: RAG chatbot synthesis — Groq (`GROQ_API_KEY`, primary) -> Gemini (optional) -> statutory template fallback.
- `frontend/src/screens/CaptureScreen.tsx`: Capture cart (1–6 views), live viewfinder (web: `getUserMedia`; native: `expo-camera`), live statutory coverage.
- `frontend/src/screens/ChatScreen.tsx`: Ask-assistant UI calling `POST /api/chat` with citation chips; canned keyword engine only as offline fallback.
- `frontend/src/context/AuthContext.tsx`: Persistent officer session management.
- `frontend/src/services/offlineQueue.ts`: Manages offline field scans queue and flushes via `/api/scans/sync`.

## Environment Notes
- Use **Python 3.11** on this machine (`py -3.11`): the default `python` (3.14) has an incompatible torch build (`torch._C` missing).
- `GROQ_API_KEY` / `GEMINI_API_KEY` live in `.env` (gitignored) and must never be logged or returned; `/api/chat/status` exposes booleans only.
- LLM keys are neutralized in `tests/conftest.py` so pytest never makes real LLM network calls.

## Testing & Quality Gates
Always run both quality gates before committing:
```bash
# Backend pytest suite (39 tests)
py -3.11 -m pytest tests/

# Accuracy benchmark harness
py -3.11 scripts/eval_accuracy.py

# Frontend TypeScript check (0 errors)
cd frontend && npx tsc --noEmit
```

# PRAMAN v4 — Azure Production Deploy Guide

This guide covers deploying the PRAMAN v4 unified compliance inspection platform on **Microsoft Azure** (Azure App Service / Azure Container App / Azure VM).

---

## Azure Architecture & Environment

```
Azure Host: http://praman-ai.indiasouthcentral.cloudapp.azure.com
Runtime: Docker / Python 3.11
Storage: Local persistent volume (SQLite + Uploads + Model Cache)
```

---

## Step 1 — Production Environment Configuration

Set the following environment variables in your Azure App Service / Container configuration:

| Variable | Description | Value |
|---|---|---|
| `ENVIRONMENT` | Deployment environment mode | `production` |
| `PRAMAN_SECRET_KEY` | JWT token cryptographic signing key | Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `PRAMAN_ADMIN_PASSWORD` | Initial admin account seed password | Strong password (used only on first-ever boot) |
| `GROQ_API_KEY` | Primary LLM key for statutory RAG assistant | `gsk_...` |
| `GEMINI_API_KEY` | Optional secondary provider fallback | Optional |
| `CORS_ORIGINS` | Permitted origins | `http://praman-ai.indiasouthcentral.cloudapp.azure.com,https://praman-ai.indiasouthcentral.cloudapp.azure.com` |
| `PORT` | Listening HTTP port | `8000` (or injected Azure `$PORT`) |
| `HF_HOME` | Persistent HuggingFace model cache directory | `/data/cache/huggingface` |
| `TORCH_HOME` | Persistent Torch cache directory | `/data/cache/torch` |
| `DATABASE_URL` | SQLite path or PostgreSQL connection string | `sqlite:////data/praman.db` |
| `PRAMAN_PRELOAD_MODELS`| Sequential model warm-up at startup | `1` |

> Note: When `ENVIRONMENT=production`, `core/config.py` enforces that `PRAMAN_SECRET_KEY` must not be the default development secret. The server fails fast and refuses to boot without a secure key.

---

## Step 2 — Storage Persistence Mounts

For Azure App Service or Container Apps, mount an Azure Files / Persistent Disk volume to preserve inspection records and model weights between restarts:

- `/data` -> Persistent Volume
  - `/data/praman.db` (Inspection SQLite database)
  - `/data/uploads/` (Inspection package images)
  - `/data/cache/` (OCR & VLM model weights)

---

## Step 3 — Quality Gates Before Push

Always verify both quality gates before pushing to `origin main`:

```powershell
# 1. Backend Pytest Suite (all tests passing)
py -3.11 -m pytest tests/

# 2. Frontend TypeScript Type Check (0 errors)
cd frontend
npx tsc --noEmit
```

---

## Step 4 — Deployment Commands

### Push to GitHub:
```powershell
git add .
git commit -m "feat: production hardening, security fixes, and azure readiness"
git push origin main
```

### Apply on Azure:
- **If GitHub CI/CD is linked**: The push automatically triggers an Azure deployment.
- **If deploying to Azure VM**:
  ```bash
  ssh <user>@praman-ai.indiasouthcentral.cloudapp.azure.com
  cd /path/to/Chatbot-main
  git pull origin main
  docker compose up -d --build
  ```

---

## Step 5 — Verify Health Endpoint

Verify Azure deployment:
```bash
curl http://praman-ai.indiasouthcentral.cloudapp.azure.com/health
```
Expected response:
```json
{
  "status": "healthy",
  "service": "PRAMAN_v4_unified",
  "version": "4.0.0",
  "ocr_engines": {
    "primary": "paddleocr",
    "secondary": "easyocr",
    "tertiary": "surya"
  },
  "port": 8000
}
```

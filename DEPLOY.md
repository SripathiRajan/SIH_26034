# PRAMAN v4 — Deploy Guide (Render backend + Vercel frontend)

Deploy order matters: **backend first** (you need its URL for the frontend build), then frontend, then one CORS update back on the backend.

```
GitHub repo: https://github.com/SripathiRajan/SIH_26034
Backend  -> Render  (Docker runtime, from ./Dockerfile, render.yaml blueprint)
Frontend -> Vercel  (Expo static web export, from ./frontend, frontend/vercel.json)
```

---

## Step 1 — Render: deploy the backend (~15–25 min first build)

1. Go to <https://dashboard.render.com> → sign in with GitHub → authorize access to `SripathiRajan/SIH_26034`.
2. **New → Blueprint**, select the repo — Render reads `render.yaml` and pre-fills one web service `praman-backend`.
   *(If prompted about a paid plan: the service uses **Starter (2 GB)** because the OCR stack OOMs on the free 512 MB plan — see "Gotchas" below.)*
3. Fill the two secret env vars when prompted:
   | Variable | Value |
   |---|---|
   | `PRAMAN_SECRET_KEY` | any 64-hex string — generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `GROQ_API_KEY` | your `gsk_...` key (same one as local `.env`) |
   | `CORS_ORIGINS` | temporary: `https://localhost:8081` (you will replace this in Step 3) |
   | `GEMINI_API_KEY` | leave blank (optional provider) |
4. Click **Apply** / **Create Service**. The Docker image build downloads torch/paddle — expect **10–25 minutes**.
5. When it's **Live**, verify: open `https://<your-app>.onrender.com/health` → should return `{"status":"healthy",...}`.
   Note this URL down — it is your `EXPO_PUBLIC_API_URL`.

## Step 2 — Vercel: deploy the frontend (~3–5 min)

1. Go to <https://vercel.com> → sign in with GitHub.
2. **Add New → Project** → import `SripathiRajan/SIH_26034`.
3. **Before clicking Deploy**, expand **Build & Output Settings**:
   - **Root Directory**: `frontend`
   - Framework Preset: *Other* (the `frontend/vercel.json` handles build + output)
4. Add **Environment Variables** (Production):
   | Variable | Value |
   |---|---|
   | `EXPO_PUBLIC_API_URL` | `https://<your-app>.onrender.com` (from Step 1.5 — no trailing slash) |
5. Click **Deploy**. First build runs `npm install` + `npx expo export --platform web` → static site in `dist/`.
6. When ready, open your `https://<project>.vercel.app` — the PRAMAN login screen should load.
   **Note this URL down** — it is your `CORS_ORIGINS` value.

## Step 3 — Render: allow the Vercel origin (CORS)

1. Render Dashboard → `praman-backend` → **Environment**.
2. Edit `CORS_ORIGINS` → `https://<project>.vercel.app` (add more comma-separated origins if needed, e.g. the Expo Go / LAN origins for field testing).
3. **Save** — the service reboots (~1 min, models re-warm). Redeploys of the frontend need no further backend changes.

## Step 4 — Smoke-test the deployed stack

1. Open the Vercel URL → **Sign Up** a new inspector account (role is locked to `inspector`) → log in.
2. **Ask** tab → send a statutory question → answer should carry G.S.R. citations (`/api/chat/status` on the Render URL should show `corpus_chunks_loaded` > 0 and `groq_configured: true`).
3. **Inspect** tab → upload a package photo → verify coverage panel + finalize report.
4. Live camera on the deployed site works in any HTTPS browser (phone included) — `getUserMedia` is allowed on Vercel's HTTPS domain.

---

## Gotchas (read before troubleshooting)

- **Free Render tier will fail**: torch + paddleocr + easyocr + surya need ~1.5 GB+ RAM; the free plan (512 MB) gets OOM-killed during model warm-up. Starter (2 GB) is the minimum.
- **Cold starts**: free/starter instances spin down after ~15 min idle on lower tiers; the first request after idle takes ~1–2 min (models re-warm). In-memory scan sessions (`/api/scan/session`) and SQLite data are **lost on every restart/redeploy** — acceptable for a pilot; move `DATABASE_URL` to Postgres + `SessionStore` to Redis for real persistence.
- **First boot downloads** the multilingual MiniLM embedding model from HuggingFace into the container — `/health` is up but `/api/chat` may lag ~1–3 min on a fresh deploy.
- **Single uvicorn worker is intentional** (Dockerfile CMD): scan sessions and rate limits are per-process in-memory. Do not raise `--workers`.
- **Uploads are ephemeral** on Render: scan images stored under `uploads/` vanish on redeploy.
- **Mixed content**: the frontend must call the backend over `https://` (it does, via `EXPO_PUBLIC_API_URL`); never point it at `http://`.
- **`EXPO_PUBLIC_API_URL` is baked in at build time** — if you change it, trigger a **Redeploy** on Vercel (rebuild required, not just a refresh).
- **Database**: Render's Docker service has no persistent disk by default; `praman.db` lives in the container. For a durable pilot, add a Render Disk mounted at `/app/data` and set `DATABASE_URL=sqlite:////app/data/praman.db` (Disk requires a paid instance), or switch to Postgres.

## Updating the deployment

Push to `main` → Render auto-deploys the backend (`autoDeploy: true`) and Vercel auto-rebuilds the frontend. Run the quality gates first (`py -3.11 -m pytest tests/`, `cd frontend && npx tsc --noEmit`).

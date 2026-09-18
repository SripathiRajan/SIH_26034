# PRAMAN v4 — 100% Free Deployment Guide (Hugging Face Spaces + Vercel)

This deployment architecture is **completely free ($0/month)** and avoids Out-Of-Memory (OOM) crashes:
- **Backend**: Hugging Face Spaces (Docker, **16 GB RAM Free Tier**) — easily handles PyTorch + PaddleOCR + EasyOCR.
- **Frontend**: Vercel (Static Expo Web, **100% Free Hobby Plan** with global CDN).

```
[ Inspector / Mobile Browser ]
             │
             ▼
    Vercel (Frontend)
    https://praman-app.vercel.app
             │
             │ HTTPS API Calls (Bearer JWT)
             ▼
 Hugging Face Spaces (Backend)
 https://<your-hf-username>-praman-backend.hf.space
 (16 GB RAM • PyTorch + PaddleOCR + EasyOCR + FastAPI)
```

---

## Part 1: Deploy Backend to Hugging Face Spaces (~5 mins)

### Step 1.1: Create a Free Hugging Face Space
1. Go to [huggingface.co](https://huggingface.co) and sign in (or create a free account).
2. Click your profile picture (top right) → **New Space** (or go to [huggingface.co/new-space](https://huggingface.co/new-space)).
3. Fill in the details:
   - **Space name**: `praman-backend`
   - **License**: `mit`
   - **Space SDK**: Select **Docker** → **Blank**
   - **Space hardware**: Leave on **CPU basic • 2 vCPU • 16 GB • Free**
   - **Privacy**: **Public** (required for the frontend to call the API)
4. Click **Create Space**.

### Step 1.2: Connect Your GitHub Repo to the Space
You can push directly from your local terminal to Hugging Face:

1. In your Hugging Face Space page, find the clone URL under the 3 dots (⋮) or clone instructions:
   ```bash
   # Add Hugging Face as a git remote (replace <your-hf-username> with your HF username):
   git remote add hf https://huggingface.co/spaces/<your-hf-username>/praman-backend
   ```
2. Push your code to Hugging Face:
   ```bash
   git push hf main
   ```
   *(When prompted for credentials: username = your Hugging Face username, password = an Access Token created with "Write" access at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)).*

*(Alternatively: under Space **Settings** → **GitHub auto-sync**, you can connect your GitHub repository directly).*

### Step 1.3: Set Environment Variables & Secrets
In your Hugging Face Space:
1. Click **Settings** (tab near the top right of your Space).
2. Scroll to **Variables and secrets**.
3. Add the following **Secrets** (click "New secret"):
   | Name | Value |
   |---|---|
   | `PRAMAN_SECRET_KEY` | Run in terminal: `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `GROQ_API_KEY` | Your `gsk_...` key from local `.env` |
4. Add the following **Variables** (click "New variable"):
   | Name | Value |
   |---|---|
   | `ENVIRONMENT` | `production` |
   | `CORS_ORIGINS` | `http://localhost:8081,https://localhost:8081` *(you will add your Vercel URL in Part 3)* |

### Step 1.4: Verify the Backend
1. Once the Space build completes (status changes from *Building* to *Running*):
2. Your direct API URL is:
   `https://<your-hf-username>-praman-backend.hf.space`
3. Test in your browser:
   `https://<your-hf-username>-praman-backend.hf.space/health`
   Expected response:
   ```json
   {"status":"healthy","version":"4.0.0",...}
   ```
   *Copy this backend URL — you need it for the frontend.*

---

## Part 2: Deploy Frontend to Vercel (~3 mins)

### Step 2.1: Import into Vercel
1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** → **Project**.
3. Find your repository: `SripathiRajan/SIH_26034` and click **Import**.

### Step 2.2: Configure Root Directory & Environment
1. Under **Build & Output Settings**:
   - Set **Root Directory** to: `frontend`
   - Leave Framework Preset on **Other** (the repository includes `frontend/vercel.json` which configures the Expo web build).
2. Under **Environment Variables**:
   | Name | Value |
   |---|---|
   | `EXPO_PUBLIC_API_URL` | `https://<your-hf-username>-praman-backend.hf.space` *(no trailing slash!)* |
3. Click **Deploy**.

Vercel will install dependencies, build the static Expo web app, and deploy it to a global edge CDN.

---

## Part 3: Allow Frontend in Backend CORS (1 min)

1. Once Vercel finishes, copy your live Vercel URL (e.g. `https://sih-26034.vercel.app`).
2. Go back to your Hugging Face Space → **Settings** → **Variables**.
3. Edit `CORS_ORIGINS` to include your Vercel domain:
   ```
   https://sih-26034.vercel.app,http://localhost:8081
   ```
4. Hugging Face Space will restart with the new CORS policy applied.

---

## Part 4: Testing & Verification

1. Open your Vercel URL in any browser or smartphone.
2. **Sign Up** a new inspector account (locked to `inspector` role) and log in.
3. **Ask Assistant**: Ask a statutory query regarding Legal Metrology or FSSAI — citations and streaming RAG responses will load.
4. **Camera / Upload**: Live camera scanning is supported on mobile browsers since Vercel serves the app over secure HTTPS.

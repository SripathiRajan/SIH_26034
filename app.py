import os
import uvicorn
from app.main import app
from fastapi.responses import HTMLResponse

try:
    import spaces
    @spaces.GPU
    def gpu_task_runner():
        """Registers active ZeroGPU acceleration for PRAMAN v4 AI models."""
        return True
    gpu_task_runner()
except Exception:
    pass

@app.get("/", response_class=HTMLResponse)
def root_dashboard():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>PRAMAN v4 Compliance Backend</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f8fafc; padding: 40px 20px; text-align: center; }
            .card { background: #161e2e; border: 1px solid #233044; border-radius: 16px; padding: 40px; max-width: 620px; margin: 30px auto; box-shadow: 0 10px 40px rgba(0,0,0,0.6); }
            h1 { color: #38bdf8; margin-top: 0; font-size: 26px; }
            .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; background: #064e3b; color: #34d399; border: 1px solid #059669; border-radius: 20px; font-weight: 600; font-size: 13px; margin: 15px 0 25px; }
            p { color: #94a3b8; line-height: 1.6; }
            ul { text-align: left; line-height: 2; margin: 25px 0; padding-left: 20px; background: #0d1321; border-radius: 10px; padding: 18px 24px; }
            li { color: #cbd5e1; }
            code { background: #1e293b; padding: 3px 8px; border-radius: 5px; color: #38bdf8; font-family: monospace; font-size: 14px; }
            a { color: #38bdf8; text-decoration: none; font-weight: 600; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🏛️ PRAMAN v4 API</h1>
            <div class="badge">● SYSTEM ONLINE</div>
            <p>Statutory Compliance & Legal Metrology Inspection Backend is active and serving requests for Mobile & Web clients.</p>
            <ul>
                <li><strong>Health Check:</strong> <a href="/health">/health</a></li>
                <li><strong>Interactive Swagger Docs:</strong> <a href="/docs">/docs</a></li>
                <li><strong>Label OCR & Scan:</strong> <code>/api/scan</code></li>
                <li><strong>Statutory RAG Assistant:</strong> <code>/api/chat</code></li>
            </ul>
        </div>
    </body>
    </html>
    """

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)

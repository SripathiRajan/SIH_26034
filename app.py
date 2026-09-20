import os
import gradio as gr
from app.main import app as fastapi_app

# Create a clean Gradio interface for the Hugging Face Space viewer
with gr.Blocks(title="PRAMAN v4 Compliance Backend") as demo:
    gr.Markdown("# 🏛️ PRAMAN v4 — Legal Metrology Compliance Backend")
    gr.Markdown(
        "The statutory compliance backend API is running.\n\n"
        "- **API Health**: [`/health`](/health)\n"
        "- **Swagger Docs**: [`/docs`](/docs)\n"
        "- **Scans & Inspection**: `/api/scan`\n"
        "- **Statutory Assistant**: `/api/chat`"
    )
    status_box = gr.Textbox(
        value="✅ All compliance pipelines (PaddleOCR, EasyOCR, RAG, Legal Metrology Rules) are active.",
        label="Service Status",
        interactive=False,
    )

# Mount Gradio interface onto the FastAPI application
# Existing FastAPI routes (/health, /api/*, /docs) take full priority.
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)

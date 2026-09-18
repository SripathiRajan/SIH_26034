FROM python:3.11-slim

# System dependencies for OpenCV, OCR engines, and PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    tesseract-ocr \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Setup non-root user for Hugging Face Spaces & security
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Ensure storage directories exist with write permissions
RUN mkdir -p uploads .cache && chown -R user:user /app

USER user

EXPOSE 7860 8000

ENV PYTHONUNBUFFERED=1
ENV PORT=7860

# Single worker is required: scan sessions and rate limits live in per-process
# memory (app/routers/scan_session.py SessionStore, slowapi), so multiple
# workers would split session state across processes and break finalize/discard.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]

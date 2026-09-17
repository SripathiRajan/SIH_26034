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

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Ensure storage directories exist
RUN mkdir -p uploads .cache

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Single worker is required: scan sessions and rate limits live in per-process
# memory (app/routers/scan_session.py SessionStore, slowapi), so multiple
# workers would split session state across processes and break finalize/discard.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

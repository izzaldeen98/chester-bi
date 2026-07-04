# ──────────────────────────────────────────────────────────────────────────
#  chester-bi  –  Backend  (FastAPI + Uvicorn)
# ──────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Keeps Python output unbuffered so logs appear in real-time
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install OS-level build deps needed by some Python packages (psycopg2, cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source
COPY . .

EXPOSE 8989

# Run with reload=False in production; use an override in dev compose if needed
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8989"]

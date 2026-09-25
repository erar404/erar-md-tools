FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PROCESSOR_TMP_DIR=/tmp/md-tools-processor
EXPOSE 8000

# Shell form so $PORT (injected by Railway/Fly/etc.) overrides the default —
# a hardcoded --port 8000 would silently mismatch whatever port the host
# actually routes traffic to.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

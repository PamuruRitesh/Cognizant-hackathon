FROM python:3.11-slim

# LightGBM links against libgomp at runtime; the slim image does not ship it,
# and without it `import lightgbm` fails with a missing libgomp.so.1.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# aerospace.duckdb is gitignored and built from the committed CSVs. Without
# this the /api/aerospace/* routes (the Vendor Hub tab) return 500.
RUN python src/data/aerospace_loader.py || echo "aerospace load skipped"

EXPOSE 8000

# Render injects $PORT and it must be honoured, so use the shell form to let
# the variable expand. Falls back to 8000 for local `docker run`.
CMD uvicorn src.api.main:app --host 0.0.0.0 --port ${PORT:-8000}

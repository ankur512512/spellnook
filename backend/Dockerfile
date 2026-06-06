FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build the allowed-guess dictionary from an open-source list.
# Non-fatal: if offline at build time, the app falls back to the curated answers.
RUN python scripts/fetch_words.py || echo "WARN: word fetch failed; using curated answers only"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV UV_LINK_MODE=copy

WORKDIR /app/backend/py

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential curl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/py/pyproject.toml backend/py/uv.lock ./
COPY backend/py/README.md ./
COPY backend/py/packages ./packages
COPY backend/py/src ./src
COPY backend/py/main.py ./
COPY backend/py/alembic.ini ./
COPY backend/py/alembic ./alembic
COPY backend/py/scripts ./scripts

# Production docker-compose uses external ChromaDB service (HTTP); keep the API
# image smaller by skipping embedded-Chroma Python dependencies at install time.
RUN UV_HTTP_TIMEOUT=300 uv sync --frozen --no-dev --no-editable --no-install-package chromadb

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS runtime

WORKDIR /app/backend/py

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system crystalith \
  && adduser --system --ingroup crystalith crystalith

ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

COPY --from=builder /opt/venv /opt/venv
COPY backend/py/src ./src
COPY backend/py/main.py ./
COPY backend/py/alembic.ini ./
COPY backend/py/alembic ./alembic
COPY backend/py/scripts ./scripts

RUN mkdir -p ./data \
  && chown -R crystalith:crystalith /app

USER crystalith

EXPOSE 8032

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD curl -f http://localhost:8032/health || exit 1

ENV HOST=0.0.0.0
ENV PORT=8032
ENV RELOAD=0

CMD ["python", "main.py"]

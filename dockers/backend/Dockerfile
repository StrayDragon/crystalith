ARG PYTHON_IMAGE=python:3.12-slim-trixie
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.10.2

FROM ${UV_IMAGE} AS uv
FROM ${PYTHON_IMAGE} AS builder

ARG APT_MIRROR=""
ARG UV_INDEX_URL=""

ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV UV_LINK_MODE=copy

WORKDIR /app/backend/py

COPY --from=uv /uv /uvx /bin/

RUN set -eux; \
  if [ -n "$APT_MIRROR" ]; then \
    apt_mirror="${APT_MIRROR%/}"; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i -E "s#https?://deb.debian.org/debian(/?)([[:space:]]|$)#${apt_mirror}\\1\\2#g" /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i -E "s#https?://deb.debian.org/debian(/?)([[:space:]]|$)#${apt_mirror}\\1\\2#g" /etc/apt/sources.list; \
    fi; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends build-essential ca-certificates; \
  rm -rf /var/lib/apt/lists/*

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
RUN set -eux; \
  if [ -n "$UV_INDEX_URL" ]; then \
    UV_INDEX_URL="$UV_INDEX_URL" UV_HTTP_TIMEOUT=300 uv sync --frozen --no-dev --no-editable --no-install-package chromadb; \
  else \
    UV_HTTP_TIMEOUT=300 uv sync --frozen --no-dev --no-editable --no-install-package chromadb; \
  fi

FROM ${PYTHON_IMAGE} AS runtime

WORKDIR /app/backend/py

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

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8032/health')" || exit 1

ENV HOST=0.0.0.0
ENV PORT=8032
ENV RELOAD=0

CMD ["python", "main.py"]

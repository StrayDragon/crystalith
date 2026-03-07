ARG PYTHON_IMAGE=python:3.12-slim-trixie
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.10.2

FROM ${UV_IMAGE} AS uv
FROM ${PYTHON_IMAGE} AS builder

ARG USE_CN_MIRROR=1
ARG CI=""
ARG APT_MIRROR=""
ARG UV_INDEX_URL=""
ARG CRYSTALITH_BACKEND_EXTRAS=""

ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV UV_LINK_MODE=copy

WORKDIR /app/backend/py

COPY --from=uv /uv /uvx /bin/

RUN set -eux; \
  use_cn_mirror="1"; \
  case "${USE_CN_MIRROR:-1}" in 0|false|no|off) use_cn_mirror="0" ;; esac; \
  case "${CI:-}" in ""|0|false|no|off) ;; *) use_cn_mirror="0" ;; esac; \
  apt_mirror="${APT_MIRROR:-}"; \
  if [ -z "$apt_mirror" ] && [ "$use_cn_mirror" = "1" ]; then \
    apt_mirror="https://mirrors.tuna.tsinghua.edu.cn/debian"; \
  fi; \
  if [ -n "$apt_mirror" ]; then \
    apt_mirror="${apt_mirror%/}"; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i -E "s#https?://deb.debian.org/debian(/?)([[:space:]]|$)#${apt_mirror}\\1\\2#g" /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i -E "s#https?://deb.debian.org/debian(/?)([[:space:]]|$)#${apt_mirror}\\1\\2#g" /etc/apt/sources.list; \
    fi; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends build-essential ca-certificates git; \
  rm -rf /var/lib/apt/lists/*

COPY backend/py/pyproject.toml backend/py/uv.lock ./
COPY backend/py/README.md ./
COPY backend/py/packages ./packages
COPY backend/py/plugins ./plugins
COPY backend/py/src ./src
COPY backend/py/main.py ./
COPY backend/py/alembic.ini ./
COPY backend/py/alembic ./alembic
COPY backend/py/scripts ./scripts

RUN set -eux; \
  use_cn_mirror="1"; \
  case "${USE_CN_MIRROR:-1}" in 0|false|no|off) use_cn_mirror="0" ;; esac; \
  case "${CI:-}" in ""|0|false|no|off) ;; *) use_cn_mirror="0" ;; esac; \
  uv_index_url="${UV_INDEX_URL:-}"; \
  if [ -z "$uv_index_url" ] && [ "$use_cn_mirror" = "1" ]; then \
    uv_index_url="https://mirrors.aliyun.com/pypi/simple/"; \
  fi; \
  set --; \
  for extra in ${CRYSTALITH_BACKEND_EXTRAS:-}; do \
    set -- "$@" --extra "$extra"; \
  done; \
  if [ -n "$uv_index_url" ]; then \
    UV_INDEX_URL="$uv_index_url" UV_HTTP_TIMEOUT=300 uv sync --frozen --no-dev --no-editable "$@"; \
  else \
    UV_HTTP_TIMEOUT=300 uv sync --frozen --no-dev --no-editable "$@"; \
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

RUN mkdir -p /app/data \
  && chown -R crystalith:crystalith /app

USER crystalith

EXPOSE 8032

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8032/health')" || exit 1

ENV HOST=0.0.0.0
ENV PORT=8032
ENV RELOAD=0

CMD ["python", "main.py"]

ARG PYTHON_IMAGE=python:3.12-slim-trixie
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.11.1

FROM ${UV_IMAGE} AS uv
FROM ${PYTHON_IMAGE} AS builder

ARG USE_CN_MIRROR=1
ARG CI=""
ARG APT_MIRROR=""
ARG UV_INDEX_URL=""
ARG CRYSTALITH_BACKEND_EXTRAS=""
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG ALL_PROXY=""
ARG NO_PROXY=""
ARG http_proxy=""
ARG https_proxy=""
ARG all_proxy=""
ARG no_proxy=""

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
    apt_mirror="http://mirrors.tuna.tsinghua.edu.cn/debian"; \
  fi; \
  apt_sources=""; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    apt_sources="/etc/apt/sources.list.d/debian.sources"; \
  elif [ -f /etc/apt/sources.list ]; then \
    apt_sources="/etc/apt/sources.list"; \
  fi; \
  apt_backup=""; \
  if [ -n "$apt_mirror" ] && [ -n "$apt_sources" ]; then \
    apt_mirror="${apt_mirror%/}"; \
    apt_backup="${apt_sources}.bak"; \
    cp "$apt_sources" "$apt_backup"; \
    sed -i -E "s#https?://deb.debian.org/debian(/?)([[:space:]]|$)#${apt_mirror}\\1\\2#g" "$apt_sources"; \
  fi; \
  if ! apt-get update; then \
    if [ -n "$apt_backup" ] && [ -f "$apt_backup" ]; then \
      mv "$apt_backup" "$apt_sources"; \
      apt_backup=""; \
    fi; \
    apt-get update; \
  fi; \
  if ! apt-get install -y --no-install-recommends build-essential ca-certificates git; then \
    if [ -n "$apt_backup" ] && [ -f "$apt_backup" ]; then \
      mv "$apt_backup" "$apt_sources"; \
      apt_backup=""; \
      apt-get update; \
    fi; \
    apt-get install -y --no-install-recommends build-essential ca-certificates git; \
  fi; \
  rm -rf /var/lib/apt/lists/*; \
  if [ -n "$apt_backup" ] && [ -f "$apt_backup" ]; then rm -f "$apt_backup"; fi

COPY backend/py/pyproject.toml backend/py/uv.lock ./
COPY backend/py/README.md ./
COPY backend/py/packages ./packages
COPY backend/py/plugins ./plugins
COPY backend/py/src ./src
COPY backend/py/main.py ./
COPY backend/py/alembic.ini ./
COPY backend/py/alembic ./alembic
COPY backend/py/scripts ./scripts

RUN --mount=type=cache,target=/root/.cache/uv set -eux; \
  use_cn_mirror="1"; \
  case "${USE_CN_MIRROR:-1}" in 0|false|no|off) use_cn_mirror="0" ;; esac; \
  case "${CI:-}" in ""|0|false|no|off) ;; *) use_cn_mirror="0" ;; esac; \
  uv_index_url="${UV_INDEX_URL:-}"; \
  if [ -z "$uv_index_url" ] && [ "$use_cn_mirror" = "1" ]; then \
    uv_index_url="https://mirrors.aliyun.com/pypi/simple/"; \
  fi; \
  http_proxy="${http_proxy:-${HTTP_PROXY:-}}"; \
  https_proxy="${https_proxy:-${HTTPS_PROXY:-}}"; \
  all_proxy="${all_proxy:-${ALL_PROXY:-}}"; \
  no_proxy="${no_proxy:-${NO_PROXY:-}}"; \
  export \
    HTTP_PROXY="${HTTP_PROXY:-}" \
    HTTPS_PROXY="${HTTPS_PROXY:-}" \
    ALL_PROXY="${ALL_PROXY:-}" \
    NO_PROXY="${NO_PROXY:-}" \
    http_proxy="$http_proxy" \
    https_proxy="$https_proxy" \
    all_proxy="$all_proxy" \
    no_proxy="$no_proxy"; \
  set --; \
  for extra in ${CRYSTALITH_BACKEND_EXTRAS:-}; do \
    set -- "$@" --extra "$extra"; \
  done; \
  if [ -n "$uv_index_url" ]; then \
    UV_INDEX_URL="$uv_index_url" UV_HTTP_TIMEOUT=300 GIT_HTTP_VERSION=HTTP/1.1 uv sync --frozen --no-dev --no-editable "$@"; \
  else \
    UV_HTTP_TIMEOUT=300 GIT_HTTP_VERSION=HTTP/1.1 uv sync --frozen --no-dev --no-editable "$@"; \
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

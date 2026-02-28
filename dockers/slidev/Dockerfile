ARG NODE_IMAGE=node:20-trixie-slim

FROM ${NODE_IMAGE}

ARG USE_CN_MIRROR=1
ARG CI=""
ARG NPM_REGISTRY=""
ARG PNPM_VERSION=10.29.2

WORKDIR /app

RUN set -eux; \
  use_cn_mirror="1"; \
  case "${USE_CN_MIRROR:-1}" in 0|false|no|off) use_cn_mirror="0" ;; esac; \
  case "${CI:-}" in ""|0|false|no|off) ;; *) use_cn_mirror="0" ;; esac; \
  npm_registry="${NPM_REGISTRY:-}"; \
  if [ -z "$npm_registry" ] && [ "$use_cn_mirror" = "1" ]; then \
    npm_registry="https://registry.npmmirror.com"; \
  fi; \
  if [ -n "$npm_registry" ]; then \
    npm config set registry "$npm_registry"; \
    export COREPACK_NPM_REGISTRY="$npm_registry"; \
  fi; \
  corepack enable; \
  corepack prepare "pnpm@${PNPM_VERSION}" --activate

# Install Slidev dependencies
COPY frontend/packages/crystalith-slidev/package.json ./
COPY frontend/packages/crystalith-slidev/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Entrypoint handles data volume bootstrap and starts Slidev
COPY dockers/slidev/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3030

ENTRYPOINT ["/entrypoint.sh"]

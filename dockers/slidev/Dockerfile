ARG NODE_IMAGE=node:20-trixie-slim

FROM ${NODE_IMAGE}

ARG NPM_REGISTRY=""
ARG PNPM_VERSION=10.29.2

WORKDIR /app

RUN set -eux; \
  if [ -n "$NPM_REGISTRY" ]; then \
    npm config set registry "$NPM_REGISTRY"; \
    export COREPACK_NPM_REGISTRY="$NPM_REGISTRY"; \
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

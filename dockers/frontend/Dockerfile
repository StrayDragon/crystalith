ARG NODE_IMAGE=node:20-trixie-slim
ARG NGINX_IMAGE=nginx:1.29.5-trixie

FROM ${NODE_IMAGE} AS build

ARG USE_CN_MIRROR=1
ARG CI=""
ARG NPM_REGISTRY=""
ARG PNPM_VERSION=10.29.2

WORKDIR /app/frontend/web

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

COPY frontend/web/package.json frontend/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/web/ ./
COPY frontend/packages/ ../packages/
COPY scripts/ /app/scripts/

ENV CRYSTALITH_SKIP_FRONTEND_READY_INSTALL=1
RUN pnpm run build

FROM ${NGINX_IMAGE} AS runtime

COPY dockers/nginx/default.conf /etc/nginx/conf.d/nginx.default.conf
COPY --from=build /app/frontend/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD ["nginx", "-t"]
